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
  3. 경량 워치독(별도 PowerShell 프로세스)을 띄운다 — 세션이 스스로 선언한 활동 상태(_session/activity)를
     감시한다. idle(유휴)·awaiting(담당자 응답대기)이면 세션을 회수해 래퍼가 워처 대기로 복귀하게 하고,
     working(작업중)이면 경과 시간과 무관하게 개입하지 않는다(작업 중 세션 오살 금지 —
     ai/strategies/ai-pm.md §운영 연속성 ③). 세션 프로세스 사망은 아래 세션 루프가 자연히 재기동한다.
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
$activityFile      = Join-Path $sessionDir 'activity'       # 활동 상태 플래그(1행: working|awaiting|idle) — 워치독 판정의 단일 근거

New-Item -ItemType Directory -Force -Path $sessionDir | Out-Null
Remove-Item -Path $restartFlag, $stopFlag -Force -ErrorAction SilentlyContinue

# --- 실행 장비 검증 — config.json exec_machine(단일 출처)과 이 PC 의 MachineName 대조. 불일치면 기동 중단. ---
if (-not (Test-Path $configJson)) {
  throw "[ai-pm-session] $configJson 없음 — config.json(exec_machine·redmine_projects·ops_status_issue)을 두세요."
}
$botConfig = $null
try { $botConfig = Get-Content $configJson -Raw | ConvertFrom-Json } catch {}
$execMachine = $null
if ($botConfig) { $execMachine = $botConfig.exec_machine }
if (-not $execMachine) {
  throw "[ai-pm-session] config.json 에 exec_machine(지정 실행 장비) 미지정 — ai/strategies/ai-pm.md §운영 모델 참조."
}

# --- 워처(1계층) 설정 — 코드 폴링으로 '처리할 작업 유무'만 판정한다(LLM 미사용·토큰 0).
#     세션(2계층)은 작업이 있을 때만 기동한다 — ai/strategies/ai-pm.md §운영 모델(2계층). ---
$watchProjects  = @()
if ($botConfig -and $botConfig.redmine_projects) { $watchProjects = @($botConfig.redmine_projects) }
$wsTrackerId    = if ($botConfig -and $botConfig.worksession_tracker_id) { [int]$botConfig.worksession_tracker_id } else { 7 }
$watchIntervalSec   = if ($botConfig -and $botConfig.watch_interval_sec) { [int]$botConfig.watch_interval_sec } else { 60 }
$postRunCooldownSec = if ($botConfig -and $botConfig.post_run_cooldown_sec) { [int]$botConfig.post_run_cooldown_sec } else { 15 }
# 워치독 판정 설정 — activity_reap_grace_sec: 유휴·응답대기 선언 후 회수까지의 유예,
# work_warn_sec: working 선언이 이 시간 넘게 갱신되지 않으면 경고만 남긴다(회수하지 않는다).
$activityReapGraceSec = if ($botConfig -and $botConfig.activity_reap_grace_sec) { [int]$botConfig.activity_reap_grace_sec } else { 60 }
$workWarnSec          = if ($botConfig -and $botConfig.work_warn_sec) { [int]$botConfig.work_warn_sec } else { 2700 }
$stateFile = Join-Path $sessionDir 'state.json'   # 워터마크 + in-flight 레지스트리(세션 경계를 넘는 유일한 상태)
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

# --- 워치독 기동 — 세션이 선언한 활동 상태(_session/activity) 감시. 이미 떠 있으면 중복 기동하지 않는다.
#     주의: 이미 가동 중인 워치독은 옛 본문으로 계속 돌므로, 본 heredoc 을 고친 뒤에는 기존 워치독
#     프로세스를 종료해야 새 판정 로직이 적용된다(§운영 연속성 ③ — 개정 반영). ---
$watchdogSource = @'
param(
  [Parameter(Mandatory=$true)][string]$StopFlag,
  [Parameter(Mandatory=$true)][string]$WatchdogLog,
  [Parameter(Mandatory=$true)][string]$ActivityFile,
  [Parameter(Mandatory=$true)][string]$WrapperTag,
  [int]$ReapGraceSec = 60,
  [int]$WorkWarnSec = 2700
)
# ai-pm 세션 워치독 — ai-pm-session.ps1 이 생성·기동한다. 직접 수정하지 말 것
# (본문 정본은 ai-pm-session.ps1 의 $watchdogSource heredoc).
#
# 역할: 세션이 스스로 선언한 활동 상태(_session/activity)를 읽어, 세션에 할 일이 없는 상태
# (idle=유휴 / awaiting=담당자 응답대기)일 때만 프로세스를 회수한다. 헤드리스 claude 는 스스로
# 프로세스를 끝내지 못하므로, 이 회수가 래퍼를 워처(1계층) 대기로 돌려보내는 유일한 수단이다.
# working(작업중) 선언 세션은 경과 시간과 무관하게 절대 죽이지 않는다 — 작업 중 오살 금지가
# 이 워치독의 최우선 제약이다(ai/strategies/ai-pm.md §운영 연속성 ③).
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
function Get-Activity {
  # _session/activity 판독 — 1행 = 상태 토큰(working|awaiting|idle), 2행 = 자유 메모(로그용).
  # 신선도는 파일 mtime 으로 본다. 파일 부재·판독 실패·토큰 불명이면 State='' 를 반환하며,
  # 그 경우 호출측은 개입하지 않는다(판정 보류 — 작업 보존 우선).
  $res = @{ State = ''; AgeSec = 0.0; Note = '' }
  try {
    if (Test-Path $ActivityFile) {
      $item = Get-Item $ActivityFile -ErrorAction SilentlyContinue
      if ($item -and $item.LastWriteTime) { $res.AgeSec = ((Get-Date) - $item.LastWriteTime).TotalSeconds }
      $lines = @(Get-Content $ActivityFile -Encoding UTF8 -ErrorAction SilentlyContinue)
      # 선행 BOM·공백을 제거하고 판독한다 — 이 파일은 세션(LLM)이 PowerShell 아닌 도구로도 쓰므로
      # BOM 유무가 일정하지 않다. BOM 이 남으면 ^ 앵커가 빗나가 '상태 미선언' 으로 오판한다.
      if ($lines.Count -ge 1) {
        $first = (($lines[0] + '') -replace '^[\uFEFF\s]+', '').Trim()
        if ($first -match '^(working|awaiting|idle)\b') { $res.State = $Matches[1].ToLowerInvariant() }
      }
      if ($lines.Count -ge 2) { $res.Note = ($lines[1] + '').Trim() }
    }
  } catch {}
  return $res
}

Write-WdLog "start (pid: $PID, activity: $ActivityFile, reap-grace=${ReapGraceSec}s, work-warn=${WorkWarnSec}s)"
$reapCooldownUntil = $null
$lastWarnAt = $null
while ($true) {
  if (Test-Path $StopFlag) { Write-WdLog '.stop flag 감지 — 워치독 종료'; break }

  try {
    $now = Get-Date
    $sessionPids = Get-SessionPids
    if ($reapCooldownUntil -and $now -lt $reapCooldownUntil) {
      # 직전 회수 쿨다운 — 래퍼가 워처로 복귀해 다음 세션을 띄우는 사이의 판정 보류
    } elseif ($sessionPids -and $sessionPids.Count -gt 0) {
      $act = Get-Activity
      $age = [int]$act.AgeSec
      $noteSuffix = if ($act.Note) { " · $($act.Note)" } else { '' }

      if ($act.State -eq 'idle' -or $act.State -eq 'awaiting') {
        # 세션이 '할 일 없음'을 선언했다 — 회수해 래퍼를 워처(토큰 0) 대기로 돌려보낸다.
        # .restart 를 걸지 않는다: 재기동이 아니라 정상 회수이며, 다음 지시는 워처가 감지해 새 세션을 띄운다.
        if ($act.AgeSec -ge $ReapGraceSec) {
          $label = if ($act.State -eq 'idle') { '유휴' } else { '응답대기' }
          foreach ($sp in $sessionPids) { Stop-Process -Id $sp -Force -ErrorAction SilentlyContinue }
          Write-WdLog "$label 세션 회수 — PID $($sessionPids -join ',') (activity=$($act.State), ${age}s 경과) → 래퍼 워처 대기 복귀(재기동 아님)$noteSuffix"
          $reapCooldownUntil = $now.AddSeconds(30)
        }
      } elseif ($act.State -eq 'working') {
        # 작업중 — 절대 개입하지 않는다(경과 시간 무관). 비정상적으로 오래 갱신이 없으면 경고만 남긴다.
        if ($act.AgeSec -ge $WorkWarnSec -and (-not $lastWarnAt -or ($now - $lastWarnAt).TotalSeconds -ge 600)) {
          Write-WdLog "경고: activity=working 이 ${age}s 갱신 없음(임계 ${WorkWarnSec}s) — 회수하지 않음(작업 중 오살 금지). hang 이 의심되면 담당자가 직접 확인·회수한다$noteSuffix"
          $lastWarnAt = $now
        }
      } else {
        # 상태 미선언(파일 부재·판독 실패·토큰 불명) — 개입하지 않고 경고만 남긴다. 래퍼가 세션 기동
        # 직전 working 을 기록하므로 정상 운영에서는 발생하지 않는다(발생 시 파일 유실·수동 삭제).
        if (-not $lastWarnAt -or ($now - $lastWarnAt).TotalSeconds -ge 600) {
          Write-WdLog "경고: 활동 상태 미선언 — $ActivityFile 판독 불가/토큰 불명. 회수하지 않음(판정 보류)"
          $lastWarnAt = $now
        }
      }
    }
  } catch { Write-WdLog "activity-check 예외: $($_.Exception.Message)" }

  Start-Sleep -Seconds 5
}
'@
Set-Content -Path $watchdogPs1 -Value $watchdogSource -Encoding UTF8

# --- 활동 상태 기록 헬퍼 — 래퍼가 세션 기동 직전 baseline 을 선언한다. 이후 갱신은 세션(LLM)의 책임
#     (ai/strategies/ai-pm.md §세션 상태 — 활동 상태). 1행=상태 토큰, 2행=메모(워치독 로그에 표시). ---
function Set-Activity {
  param([Parameter(Mandatory=$true)][string]$State, [string]$Note = '')
  try { Set-Content -Path $activityFile -Value @($State, $Note) -Encoding UTF8 -ErrorAction SilentlyContinue } catch {}
}

# 세션이 첫 턴에서 스스로 선언하기 전 구간을 working 으로 덮어, 워치독이 '상태 미선언' 으로 보지 않게 한다.
Set-Activity -State 'working' -Note '래퍼 기동 baseline'

$wdExisting = Get-WatchdogProcess
if ($wdExisting) {
  Write-Host "[ai-pm-session] 워치독 이미 가동 중 (PID $(@($wdExisting)[0].ProcessId)) — 재사용" -ForegroundColor DarkGray
} else {
  $wdArgs = @(
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden',
    '-File', "`"$watchdogPs1`"",
    '-StopFlag', "`"$stopFlag`"",
    '-WatchdogLog', "`"$watchdogLog`"",
    '-ActivityFile', "`"$activityFile`"",
    '-ReapGraceSec', $activityReapGraceSec,
    '-WorkWarnSec', $workWarnSec,
    '-WrapperTag', $wrapperTag
  )
  $wdProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $wdArgs -WindowStyle Hidden -PassThru
  Write-Host "[ai-pm-session] 워치독 기동 (PID $($wdProc.Id)) — 활동 상태 5초 간격 감시 (유휴·응답대기만 회수, 작업중 불개입)" -ForegroundColor DarkGray
}

# --- 워처(1계층) — Redmine 을 코드로 폴링해 '처리할 작업이 있는가'만 판정한다.
#     LLM 을 쓰지 않으므로 '변화 없음' 틱의 토큰 비용이 0 이다(기존: 매 틱 max-effort 세션 턴).
#     판정 규칙은 ai/strategies/ai-pm.md §처리 대상 식별과 동일하며, 코드로 판정 가능한 조건만 쓴다. ---
function Read-AiPmState {
  if (Test-Path $stateFile) {
    try { return Get-Content $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json } catch {}
  }
  return $null
}
function Get-Watermark {
  $s = Read-AiPmState
  if ($s -and $s.watermark_journal_id) { return [int]$s.watermark_journal_id }
  return 0
}
function Get-InflightCount {
  $s = Read-AiPmState
  if ($s -and $s.inflight) { return @($s.inflight).Count }
  return 0
}
function Test-AiPmWork {
  # 반환: 처리 사유 문자열(작업 있음) 또는 $null(작업 없음).
  param([string]$Base, [string]$Key, [int]$BotUserId)
  $h = @{ 'X-Redmine-API-Key' = $Key }
  # ① in-flight 가 남아 있으면 무조건 세션 필요 — 진척 점검·완료 회신·비정상 종료 정리 대상.
  $inflight = Get-InflightCount
  if ($inflight -gt 0) { return "in-flight $inflight 건 (진척 점검·완료 회신)" }
  $wm = Get-Watermark
  foreach ($proj in $watchProjects) {
    $url = "$Base/issues.json?project_id=$proj&tracker_id=$wsTrackerId&status_id=*&limit=100"
    $list = Invoke-RestMethod -Uri $url -Headers $h -TimeoutSec 20
    foreach ($i in $list.issues) {
      # ② 담당자 차례로 넘어온 작업세션 이슈(미착수). 상태명은 인스턴스 실측 표시명(영문)으로 비교한다 —
      #    'New'=정책 이름 신규. 대응표는 ai/strategies/work-tracking-redmine.md §요소 식별자 레퍼런스.
      if ($i.status.name -eq 'New') { return "#$($i.id) 상태=$($i.status.name)" }
      # ③ 워터마크 이후 '담당자(=봇 아님)' 노트가 추가된 이슈
      $d = Invoke-RestMethod -Uri "$Base/issues/$($i.id).json?include=journals" -Headers $h -TimeoutSec 20
      foreach ($j in $d.issue.journals) {
        if ([int]$j.id -gt $wm -and $j.user -and [int]$j.user.id -ne $BotUserId) {
          return "#$($i.id) 새 노트 journal=$($j.id) by $($j.user.name)"
        }
      }
    }
  }
  return $null
}

# 워처가 쓸 Redmine 접속·봇 정체성 — 없으면 워처를 끄고 상시 세션(구 동작)으로 폴백한다.
$watchEnabled = $false
$botUserId = 0
if ($env:REDMINE_BASE_URL -and $env:REDMINE_API_KEY -and $watchProjects.Count -gt 0) {
  try {
    $me = Invoke-RestMethod -Uri "$($env:REDMINE_BASE_URL)/users/current.json" -Headers @{ 'X-Redmine-API-Key' = $env:REDMINE_API_KEY } -TimeoutSec 20
    $botUserId = [int]$me.user.id
    $watchEnabled = $true
    Write-Host "[ai-pm-session] 워처 활성 — 봇 계정 user $botUserId ($($me.user.login)), 감시 프로젝트: $($watchProjects -join ', '), 주기 ${watchIntervalSec}s" -ForegroundColor DarkGray
  } catch {
    Write-Host "[ai-pm-session] 워처 비활성 — Redmine 접속 실패($($_.Exception.Message)). 상시 세션 모드로 폴백" -ForegroundColor Yellow
  }
} else {
  Write-Host "[ai-pm-session] 워처 비활성 — REDMINE_BASE_URL/API_KEY 또는 redmine_projects 미설정. 상시 세션 모드로 폴백" -ForegroundColor Yellow
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
  $noAdvanceCount = 0   # 세션이 워터마크를 못 올린 채 연속 기동된 횟수(무한 재기동 방지)
  while ($true) {
    # --- 1계층 워처 — 처리할 작업이 생길 때까지 코드 폴링으로 대기(토큰 0). ---
    if ($watchEnabled) {
      $reason = $null
      while ($true) {
        if (Test-Path $stopFlag) { break }
        try { $reason = Test-AiPmWork -Base $env:REDMINE_BASE_URL -Key $env:REDMINE_API_KEY -BotUserId $botUserId }
        catch { Write-Host "[ai-pm-session] 워처 폴링 예외: $($_.Exception.Message)" -ForegroundColor Yellow; $reason = $null }
        if ($reason) { break }
        Start-Sleep -Seconds $watchIntervalSec
      }
      if (Test-Path $stopFlag) {
        Remove-Item $stopFlag -Force -ErrorAction SilentlyContinue
        Write-Host "[ai-pm-session] .stop flag 감지 — 워처 종료"
        break
      }
      Write-Host ""
      Write-Host "[ai-pm-session] 처리 대상 감지 → 세션 기동: $reason" -ForegroundColor Green
      # 기동 직전 활동 상태 baseline — 첫 턴이 길어도 워치독이 회수 판정하지 않도록 working 으로 둔다.
      Set-Activity -State 'working' -Note "워처 감지 기동: $reason"
    }
    $wmBefore = if ($watchEnabled) { Get-Watermark } else { 0 }

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
      # 재기동 활동 상태 baseline 갱신(새 세션 grace)
      Set-Activity -State 'working' -Note '.restart 재기동 baseline'
      Start-Sleep -Seconds 2
      continue
    }

    # --- 세션 자연 종료 — 워처 모드에서는 '작업 사이클 완료'를 뜻한다(정상). 다시 워처로 돌아가 대기한다. ---
    if ($watchEnabled) {
      $wmAfter = Get-Watermark
      $inflight = Get-InflightCount
      if ($wmAfter -le $wmBefore -and $inflight -eq 0) {
        # 워터마크가 안 올랐는데 in-flight 도 없다 = 세션이 처리 기록을 남기지 못하고 끝났다.
        # 그대로 두면 같은 사유로 무한 재기동하므로 백오프한다.
        $noAdvanceCount++
        if ($noAdvanceCount -ge 3) {
          Write-Host "[ai-pm-session] 경고: 워터마크 미갱신 세션이 ${noAdvanceCount}회 연속 — 5분 백오프(담당자 확인 필요)" -ForegroundColor Red
          Start-Sleep -Seconds 300
        } else {
          Write-Host "[ai-pm-session] 워터마크 미갱신(${noAdvanceCount}회) — ${postRunCooldownSec}s 후 재확인" -ForegroundColor Yellow
          Start-Sleep -Seconds $postRunCooldownSec
        }
      } else {
        $noAdvanceCount = 0
        Write-Host "[ai-pm-session] 작업 사이클 완료 (watermark $wmBefore→$wmAfter, in-flight $inflight) — 워처 대기로 복귀" -ForegroundColor DarkGray
        Start-Sleep -Seconds $postRunCooldownSec
      }
      continue
    }

    # --- 워처 비활성(폴백) — 기존 동작: 비대화식은 종료, 대화식은 재기동 여부 확인. ---
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
