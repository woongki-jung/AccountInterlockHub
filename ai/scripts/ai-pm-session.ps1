<#
.SYNOPSIS
  ai-pm 단일 세션 래퍼 — Redmine 폴링 세션 기동 + 처리 정체 워치독 + 세션 자동 재기동.

.DESCRIPTION
  0. config.json 의 exec_machine(지정 실행 장비)과 이 PC 의 MachineName 을 대조해 불일치하면 기동을 중단한다
     (복제 워크스페이스가 있는 다른 PC 의 중복 기동 방지 — ai/strategies/ai-pm.md §운영 모델).
  1. ai/bots/ai-pm/.env 에서 Redmine 자격(있으면)을 세션 env 로 주입한다(자식 Redmine MCP 가 그 정체성으로 작동).
     없으면 Redmine MCP 는 서버 기본(admin) 키로 폴백한다(D:\redmine\.env). 봇은 admin 으로 동작한다.
  2. ai-pm 전용 MCP 큐레이션 — ~/.claude.json 에서 Redmine MCP 만 추린 설정으로 --strict-mcp-config 기동해
     인증 필요한 claude.ai 커넥터·Playwright MCP 가 detached 세션 startup 을 막는 것을 회피한다.
  3. 경량 워치독(별도 PowerShell 프로세스)을 띄운다 — 세션 프로세스 생존과 '폴링 하트비트'(_session/last-poll)
     신선도를 감시한다. 세션이 살아 있는데 하트비트가 임계 이상 정체하면(자가 웨이크 폴링 정지) .restart 를
     설정하고 세션을 강제 종료해 재기동을 유도한다(ai/strategies/ai-pm.md §운영 연속성 ③). 세션 프로세스
     사망은 아래 세션 루프가 자연히 재기동한다.
  4. `claude --dangerously-skip-permissions 'ai-pm 세션 시작'` 를 루프로 실행한다. 매 종료 후
     ai/bots/ai-pm/_session/ 의 플래그를 확인: .restart → 즉시 재기동 / .stop → 종료 / (없음) → 재기동 여부 확인.
  세부 동작은 ai/strategies/ai-pm.md 참조. 단일 세션 — 둘 이상 띄우지 않는다.
  (Slack 기반 런타임 app.js·post.js·runtime.log 는 2026-07-18 폐지 — Redmine 폴링 전환.)

.EXAMPLE
  pwsh -File ai/scripts/ai-pm-session.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$repoRoot = (Resolve-Path "$PSScriptRoot\..\..").Path
Set-Location $repoRoot

$botDir      = Join-Path $repoRoot 'ai\bots\ai-pm'
$sessionDir  = Join-Path $botDir '_session'
$configJson  = Join-Path $botDir 'config.json'
$envFile     = Join-Path $botDir '.env'          # 선택 — Redmine 전용 키(없으면 MCP 서버 기본 admin 폴백)
$botDef      = Join-Path $botDir 'ai-pm.md'
$mcpCurateJs = Join-Path $botDir 'mcp-curate.js'
$restartFlag = Join-Path $sessionDir '.restart'
$stopFlag    = Join-Path $sessionDir '.stop'
$watchdogPs1 = Join-Path $sessionDir 'watchdog.ps1'
$watchdogLog = Join-Path $sessionDir 'watchdog.log'
$lastProcessedFile = Join-Path $sessionDir 'last-processed' # 세션이 트리아지한 최신 Redmine 변경 좌표(값)
$lastPollFile      = Join-Path $sessionDir 'last-poll'      # 폴링 하트비트(세션이 매 틱 touch, mtime 감시)

New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null
Remove-Item -Path $restartFlag, $stopFlag -Force -ErrorAction SilentlyContinue

# --- 실행 장비 검증 — config.json exec_machine(단일 출처)과 이 PC 의 MachineName 대조. 불일치면 기동 중단. ---
if (-not (Test-Path $configJson)) {
  throw "[ai-pm-session] $configJson 없음 — config.json(exec_machine·redmine_projects·ops_status_issue)을 두세요."
}
$execMachine = $null
try { $execMachine = (Get-Content $configJson -Raw | ConvertFrom-Json).exec_machine } catch {}
if (-not $execMachine) {
  throw "[ai-pm-session] config.json 에 exec_machine(지정 실행 장비) 미지정 — ai/strategies/ai-pm.md §운영 모델 참조."
}
if ($env:COMPUTERNAME -ne $execMachine) {
  throw "[ai-pm-session] 실행 장비 불일치 — 지정: $execMachine / 현재: $env:COMPUTERNAME. ai-pm 은 지정 실행 장비에서만 기동한다."
}

# --- Redmine 자격 주입 (선택) — ai/bots/ai-pm/.env 있으면 자식 Redmine MCP 가 이 정체성으로 작동.
#     없으면 Redmine MCP 서버가 D:\redmine\.env 의 기본 admin 키로 폴백한다(README 참조). ---
if (Test-Path $envFile) {
  foreach ($line in Get-Content $envFile) {
    if ($line -match '^\s*(REDMINE_API_KEY|REDMINE_BASE_URL)\s*=\s*(.+?)\s*$') {
      Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
    }
  }
}
if ($env:REDMINE_API_KEY) {
  Write-Host "[ai-pm-session] Redmine: 전용 키 주입됨" -ForegroundColor DarkGray
} else {
  Write-Host "[ai-pm-session] Redmine: 전용 키 없음 — MCP 는 서버 기본 admin 키로 폴백" -ForegroundColor Yellow
}

# --- 공용 헬퍼 — 이 래퍼(WrapperTag)가 기동한 claude 세션·워치독 판별. ---
$wrapperTag = 'ai-pm-session.ps1'
function Get-WatchdogProcess {
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe' OR Name='pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($watchdogPs1, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }
}

# --- ai-pm 전용 MCP 큐레이션 — 인증 필요한 claude.ai 커넥터(Figma·Google 등)와 Playwright MCP 는
#     detached 세션의 MCP 초기화 단계를 막아 세션이 첫 턴에 도달하지 못하게 한다(ai/strategies/ai-pm.md
#     §운영 연속성 — 기동 블로킹 회피). ai-pm 은 Redmine MCP 만 필요하므로, ~/.claude.json 의 redmine
#     서버만 추린 설정으로 --strict-mcp-config 기동해 다른 MCP 소스를 전부 무시한다. ---
$curatedMcp = Join-Path $sessionDir 'ai-pm.mcp.json'
$mcpArgs = @('--strict-mcp-config')
if (Test-Path $mcpCurateJs) {
  # node 로 ~/.claude.json 에서 redmine 서버만 추려 큐레이트 설정 생성(PS 5.1 ConvertFrom-Json 은 대용량 .claude.json 실패).
  $curateOut = (& node $mcpCurateJs $curatedMcp) -join ''
  if ($LASTEXITCODE -eq 0 -and $curateOut -match 'OK' -and (Test-Path $curatedMcp)) {
    $mcpArgs += @('--mcp-config', $curatedMcp)
    Write-Host "[ai-pm-session] MCP 큐레이션: Redmine 전용 (claude.ai 커넥터·Playwright 제외로 startup 블로킹 회피)" -ForegroundColor DarkGray
  } else {
    Write-Host "[ai-pm-session] MCP 큐레이션 결과='$curateOut' — Redmine 미발견/실패, MCP 없이 기동(--strict-mcp-config)" -ForegroundColor Yellow
  }
} else {
  Write-Host "[ai-pm-session] mcp-curate.js 없음 — MCP 없이 기동(--strict-mcp-config)" -ForegroundColor Yellow
}

# --- 워치독 기동 — 세션 프로세스 생존 + 폴링 하트비트 정체 감시. 이미 떠 있으면 중복 기동하지 않는다. ---
$watchdogSource = @'
param(
  [Parameter(Mandatory=$true)][string]$StopFlag,
  [Parameter(Mandatory=$true)][string]$RestartFlag,
  [Parameter(Mandatory=$true)][string]$WatchdogLog,
  [Parameter(Mandatory=$true)][string]$LastPollFile,
  [Parameter(Mandatory=$true)][string]$WrapperTag,
  [int]$StallThresholdSec = 300,
  [int]$StallCooldownSec = 600
)
# ai-pm 폴링 세션 워치독 — ai-pm-session.ps1 이 생성·기동한다. 직접 수정하지 말 것
# (본문 정본은 ai-pm-session.ps1 의 $watchdogSource heredoc). 역할: 세션이 살아 있는데
# 폴링 하트비트(last-poll)가 임계 이상 정체하면(자가 웨이크 정지) 세션을 강제 재기동해
# 백로그를 드레인시킨다 — ai/strategies/ai-pm.md §운영 연속성 ③ 하드 백스톱.
$ErrorActionPreference = 'SilentlyContinue'

function Write-WdLog([string]$msg) {
  try { Add-Content -Path $WatchdogLog -Value ("[{0}][watchdog] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg) } catch {}
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
function Get-PollAgeSec {
  # 폴링 하트비트 신선도(초). 파일 없으면 $null(아직 첫 폴링 전 — 판정 보류).
  try {
    if (Test-Path $LastPollFile) {
      $mt = (Get-Item $LastPollFile -ErrorAction SilentlyContinue).LastWriteTime
      if ($mt) { return ((Get-Date) - $mt).TotalSeconds }
    }
  } catch {}
  return $null
}

Write-WdLog "start (pid: $PID, stall>=${StallThresholdSec}s, heartbeat: $LastPollFile)"
$stallCooldownUntil = $null
$stallCount = 0
$stallWindowStart = $null
while ($true) {
  if (Test-Path $StopFlag) { Write-WdLog '.stop flag 감지 — 워치독 종료'; break }

  try {
    $now = Get-Date
    $sessionPids = Get-SessionPids
    if ($stallCooldownUntil -and $now -lt $stallCooldownUntil) {
      # 쿨다운 중 — 직전 재기동의 드레인 대기, 판정 보류
    } elseif ($sessionPids -and $sessionPids.Count -gt 0) {
      # 세션 생존 — 폴링 하트비트 정체 감지
      $age = Get-PollAgeSec
      if (($null -ne $age) -and ($age -ge $StallThresholdSec)) {
        if (-not $stallWindowStart -or (($now - $stallWindowStart).TotalHours -ge 1)) { $stallWindowStart = $now; $stallCount = 0 }
        if ($stallCount -ge 3) {
          Write-WdLog "폴링 정체 지속 — 1시간 내 3회 재기동 초과. 자동 재기동 중단, 담당자 확인 필요 (poll-age=${age}s)"
        } else {
          Write-WdLog "폴링 정체 감지 (하트비트 ${age}s 정체 >= ${StallThresholdSec}s) — .restart + 세션 강제 재기동"
          try { New-Item -ItemType File -Path $RestartFlag -Force | Out-Null } catch {}
          foreach ($sp in $sessionPids) { Stop-Process -Id $sp -Force -ErrorAction SilentlyContinue; Write-WdLog "  세션 PID $sp 종료(재기동 유도)" }
          $stallCount++
          $stallCooldownUntil = $now.AddSeconds($StallCooldownSec)
        }
      }
    }
  } catch { Write-WdLog "stall-check 예외: $($_.Exception.Message)" }

  Start-Sleep -Seconds 5
}
'@
Set-Content -Path $watchdogPs1 -Value $watchdogSource -Encoding UTF8

# 세션에 폴링 하트비트 baseline 부여 — 첫 폴링 전 워치독 오탐 방지(기동 직후 grace).
Set-Content -Path $lastPollFile -Value ((Get-Date).ToString('o')) -Encoding UTF8 -ErrorAction SilentlyContinue

$wdExisting = Get-WatchdogProcess
if ($wdExisting) {
  Write-Host "[ai-pm-session] 워치독 이미 가동 중 (PID $(@($wdExisting)[0].ProcessId)) — 재사용" -ForegroundColor DarkGray
} else {
  $wdArgs = @(
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', "`"$watchdogPs1`"",
    '-StopFlag', "`"$stopFlag`"",
    '-RestartFlag', "`"$restartFlag`"",
    '-WatchdogLog', "`"$watchdogLog`"",
    '-LastPollFile', "`"$lastPollFile`"",
    '-WrapperTag', $wrapperTag
  )
  $wdProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $wdArgs -WindowStyle Hidden -PassThru
  Write-Host "[ai-pm-session] 워치독 기동 (PID $($wdProc.Id)) — 세션 생존·폴링 하트비트 5초 간격 감시" -ForegroundColor DarkGray
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
    if ($mcpArgs) { $claudeArgs += $mcpArgs }
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
    Write-Host "[ai-pm-session] (Redmine 에서 'ai-pm 초기화' 노트로 자동 재기동 / Ctrl+C 또는 .stop 으로 종료)"
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
      # 재기동 하트비트 baseline 갱신(새 세션 grace)
      Set-Content -Path $lastPollFile -Value ((Get-Date).ToString('o')) -Encoding UTF8 -ErrorAction SilentlyContinue
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
  # 워치독 정리 — .stop 자가 종료의 백스톱.
  Get-WatchdogProcess | ForEach-Object {
    Write-Host "[ai-pm-session] 워치독 종료 (PID $($_.ProcessId))" -ForegroundColor DarkGray
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
