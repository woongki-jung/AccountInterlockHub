<#
.SYNOPSIS
  ai-pm 단일 세션 래퍼 — Slack 런타임 기동·워치독 감시 + 세션 자동 재기동.

.DESCRIPTION
  0. config.json 의 exec_machine(지정 실행 장비)과 이 PC 의 MachineName 을 대조해 불일치하면 기동을 중단한다
     (복제 워크스페이스가 있는 다른 PC 의 중복 기동 방지 — ai/strategies/ai-pm.md §운영 모델).
  1. ai/bots/ai-pm/_slack/.env 에서 Redmine 자격(있으면)을 세션 env 로 주입한다(자식 Redmine MCP 가 그 정체성으로 작동).
  2. runtime.log / runtime.err.log 가 10MB 를 넘으면 .1 로 회전한 뒤(append 유지),
     Slack 런타임(app.js)이 떠 있지 않으면 백그라운드로 1개 띄운다. 판별은 app.js 절대 경로 기준.
  3. 경량 워치독(별도 PowerShell 프로세스)을 띄운다 — 5초 간격으로 app.js 생존을 확인하고
     죽어 있으면 재기동(연속 크래시 시 지수 백오프 최대 60초). 워치독은 _session/.stop 감지 시
     스스로 종료하며, 래퍼 종료 시에도 정리된다. 이미 떠 있으면 중복 기동하지 않는다.
  4. `claude --dangerously-skip-permissions 'ai-pm 세션 시작'` 를 루프로 실행한다. 매 종료 후
     ai/bots/ai-pm/_session/ 의 플래그를 확인: .restart → 즉시 재기동 / .stop → 종료 / (없음) → 재기동 여부 확인.
  세부 동작은 ai/strategies/ai-pm.md 참조. 단일 세션 — 둘 이상 띄우지 않는다.

.EXAMPLE
  pwsh -File ai/scripts/ai-pm-session.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $repoRoot

$slackDir    = Join-Path $repoRoot 'ai\bots\ai-pm\_slack'
$sessionDir  = Join-Path $repoRoot 'ai\bots\ai-pm\_session'
$runtimeLog  = Join-Path $slackDir 'runtime.log'
$runtimeErr  = Join-Path $slackDir 'runtime.err.log'
$appJs       = Join-Path $slackDir 'app.js'
$envFile     = Join-Path $slackDir '.env'
$botDef      = Join-Path $repoRoot 'ai\bots\ai-pm\ai-pm.md'
$restartFlag = Join-Path $sessionDir '.restart'
$stopFlag    = Join-Path $sessionDir '.stop'
$watchdogPs1 = Join-Path $sessionDir 'watchdog.ps1'
$watchdogLog = Join-Path $sessionDir 'watchdog.log'
$lastEventFile     = Join-Path $slackDir 'last-event'      # app.js 가 기록하는 최신 수신 이벤트 ts (§운영 연속성 ③)
$lastProcessedFile = Join-Path $sessionDir 'last-processed' # 세션이 트리아지한 최신 이벤트 ts

New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null
Remove-Item -Path $restartFlag, $stopFlag -Force -ErrorAction SilentlyContinue

# --- 실행 장비 검증 — config.json exec_machine(단일 출처)과 이 PC 의 MachineName 대조. 불일치면 기동 중단. ---
$configJson  = Join-Path $slackDir 'config.json'
$execMachine = $null
if (Test-Path $configJson) {
  try { $execMachine = (Get-Content $configJson -Raw | ConvertFrom-Json).exec_machine } catch {}
}
if (-not $execMachine) {
  throw "[ai-pm-session] config.json 에 exec_machine(지정 실행 장비) 미지정 — ai/strategies/ai-pm.md §운영 모델 참조."
}
if ($env:COMPUTERNAME -ne $execMachine) {
  throw "[ai-pm-session] 실행 장비 불일치 — 지정: $execMachine / 현재: $env:COMPUTERNAME. ai-pm 은 지정 실행 장비에서만 기동한다."
}

if (-not (Test-Path $envFile)) {
  throw "[ai-pm-session] $envFile 없음 — .env.example 를 .env 로 복사하고 Slack 토큰을 채우세요."
}

# --- 공용 판별/기동 헬퍼 — app.js '절대 경로' 가 CommandLine 에 포함되는지로 판별한다.
#     ('*ai-pm*app.js*' 류 패턴은 같은 PC 의 다른 복제 워크스페이스 런타임을 오탐한다.)
function Get-AppProcess {
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($appJs, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
}
function Get-WatchdogProcess {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($watchdogPs1, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
}
function Start-AppRuntime {
  # cmd /c '>>' 리다이렉션으로 기동 — Start-Process -RedirectStandardOutput 은 truncate 하므로 append 보존용.
  $cmdLine = ('node --env-file="{0}" "{1}" >> "{2}" 2>> "{3}"' -f $envFile, $appJs, $runtimeLog, $runtimeErr)
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdLine -WorkingDirectory $repoRoot -WindowStyle Hidden
}

# --- Redmine 자격 주입 (있으면) — 자식 Redmine MCP 가 이 정체성으로 작동. 없으면 서버 기본 admin 폴백. ---
foreach ($line in Get-Content $envFile) {
  if ($line -match '^\s*(REDMINE_API_KEY|REDMINE_BASE_URL)\s*=\s*(.+?)\s*$') {
    Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
  }
}
if ($env:REDMINE_API_KEY) {
  Write-Host "[ai-pm-session] Redmine: 전용 키 주입됨" -ForegroundColor DarkGray
} else {
  Write-Host "[ai-pm-session] Redmine: 전용 키 없음 — MCP 는 서버 기본 admin 키로 폴백" -ForegroundColor Yellow
}

# --- runtime 로그 회전 — 10MB 초과 시 .1 로 (기존 .1 덮어쓰기). 실행 중 프로세스가 잡고 있으면 건너뜀. ---
foreach ($log in @($runtimeLog, $runtimeErr)) {
  if ((Test-Path $log) -and ((Get-Item $log).Length -gt 10MB)) {
    try {
      Move-Item -Path $log -Destination "$log.1" -Force -ErrorAction Stop
      Write-Host "[ai-pm-session] 로그 회전: $log → $log.1" -ForegroundColor DarkGray
    } catch {
      Write-Host "[ai-pm-session] 로그 회전 실패(사용 중) — 건너뜀: $log" -ForegroundColor Yellow
    }
  }
}

# --- Slack 런타임(app.js) 기동 (떠 있지 않으면 1개만) ---
$startedByWrapper = $false
$existing = Get-AppProcess
if ($existing) {
  Write-Host "[ai-pm-session] Slack 런타임 이미 가동 중 (PID $(@($existing)[0].ProcessId)) — 재사용" -ForegroundColor DarkGray
} else {
  Write-Host "[ai-pm-session] Slack 런타임(app.js) 기동..." -ForegroundColor Cyan
  Start-AppRuntime
  $startedByWrapper = $true
  Start-Sleep -Seconds 2
  $started = Get-AppProcess
  if ($started) {
    Write-Host "[ai-pm-session] Slack 런타임 PID $(@($started)[0].ProcessId) — 로그 $runtimeLog" -ForegroundColor DarkGray
  } else {
    # 즉사 — 중단하지 않는다(워치독이 백오프로 재시도). 원인은 runtime.err.log 확인.
    Write-Warning "[ai-pm-session] app.js 가 기동 직후 종료됨 — $runtimeErr 확인 필요. 워치독이 재시도합니다."
  }
}

# --- 워치독 기동 — app.js 사망 감시·자동 재기동. 이미 떠 있으면 중복 기동하지 않는다. ---
$watchdogSource = @'
param(
  [Parameter(Mandatory=$true)][string]$AppJs,
  [Parameter(Mandatory=$true)][string]$EnvFile,
  [Parameter(Mandatory=$true)][string]$RuntimeLog,
  [Parameter(Mandatory=$true)][string]$RuntimeErr,
  [Parameter(Mandatory=$true)][string]$RepoRoot,
  [Parameter(Mandatory=$true)][string]$StopFlag,
  [Parameter(Mandatory=$true)][string]$WatchdogLog,
  [Parameter(Mandatory=$true)][string]$RestartFlag,
  [Parameter(Mandatory=$true)][string]$LastEventFile,
  [Parameter(Mandatory=$true)][string]$LastProcessedFile,
  [Parameter(Mandatory=$true)][string]$WrapperTag,
  [int]$StallThresholdSec = 300,
  [int]$StallCooldownSec = 600
)
# ai-pm Slack 런타임 워치독 — ai-pm-session.ps1 이 생성·기동한다. 직접 수정하지 말 것
# (본문 정본은 ai-pm-session.ps1 의 $watchdogSource heredoc). 역할: (1) app.js 생존 감시·재기동,
# (2) 처리 정체 감지·세션 강제 웨이크 — ai/strategies/ai-pm.md §운영 연속성 ③.
$ErrorActionPreference = 'SilentlyContinue'

function Write-WdLog([string]$msg) {
  try { Add-Content -Path $WatchdogLog -Value ("[{0}][watchdog] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) } catch {}
}
function Test-AppAlive {
  $p = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($AppJs, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
  return [bool]$p
}
function Start-AppOnce {
  $cmdLine = ('node --env-file="{0}" "{1}" >> "{2}" 2>> "{3}"' -f $EnvFile, $AppJs, $RuntimeLog, $RuntimeErr)
  Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmdLine -WorkingDirectory $RepoRoot -WindowStyle Hidden
}
function Read-Ts([string]$file) {
  try {
    if (Test-Path $file) {
      $v = (Get-Content $file -Raw -ErrorAction SilentlyContinue)
      if ($v) {
        $v = $v.Trim()
        $d = 0.0
        # Slack ts(초.마이크로초) — 로케일 무관 파싱(소수점 '.' 고정)
        if ($v -and [double]::TryParse($v, [System.Globalization.NumberStyles]::Float, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$d)) { return $d }
      }
    }
  } catch {}
  return $null
}
function Get-SessionPids {
  # 래퍼(WrapperTag=ai-pm-session.ps1, -File 기동) 프로세스의 claude.exe 자식 = ai-pm 세션.
  $pids = @()
  $wrap = Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($WrapperTag, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and $_.CommandLine.IndexOf('-File', [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
  foreach ($w in $wrap) {
    $pids += (Get-CimInstance Win32_Process -Filter "Name='claude.exe'" -ErrorAction SilentlyContinue |
      Where-Object { $_.ParentProcessId -eq $w.ProcessId } | Select-Object -ExpandProperty ProcessId)
  }
  return $pids
}

Write-WdLog "start (app: $AppJs, pid: $PID, stall>=${StallThresholdSec}s)"
$backoff = 5
$unprocessedSince = $null
$stallCooldownUntil = $null
$stallCount = 0
$stallWindowStart = $null
while ($true) {
  if (Test-Path $StopFlag) { Write-WdLog '.stop flag 감지 — 워치독 종료'; break }

  # (1) app.js 생존 — 죽었으면 재기동
  if (Test-AppAlive) {
    $backoff = 5
  } else {
    Write-WdLog 'app.js 사망 감지 — 재기동'
    Start-AppOnce
    Start-Sleep -Seconds 3
    if (Test-AppAlive) {
      $backoff = 5
    } else {
      Write-WdLog "재기동 직후 사망 — ${backoff}s 백오프 후 재시도"
      Start-Sleep -Seconds $backoff
      $backoff = [Math]::Min($backoff * 2, 60)
    }
  }

  # (2) 처리 정체 감지 — last-event 가 last-processed 보다 앞선 상태(미트리아지 적체)가
  #     임계 이상 지속되면 세션을 강제 재기동해 백로그를 드레인시킨다(§운영 연속성 ③ 하드 백스톱).
  #     세션 ① 자가 웨이크 루프가 멈춰도 미처리 이벤트가 방치되지 않게 하는 결정적 안전망.
  try {
    $now = Get-Date
    if ($stallCooldownUntil -and $now -lt $stallCooldownUntil) {
      # 쿨다운 중 — 직전 재기동의 드레인 대기, 판정 보류
    } elseif (Test-AppAlive) {
      $le = Read-Ts $LastEventFile
      $lp = Read-Ts $LastProcessedFile
      $gap = ($null -ne $le) -and (($null -eq $lp) -or ($le -gt $lp))
      if ($gap) {
        if (-not $unprocessedSince) { $unprocessedSince = $now }
        elseif ((($now - $unprocessedSince).TotalSeconds) -ge $StallThresholdSec) {
          if (-not $stallWindowStart -or (($now - $stallWindowStart).TotalHours -ge 1)) { $stallWindowStart = $now; $stallCount = 0 }
          if ($stallCount -ge 3) {
            Write-WdLog "처리 정체 지속 — 1시간 내 3회 재기동 초과. 자동 재기동 중단, 담당자 확인 필요 (last-event=$le last-processed=$lp)"
          } else {
            Write-WdLog "처리 정체 감지 (미트리아지 ${StallThresholdSec}s 초과, last-event=$le last-processed=$lp) — .restart + 세션 강제 웨이크"
            try { New-Item -ItemType File -Path $RestartFlag -Force | Out-Null } catch {}
            foreach ($sp in (Get-SessionPids)) { Stop-Process -Id $sp -Force -ErrorAction SilentlyContinue; Write-WdLog "  세션 PID $sp 종료(재기동 유도)" }
            $stallCount++
            $stallCooldownUntil = $now.AddSeconds($StallCooldownSec)
            $unprocessedSince = $null
          }
        }
      } else {
        $unprocessedSince = $null
      }
    }
  } catch { Write-WdLog "stall-check 예외: $($_.Exception.Message)" }

  Start-Sleep -Seconds 5
}
'@
Set-Content -Path $watchdogPs1 -Value $watchdogSource -Encoding UTF8

$wdExisting = Get-WatchdogProcess
if ($wdExisting) {
  Write-Host "[ai-pm-session] 워치독 이미 가동 중 (PID $(@($wdExisting)[0].ProcessId)) — 재사용" -ForegroundColor DarkGray
} else {
  $wdArgs = @(
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', "`"$watchdogPs1`"",
    '-AppJs', "`"$appJs`"",
    '-EnvFile', "`"$envFile`"",
    '-RuntimeLog', "`"$runtimeLog`"",
    '-RuntimeErr', "`"$runtimeErr`"",
    '-RepoRoot', "`"$repoRoot`"",
    '-StopFlag', "`"$stopFlag`"",
    '-WatchdogLog', "`"$watchdogLog`"",
    '-RestartFlag', "`"$restartFlag`"",
    '-LastEventFile', "`"$lastEventFile`"",
    '-LastProcessedFile', "`"$lastProcessedFile`"",
    '-WrapperTag', 'ai-pm-session.ps1'
  )
  $wdProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $wdArgs -WindowStyle Hidden -PassThru
  Write-Host "[ai-pm-session] 워치독 기동 (PID $($wdProc.Id)) — app.js 5초 간격 감시" -ForegroundColor DarkGray
}

# --- 세션 모델 — 봇 정의 frontmatter `model:` 단일 출처. `model fallback:` 은 1차 모델 기동 불가 시 대체 모델. ---
$primaryModel  = ''
$fallbackModel = ''
if (Test-Path $botDef) {
  $m = Select-String -Path $botDef -Pattern '^\s*model:\s*([^\s#]+)' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($m) { $primaryModel = $m.Matches[0].Groups[1].Value.Trim() }
  $mf = Select-String -Path $botDef -Pattern '^\s*model fallback:\s*([^\s#]+)' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($mf) { $fallbackModel = $mf.Matches[0].Groups[1].Value.Trim() }
}
if ($primaryModel -eq 'inherit') { $primaryModel = '' }
$activeModel = $primaryModel

# --- 세션 추론 강도(effort) — 봇 정의 frontmatter `effort:` 단일 출처(ai/strategies/agents.md §모델·추론 강도(effort) 정책).
#     CLI --effort 허용값: low/medium/high/xhigh/max. 그 외 값은 무시하고 --effort 를 부여하지 않는다(세션 기본 강도). ---
$effort = ''
if (Test-Path $botDef) {
  $e = Select-String -Path $botDef -Pattern '^\s*effort:\s*([^\s#]+)' -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($e) { $effort = $e.Matches[0].Groups[1].Value.Trim() }
}
$validEffort = @('low', 'medium', 'high', 'xhigh', 'max')
if ($effort -and ($validEffort -notcontains $effort)) {
  Write-Host "[ai-pm-session] effort '$effort' 무효값 — 무시(세션 기본 강도 사용)" -ForegroundColor Yellow
  $effort = ''
}

try {
  while ($true) {
    $claudeArgs = @('--dangerously-skip-permissions')
    if ($activeModel) { $claudeArgs += @('--model', $activeModel) }
    # 세션 도중 1차 모델 사용 불가(과부하·한도)에도 CLI 가 fallback 모델로 자동 전환하도록 지정
    if ($fallbackModel -and $activeModel -ne $fallbackModel) { $claudeArgs += @('--fallback-model', $fallbackModel) }
    # 세션 추론 강도 — 봇 정의 effort(유효값만). 미지정이면 부여하지 않는다(세션 기본).
    if ($effort) { $claudeArgs += @('--effort', $effort) }
    $claudeArgs += 'ai-pm 세션 시작'

    Write-Host ""
    Write-Host "[ai-pm-session] launching claude session..." -ForegroundColor Cyan
    Write-Host "[ai-pm-session] model : $(if ($activeModel) { $activeModel } else { '(기본)' })$(if ($fallbackModel -and $activeModel -ne $fallbackModel) { " (fallback: $fallbackModel)" })"
    Write-Host "[ai-pm-session] effort: $(if ($effort) { $effort } else { '(기본)' })"
    Write-Host "[ai-pm-session] (Slack 에서 'ai-pm 초기화' 로 자동 재기동 / Ctrl+C 또는 .stop 으로 종료)"
    Write-Host ""

    $launchStart = Get-Date
    & claude @claudeArgs
    $claudeExit = $LASTEXITCODE
    $elapsedSec = ((Get-Date) - $launchStart).TotalSeconds
    Write-Host ""
    Write-Host "[ai-pm-session] claude exited (code $claudeExit)" -ForegroundColor DarkGray

    if (Test-Path $stopFlag) {
      Remove-Item $stopFlag -Force -ErrorAction SilentlyContinue
      Write-Host "[ai-pm-session] .stop flag 감지 — 루프 종료"
      break
    }
    # 1차 모델 기동 불가(즉시 비정상 종료) → fallback 모델로 즉시 재시도. 정상 운영 후 종료(60초 이상)는 해당 없음.
    if ($claudeExit -ne 0 -and $elapsedSec -lt 60 -and $fallbackModel -and $activeModel -ne $fallbackModel) {
      Write-Host "[ai-pm-session] 모델 '$activeModel' 기동 실패 추정 (즉시 종료, code $claudeExit) — fallback '$fallbackModel' 로 재시도" -ForegroundColor Yellow
      $activeModel = $fallbackModel
      continue
    }
    if (Test-Path $restartFlag) {
      Remove-Item $restartFlag -Force -ErrorAction SilentlyContinue
      Write-Host "[ai-pm-session] .restart flag 감지 — 2초 후 재기동..." -ForegroundColor Yellow
      $activeModel = $primaryModel   # 재기동 시 1차 모델부터 다시 시도
      Start-Sleep -Seconds 2
      continue
    }

    # 비대화식(스케줄러 등)에서는 Read-Host 가 블로킹/실패한다 — 프롬프트 없이 루프를 종료한다.
    $interactive = $false
    try { $interactive = [Environment]::UserInteractive -and -not [Console]::IsInputRedirected } catch {}
    if (-not $interactive) {
      Write-Host "[ai-pm-session] 비대화식 환경 — 자연 종료로 간주하고 루프 종료"
      break
    }
    $ans = Read-Host "[ai-pm-session] 자연 종료. 재기동? (y/N)"
    if ($ans -match '^[Yy]') { Start-Sleep -Seconds 1; continue } else { break }
  }
} finally {
  # 워치독 정리 — .stop 자가 종료의 백스톱. app.js 정리보다 먼저 죽여 되살림을 막는다.
  Get-WatchdogProcess | ForEach-Object {
    Write-Host "[ai-pm-session] 워치독 종료 (PID $($_.ProcessId))" -ForegroundColor DarkGray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
  # 이 래퍼가 띄운 Slack 런타임만 정리(래퍼 기동 전부터 떠 있던 것은 건드리지 않음).
  if ($startedByWrapper) {
    Get-AppProcess | ForEach-Object {
      Write-Host "[ai-pm-session] Slack 런타임 종료 (PID $($_.ProcessId))" -ForegroundColor DarkGray
      Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
    }
  }
}
