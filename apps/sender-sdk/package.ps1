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

    [회귀 1회차 S-1] 사용 안내 §1 의 조립 날짜(usage-guide.md 상단 문구)는 -PackageDate 로
    받는다. 생략하면 Get-Date(오늘 날짜)로 채우지 않는다 — 그러면 실행한 날마다 usage-guide.md
    바이트가 달라져 process_PROC-403.md:75("같은 산출물에서 같은 패키지·같은 체크섬")와
    어긋난다. 대신 패키지에 실제로 담기는 소스에 영향을 준 마지막 커밋 날짜를 쓴다
    (reproducible-builds.org 의 SOURCE_DATE_EPOCH 관례와 같은 취지 — 입력이 같으면 언제
    실행하든 같은 날짜가 나온다).

.PARAMETER PackageDate
    사용 안내에 적을 조립 날짜(yyyy-MM-dd). 생략하면 패키지 구성 소스(라이브러리·하네스·
    벡터·사용 안내 템플릿)에 영향을 준 마지막 git 커밋 날짜로 결정적으로 채운다.

.EXAMPLE
    powershell -File package.ps1
.EXAMPLE
    powershell -File package.ps1 -PackageDate 2026-08-01
#>

param(
    [string]$PackageDate
)

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
# 회귀 1회차 C-1(Critical, 리뷰어·tester 독립 재현): 원본 Harness.csproj 는 저장소 내부
# 빌드(csc.exe 직접 호출·apps/sender-sdk/AccountInterlockHub.SenderSdk 소스 프로젝트에 대한
# ProjectReference)를 전제로 한다. 그 소스 프로젝트는 패키지에 동봉되지 않으므로(라이브러리는
# 컴파일된 DLL 로만 동봉 — MDL-020 libraryFile) 그대로 zip 에 넣으면 수령 측 빌드가
# CS0103('InterlockRequestBuilder' 미해결)·CS0246('EncryptedPair' 미해결)로 즉시 실패한다.
# 원본 apps/sender-sdk/AccountInterlockHub.SenderSdk.Harness/**(P17 산출물)는 손대지 않는다 —
# 스테이징 사본에서만 참조를 DLL HintPath 로 치환하고, DLL 사본을 zip 안(lib\)에 함께 넣는다.
# 패키지 최상위 구성 수는 여전히 5 다 — zip 은 여전히 구성 ② 하나이며 그 안에 무엇이 몇 개
# 들었는지는 MDL-020 의 "정확히 다섯"(패키지 최상위 구성)과 무관하다.
$sampleStage = Join-Path $packageDir '_stage-sample'
New-Item -ItemType Directory -Path $sampleStage | Out-Null

# 치환 대상 원문·치환 결과 — 개행은 `n 로만 구성해 이 스크립트 파일 자체의 개행 저장 상태와
# 무관하게 항상 같은 문자열이 되도록 만든다(여기서도 배열+join 을 쓰는 이유와 같다 — P18 S-b).
$originalProjectReferenceBlock = @(
    '  <ItemGroup>'
    '    <ProjectReference Include="..\AccountInterlockHub.SenderSdk\AccountInterlockHub.SenderSdk.csproj">'
    '      <Project>{E101AB21-7E90-4C5E-98ED-ACB8DDAC2832}</Project>'
    '      <Name>AccountInterlockHub.SenderSdk</Name>'
    '    </ProjectReference>'
    '  </ItemGroup>'
) -join "`n"

$replacementReferenceBlock = @(
    '  <ItemGroup>'
    '    <Reference Include="AccountInterlockHub.SenderSdk">'
    '      <HintPath>lib\AccountInterlockHub.SenderSdk.dll</HintPath>'
    '      <SpecificVersion>False</SpecificVersion>'
    '    </Reference>'
    '  </ItemGroup>'
) -join "`n"

$originalHeaderComment = @(
    '<!--'
    '  발송처(서비스 A) Visual Studio 프로젝트 참조·프로젝트 열람용으로 함께 두는 구성 파일이다.'
    '  이 저장소 PC 에는 .NET Framework 타게팅 팩이 없어 이 파일로는 빌드하지 못한다 —'
    '  실제 빌드는 상위 폴더의 build.ps1(csc.exe 직접 호출)이 수행한다.'
    '  배포 패키지(LIB-03, P18 소관)의 "C# 호출 샘플"도 이 하네스와 같은 형태를 쓴다'
    '  (spec-functions-lib.md §배포 패키지).'
    '-->'
) -join "`n"

# 발송처에게 그대로 노출되는 문구다 — 허브 내부 사정(이 PC 의 타게팅 팩 부재·Phase 번호)을
# 담지 않고, 동봉 DLL 참조로 바로 빌드된다는 사실만 남긴다.
$replacementHeaderComment = @(
    '<!--'
    '  AccountInterlockHub 연동 라이브러리 호출 샘플(검증 하네스 겸용)이다. 이 폴더를 그대로'
    '  Visual Studio 에서 열어 빌드·실행할 수 있다 — 참조 라이브러리'
    '  (AccountInterlockHub.SenderSdk.dll) 사본이 lib\ 폴더에 함께 들어 있다. 사용법은 함께'
    '  받은 usage-guide.md §6 규약 적합성 확인 절차를 참고한다.'
    '-->'
) -join "`n"

# 회귀 1회차 재검증(§재판정 조건 ④ 실측) 중 추가로 발견한 결함 — 원본 AssemblyInfo.cs 는
# "csc.exe 직접 빌드는 이 특성을 자동으로 넣어 주지 않는다"는 이유로 TargetFramework 특성을
# 손으로 선언해 뒀다(build.ps1 소관 경로에는 맞는 이유다). 그런데 표준 MSBuild/Visual Studio
# 빌드(수령 측이 실제로 쓰는 경로)는 이 특성을 **항상 스스로 생성**하므로, 손으로 선언한
# 사본과 충돌해 CS0579 로 빌드가 실패한다 — 격리 실험으로 확인(같은 PC·같은 참조 어셈블리
# 부재 상태에서 이 선언만 제거하면 경고 2건만 남고 빌드 성공, exit code 0). 즉 CS0579 는
# 이 PC 의 타게팅 팩 부재가 아니라 이 파일 자체의 결함이며, 정상 VS 환경에서도 재현된다.
# 원본 apps/sender-sdk/AccountInterlockHub.SenderSdk.Harness/Properties/AssemblyInfo.cs 는
# 손대지 않는다(build.ps1 경로는 계속 이 선언이 필요) — 스테이징 사본에서만 걷어낸다.
$originalTargetFrameworkDecl = @(
    ''
    '// 대상 런타임 명시 — csc.exe 직접 빌드는 MSBuild 처럼 이 속성을 자동으로 넣어 주지 않으므로'
    '// 여기서 직접 선언한다(CLAUDE.env.md §연동 라이브러리 식별자 <LIB_TARGET_FRAMEWORK>).'
    '[assembly: TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]'
) -join "`n"

Get-ChildItem -Path $harnessDir -Recurse -File | Where-Object {
    $_.Extension -eq '.cs' -or $_.Extension -eq '.csproj'
} | ForEach-Object {
    $relative = $_.FullName.Substring($harnessDir.Length).TrimStart('\')
    $destPath = Join-Path $sampleStage $relative
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }

    $text = Get-NormalizedText $_.FullName
    if ($_.Extension -eq '.csproj') {
        if (-not $text.Contains($originalProjectReferenceBlock)) {
            throw "csproj 의 ProjectReference 블록을 찾지 못했습니다 — 원본이 바뀌었을 수 있습니다: $($_.FullName)"
        }
        $text = $text.Replace($originalProjectReferenceBlock, $replacementReferenceBlock)

        if (-not $text.Contains($originalHeaderComment)) {
            throw "csproj 의 머리 주석 블록을 찾지 못했습니다 — 원본이 바뀌었을 수 있습니다: $($_.FullName)"
        }
        $text = $text.Replace($originalHeaderComment, $replacementHeaderComment)
    }
    if ($relative -eq 'Properties\AssemblyInfo.cs') {
        if (-not $text.Contains($originalTargetFrameworkDecl)) {
            throw "AssemblyInfo.cs 의 TargetFramework 선언 블록을 찾지 못했습니다 — 원본이 바뀌었을 수 있습니다: $($_.FullName)"
        }
        $text = $text.Replace($originalTargetFrameworkDecl, '')
    }
    Write-NormalizedFile $destPath $text
}

# 참조가 성립하도록 DLL 사본을 zip 안(lib\)에 함께 넣는다 — 시각 고정(아래) 이전 단계라
# 이 DLL 도 다른 스테이징 파일과 똑같이 고정 시각을 받는다.
$sampleLibDir = Join-Path $sampleStage 'lib'
New-Item -ItemType Directory -Path $sampleLibDir | Out-Null
Copy-Item -Path $libDll -Destination (Join-Path $sampleLibDir 'AccountInterlockHub.SenderSdk.dll') -Force

# ZIP 엔트리는 파일마다 수정 시각을 담는다 — 내용이 완전히 같아도 스테이징 시각(지금)이
# 실행마다 달라지면 zip 바이트 자체가 달라져 체크섬이 흔들린다(P18 S-b 재실행 실측에서
# 실제로 발견된 결정성 문제 — 최초 구현은 이 원인을 놓쳐 재현 실패했다). 압축 직전 모든
# 스테이징 파일·폴더의 시각을 고정값으로 못박아 zip 바이트를 내용에만 좌우되게 만든다.
# [회귀 1회차 S-3] 이 결정성은 "같은 실행 환경" 전제다 — Compress-Archive 가 내는 바이트
# (엔트리 순서·압축 스트림)는 .NET/PowerShell 구현체 버전에 의존할 수 있다. 이 스크립트는
# 같은 PC·같은 PowerShell 버전에서의 재실행 결정성만 실측했고(§P18 S-b 보고), 서로 다른
# OS·PowerShell 버전 간 바이트 동일까지는 보장하지 않는다.
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

# [회귀 1회차 S-1] -PackageDate 를 안 받았으면 오늘 날짜(Get-Date)로 채우지 않는다 — 그러면
# 실행할 때마다 usage-guide.md 바이트가 달라져 SHA256SUMS.txt 도 매일 흔들린다(process_PROC
# -403.md:75 "같은 산출물에서 같은 패키지·같은 체크섬"과 어긋남 — S-b 결정성 취지 훼손).
# 대신 패키지가 실제로 담는 소스(라이브러리·하네스·벡터·사용 안내 템플릿)에 영향을 준 마지막
# git 커밋 날짜를 쓴다 — 소스가 그대로면 언제 조립하든 같은 날짜가 나온다.
if ([string]::IsNullOrWhiteSpace($PackageDate)) {
    Push-Location $root
    try {
        $gitDate = & git log -1 --format=%cs -- `
            'AccountInterlockHub.SenderSdk' `
            'AccountInterlockHub.SenderSdk.Harness' `
            'protocol-test-vectors.json' `
            'packaging/usage-guide.template.md' 2>$null
    } finally {
        Pop-Location
    }
    if ([string]::IsNullOrWhiteSpace($gitDate)) {
        throw ("PackageDate 를 결정하지 못했습니다 — git 이력을 찾지 못했습니다(git 미설치 " +
               "또는 해당 경로에 커밋 없음). -PackageDate yyyy-MM-dd 인자로 명시적으로 지정하세요.")
    }
    $PackageDate = $gitDate.Trim()
}
if ($PackageDate -notmatch '^\d{4}-\d{2}-\d{2}$') {
    throw "PackageDate 형식이 올바르지 않습니다(yyyy-MM-dd 이어야 함): $PackageDate"
}

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
    Replace('{{PACKAGE_DATE}}', $PackageDate).
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
