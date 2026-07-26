<#
.SYNOPSIS
    apps/sender-sdk 빌드 스크립트 — csc.exe 직접 호출.

.DESCRIPTION
    이 PC 에는 dotnet CLI·Visual Studio·.NET Framework 타게팅 팩(Reference Assemblies)이 없다
    (build 오케스트레이터 실측). 대신 .NET Framework 런타임에 포함된 csc.exe(C# 5 언어 수준)로
    라이브러리(AccountInterlockHub.SenderSdk.dll)와 검증 하네스(AccountInterlockHub.SenderSdk.Harness.exe)를
    직접 컴파일한다.

    같은 폴더의 .csproj 파일들은 발송처(서비스 A) Visual Studio 프로젝트 참조·열람용으로만 두며
    이 스크립트는 그 파일들을 쓰지 않는다(타게팅 팩 부재로 MSBuild 빌드는 이 PC 에서 기대할 수 없다).

.EXAMPLE
    powershell -File build.ps1
#>

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$libDir = Join-Path $root 'AccountInterlockHub.SenderSdk'
$harnessDir = Join-Path $root 'AccountInterlockHub.SenderSdk.Harness'
$binDir = Join-Path $root 'bin'

$cscCandidates = @(
    'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
    'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
)
$csc = $null
foreach ($candidate in $cscCandidates) {
    if (Test-Path $candidate) {
        $csc = $candidate
        break
    }
}
if (-not $csc) {
    Write-Error ("csc.exe 를 찾을 수 없습니다. 확인한 경로: " + ($cscCandidates -join ', '))
    exit 1
}
Write-Host "csc.exe: $csc"

if (-not (Test-Path $binDir)) {
    New-Item -ItemType Directory -Path $binDir | Out-Null
}

$libOut = Join-Path $binDir 'AccountInterlockHub.SenderSdk.dll'
$harnessOut = Join-Path $binDir 'AccountInterlockHub.SenderSdk.Harness.exe'

# ---- 라이브러리 컴파일 ----
$libSources = Get-ChildItem -Path $libDir -Filter '*.cs' -Recurse | Select-Object -ExpandProperty FullName
if (-not $libSources -or $libSources.Count -eq 0) {
    Write-Error "라이브러리 소스 파일을 찾을 수 없습니다: $libDir"
    exit 1
}
Write-Host ("라이브러리 소스 " + $libSources.Count + "개 컴파일 중...")

$libArgs = @(
    '/nologo'
    '/target:library'
    '/platform:anycpu'
    '/codepage:65001'
    '/warn:4'
    "/out:$libOut"
) + $libSources

& $csc @libArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "라이브러리 컴파일 실패 (종료 코드 $LASTEXITCODE)"
    exit $LASTEXITCODE
}
Write-Host "라이브러리 컴파일 성공: $libOut"

# ---- 하네스 컴파일 (라이브러리를 참조) ----
$harnessSources = Get-ChildItem -Path $harnessDir -Filter '*.cs' -Recurse | Select-Object -ExpandProperty FullName
if (-not $harnessSources -or $harnessSources.Count -eq 0) {
    Write-Error "하네스 소스 파일을 찾을 수 없습니다: $harnessDir"
    exit 1
}
Write-Host ("하네스 소스 " + $harnessSources.Count + "개 컴파일 중...")

$harnessArgs = @(
    '/nologo'
    '/target:exe'
    '/platform:anycpu'
    '/codepage:65001'
    '/warn:4'
    "/reference:$libOut"
    "/out:$harnessOut"
) + $harnessSources

& $csc @harnessArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "하네스 컴파일 실패 (종료 코드 $LASTEXITCODE)"
    exit $LASTEXITCODE
}
Write-Host "하네스 컴파일 성공: $harnessOut"

Write-Host ""
Write-Host "빌드 완료."
Write-Host "  라이브러리: $libOut"
Write-Host "  하네스:     $harnessOut"
Write-Host ""
Write-Host "실행 예: & `"$harnessOut`" --vectors <벡터 파일 경로>"
