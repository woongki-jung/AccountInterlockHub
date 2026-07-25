<#
.SYNOPSIS
    apps/sender-sdk 배포 패키지(LIB-03) 조립 스크립트.

.DESCRIPTION
    build.ps1 산출물(라이브러리)과 하네스 소스(C# 호출 샘플)·규약 테스트 벡터(LIB-04)·
    사용 안내 템플릿을 정확히 5개 구성으로 묶어 dist-package\ 에 낸다
    (docs/specs/functions/spec-functions-lib.md §배포 패키지 · MDL-020). dist-package\ 는
    빌드 산출물이라 git 비관리다(.gitignore).

    ① AccountInterlockHub.SenderSdk.dll                 — 라이브러리 파일
    ② AccountInterlockHub.SenderSdk.Harness-Sample.zip   — C# 호출 샘플(검증 하네스와 같은 형태)
    ③ usage-guide.md                                     — 사용 안내(6절)
    ④ protocol-test-vectors.json                         — 규약 테스트 벡터
    ⑤ SHA256SUMS.txt                                     — 무결성 확인 수단(①~④ 의 체크섬)

    P18 S-b(체크섬 결정성 — SHA256SUMS.txt 는 파일 바이트 체크섬이라 체크아웃 개행 설정에
    따라 흔들릴 수 있었다):
      (가) 체크섬은 "패키지 산출 파일"(본 스크립트가 dist-package\ 에 조립한 바이트) 기준으로
           계산한다 — 워킹트리 원본을 직접 해싱하지 않는다. 텍스트 구성 요소(②의 소스·③·④)는
           조립 시 개행을 LF 로 정규화한다(Get-NormalizedText/Write-NormalizedFile) — 이
           정규화는 체크아웃 환경(core.autocrlf 등)과 무관하게 항상 같은 바이트를 낸다.
      (나) 저장소 차원에서도 apps/sender-sdk/** 의 개행을 LF 로 고정하는 루트 .gitattributes
           를 함께 도입했다 — 워킹트리 원본 자체도 체크아웃 즉시 안정된 바이트를 갖게 해
           (가)의 정규화가 대개는 항등 변환이 되도록 만든다(이중 방어. 다른 doer 작업 경로에는
           영향이 없도록 apps/sender-sdk/** 로만 한정했다).
    두 처리 모두 있어야 "워킹트리 파일을 직접 복사"하는 실수 하나로 결정성이 깨지지 않는다 —
    (가)가 이 스크립트 자체의 정확성을 보장하는 주된 장치이고, (나)는 저장소 차원의 보조 방어다.

.EXAMPLE
    powershell -File package.ps1
#>

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$binDir = Join-Path $root 'bin'
$libDll = Join-Path $binDir 'AccountInterlockHub.SenderSdk.dll'
$harnessDir = Join-Path $root 'AccountInterlockHub.SenderSdk.Harness'
$vectorsFile = Join-Path $root 'protocol-test-vectors.json'
$templateFile = Join-Path $root 'packaging\usage-guide.template.md'
$envFile = Join-Path $root '..\..\CLAUDE.env.md'
$packageDir = Join-Path $root 'dist-package'

# ---- 사전 확인 ----
if (-not (Test-Path $libDll)) {
    Write-Error "라이브러리 DLL 이 없습니다. 먼저 build.ps1 을 실행하세요: $libDll"
    exit 1
}
if (-not (Test-Path $vectorsFile)) {
    Write-Error "규약 테스트 벡터가 없습니다. 먼저 generate-vectors.ps1 을 실행하세요: $vectorsFile"
    exit 1
}
if (-not (Test-Path $templateFile)) {
    Write-Error "사용 안내 템플릿이 없습니다: $templateFile"
    exit 1
}
if (-not (Test-Path $envFile)) {
    Write-Error "CLAUDE.env.md 를 찾을 수 없습니다(단일 출처): $envFile"
    exit 1
}

# ---- 정리 후 새로 생성 ----
if (Test-Path $packageDir) {
    Remove-Item -Recurse -Force $packageDir
}
New-Item -ItemType Directory -Path $packageDir | Out-Null

# ---- 텍스트 정규화 유틸 (P18 S-b) ----
function Get-NormalizedText([string]$path) {
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    return $raw.Replace("`r`n", "`n").Replace("`r", "`n")
}
function Write-NormalizedFile([string]$path, [string]$text) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

# ---- ① 라이브러리 파일 (바이너리 그대로 복사 — 개행 정규화 대상 아님) ----
Copy-Item -Path $libDll -Destination (Join-Path $packageDir 'AccountInterlockHub.SenderSdk.dll') -Force

# ---- ② C# 호출 샘플 — 하네스 소스를 정규화 후 zip (검증 하네스와 같은 형태 재사용) ----
$sampleStage = Join-Path $packageDir '_stage-sample'
New-Item -ItemType Directory -Path $sampleStage | Out-Null
Get-ChildItem -Path $harnessDir -Recurse -File | Where-Object {
    $_.Extension -eq '.cs' -or $_.Extension -eq '.csproj'
} | ForEach-Object {
    $relative = $_.FullName.Substring($harnessDir.Length).TrimStart('\')
    $destPath = Join-Path $sampleStage $relative
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
    Write-NormalizedFile $destPath (Get-NormalizedText $_.FullName)
}

# ZIP 엔트리는 파일마다 수정 시각을 담는다 — 내용이 완전히 같아도 스테이징 시각(지금)이
# 실행마다 달라지면 zip 바이트 자체가 달라져 체크섬이 흔들린다(P18 S-b 재실행 실측에서
# 실제로 발견된 결정성 문제 — 최초 구현은 이 원인을 놓쳐 재현 실패했다). 압축 직전 모든
# 스테이징 파일·폴더의 시각을 고정값으로 못박아 zip 바이트를 내용에만 좌우되게 만든다.
$fixedTimestamp = Get-Date -Date '2000-01-01T00:00:00'
Get-ChildItem -Path $sampleStage -Recurse -Force | ForEach-Object {
    $_.CreationTime = $fixedTimestamp
    $_.LastWriteTime = $fixedTimestamp
    $_.LastAccessTime = $fixedTimestamp
}

$sampleZip = Join-Path $packageDir 'AccountInterlockHub.SenderSdk.Harness-Sample.zip'
Compress-Archive -Path (Join-Path $sampleStage '*') -DestinationPath $sampleZip -CompressionLevel Optimal
Remove-Item -Recurse -Force $sampleStage

# ---- ③ 사용 안내 — 템플릿 + CLAUDE.env.md 값 치환 (그 시점 확정 값을 가져와 채운다) ----
function Get-EnvConstant([string]$envText, [string]$key) {
    # `<KEY>` | `값` (**잠정**) | ... 형태의 상수표 행에서 두 번째 칸을 뽑는다.
    $pattern = '\|\s*`<' + [regex]::Escape($key) + '>`\s*\|\s*(.+?)\s*\|'
    $m = [regex]::Match($envText, $pattern)
    if (-not $m.Success) {
        throw "CLAUDE.env.md 에서 <$key> 값을 찾을 수 없습니다(표 형식이 바뀌었을 수 있습니다)."
    }
    return $m.Groups[1].Value.Trim()
}
function Format-ConstantCell([string]$raw) {
    $isProvisional = $raw -match '\*\*잠정\*\*'
    $valueMatch = [regex]::Match($raw, '`([^`]+)`')
    $value = if ($valueMatch.Success) { $valueMatch.Groups[1].Value } else { $raw }
    if ($isProvisional) {
        return "$value (**잠정** — 배포 전 확정 값으로 교체 필요. 이 값으로 운영 배포 금지)"
    }
    return $value
}

$envText = Get-NormalizedText $envFile
$hubProdCell = Format-ConstantCell (Get-EnvConstant $envText 'HUB_BASE_URL_PROD')
$hubDevCell = Format-ConstantCell (Get-EnvConstant $envText 'HUB_BASE_URL_DEV')

# 규약 버전은 이 스크립트가 따로 하드코딩하지 않는다 — 이미 만든 protocol-test-vectors.json
# 의 protocolVersion 값(= VectorGen 이 InterlockRequestBuilder.ProtocolVersion 을 그대로 읽어
# 적은 값, 곧 컴파일된 라이브러리 자신의 값)을 그대로 가져와 쓴다. 값을 두 곳에 중복해
# 두면 규약 개정 시(SEC-001-12) 한쪽만 갱신되는 사고가 날 수 있다.
$vectorsForVersion = (Get-NormalizedText $vectorsFile) | ConvertFrom-Json
$protocolVersion = $vectorsForVersion.protocolVersion
if ([string]::IsNullOrWhiteSpace($protocolVersion)) {
    throw "규약 테스트 벡터(protocol-test-vectors.json)에서 protocolVersion 값을 읽지 못했습니다."
}

$templateText = Get-NormalizedText $templateFile
$guideText = $templateText.
    Replace('{{HUB_BASE_URL_PROD}}', $hubProdCell).
    Replace('{{HUB_BASE_URL_DEV}}', $hubDevCell).
    Replace('{{PACKAGE_DATE}}', (Get-Date -Format 'yyyy-MM-dd')).
    Replace('{{PROTOCOL_VERSION}}', $protocolVersion)

if ($guideText -match '\{\{[A-Z_]+\}\}') {
    throw "사용 안내에 치환되지 않은 자리표시자가 남아 있습니다: $($Matches[0])"
}

Write-NormalizedFile (Join-Path $packageDir 'usage-guide.md') $guideText

# ---- ④ 규약 테스트 벡터 — 정규화 후 복사 ----
Write-NormalizedFile (Join-Path $packageDir 'protocol-test-vectors.json') (Get-NormalizedText $vectorsFile)

# ---- ⑤ SHA256SUMS.txt — 위 4개 파일(패키지 산출 파일) 기준. 자기 자신은 대상에서 제외(이 시점엔 아직 없음) ----
$checksumEntries = @()
Get-ChildItem -Path $packageDir -File | Sort-Object Name | ForEach-Object {
    $hash = (Get-FileHash -Algorithm SHA256 -Path $_.FullName).Hash.ToLowerInvariant()
    $checksumEntries += "$hash  $($_.Name)"
}
$checksumText = ($checksumEntries -join "`n") + "`n"
Write-NormalizedFile (Join-Path $packageDir 'SHA256SUMS.txt') $checksumText

Write-Host ""
Write-Host "패키지 조립 완료: $packageDir"
$fileCount = (Get-ChildItem -Path $packageDir -File | Measure-Object).Count
Write-Host "구성 파일 수: $fileCount (기대값 5)"
Get-ChildItem -Path $packageDir -File | Sort-Object Name | ForEach-Object { Write-Host "  - $($_.Name)" }
