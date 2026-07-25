<#
.SYNOPSIS
    apps/sender-sdk 규약 테스트 벡터(protocol-test-vectors.json) 생성 스크립트.

.DESCRIPTION
    AccountInterlockHub.SenderSdk.VectorGen 콘솔 도구를 csc.exe 로 빌드하고 실행해
    protocol-test-vectors.json 을 (재)생성한다(LIB-04 · PROC-404 L1~L3 "벡터 생성 절차").
    이 도구는 배포 패키지에 동봉되는 산출물이 아니다 — 저장소 내부 개발 도구다
    (build.ps1 과 같은 성격).

    라이브러리(bin\AccountInterlockHub.SenderSdk.dll)가 먼저 빌드돼 있어야 한다 —
    없으면 이 스크립트가 build.ps1 을 먼저 실행한다.

.EXAMPLE
    powershell -File generate-vectors.ps1
#>

$ErrorActionPreference = 'Stop'

$root = $PSScriptRoot
$binDir = Join-Path $root 'bin'
$libDll = Join-Path $binDir 'AccountInterlockHub.SenderSdk.dll'
$vectorGenDir = Join-Path $root 'AccountInterlockHub.SenderSdk.VectorGen'
$vectorGenOut = Join-Path $binDir 'AccountInterlockHub.SenderSdk.VectorGen.exe'
$outputVectors = Join-Path $root 'protocol-test-vectors.json'

if (-not (Test-Path $libDll)) {
    Write-Host "라이브러리 DLL 이 없어 build.ps1 을 먼저 실행합니다..."
    & (Join-Path $root 'build.ps1')
    if ($LASTEXITCODE -ne 0) {
        Write-Error "build.ps1 실패 (종료 코드 $LASTEXITCODE)"
        exit $LASTEXITCODE
    }
}

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

$vectorGenSources = Get-ChildItem -Path $vectorGenDir -Filter '*.cs' -Recurse | Select-Object -ExpandProperty FullName
if (-not $vectorGenSources -or $vectorGenSources.Count -eq 0) {
    Write-Error "VectorGen 소스 파일을 찾을 수 없습니다: $vectorGenDir"
    exit 1
}

$vectorGenArgs = @(
    '/nologo'
    '/target:exe'
    '/platform:anycpu'
    '/codepage:65001'
    '/warn:4'
    "/reference:$libDll"
    "/out:$vectorGenOut"
) + $vectorGenSources

& $csc @vectorGenArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "VectorGen 컴파일 실패 (종료 코드 $LASTEXITCODE)"
    exit $LASTEXITCODE
}
Write-Host "VectorGen 컴파일 성공: $vectorGenOut"

& $vectorGenOut $outputVectors
if ($LASTEXITCODE -ne 0) {
    Write-Error "벡터 생성 실행 실패 (종료 코드 $LASTEXITCODE)"
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "규약 테스트 벡터 생성 완료: $outputVectors"
