---
name: build-installer
description: 코드 생성 완료 후 Debug/Release 모드 인스톨러를 빌드하고 결과를 보고합니다.
model: sonnet
color: green
memory: project
---
본 문서는 코드 생성이 완료된 후 `apps/YSRCRMv2.NET/build.bat`를 실행하여 Debug/Release 인스톨러를 빌드하는 프로세스를 정의한다.

# 빌드 산출물

| 파일 | 대상 | API 서버 |
|------|------|---------|
| `YSRCRMv2_App_Setup_Debug_{ver}.exe` | App + Migrator + Updator | 개발 서버 (`devn-*`) |
| `YSRCRMv2_App_Setup_Release_{ver}.exe` | App + Migrator + Updator | 운영 서버 |
| `YSRCRMv2_Agent_Setup_Debug_{ver}.exe` | Agent | 개발 서버 (`devn-*`) |
| `YSRCRMv2_Agent_Setup_Release_{ver}.exe` | Agent | 운영 서버 |

# 작업 프로세스

## 1단계: 사전 조건 확인

빌드에 필요한 도구와 파일이 준비되어 있는지 확인한다.

### 1-1. 필수 파일 확인
다음 파일이 존재하는지 확인한다:
- `apps/YSRCRMv2.NET/build.bat`
- `apps/YSRCRMv2.NET/YSRCRMv2.NET.sln`
- `apps/YSRCRMv2.NET/Deploy/YSRCRMv2.NET.App.iss`
- `apps/YSRCRMv2.NET/Deploy/YSRCRMv2.NET.Agent.iss`
- `apps/YSRCRMv2.Node/YSRCRMv2.Node.App.UI/package.json`

파일이 없으면 해당 항목을 Block으로 기록하고 계속 진행한다.

### 1-2. 빌드 도구 확인
다음 명령어로 도구 설치 여부를 확인한다:

```bash
# MSBuild 확인 (필수)
ls "C:/Program Files/Microsoft Visual Studio/2022" 2>/dev/null || \
ls "C:/Program Files (x86)/Microsoft Visual Studio/2019" 2>/dev/null || \
echo "MSBuild 미설치"

# Node.js 확인 (필수)
node --version 2>/dev/null || echo "Node.js 미설치"

# InnoSetup 확인 (선택)
ls "C:/Program Files (x86)/Inno Setup 6/ISCC.exe" 2>/dev/null || echo "InnoSetup 미설치"

# ConfuserEx 확인 (선택)
which Confuser.CLI 2>/dev/null || echo "ConfuserEx 미설치"
```

- MSBuild 또는 Node.js 미설치 → 해당 빌드 단계를 Block으로 기록, 인스톨러 빌드로 진행 불가
- InnoSetup 미설치 → 인스톨러 생성 단계를 Block으로 기록, 코드 빌드는 계속 진행

## 2단계: 빌드 실행

`apps/YSRCRMv2.NET/` 디렉토리에서 `build.bat`를 실행한다.

```bash
cd apps/YSRCRMv2.NET
cmd /c build.bat BOTH
```

- `BOTH` 파라미터: Debug + Release 모두 빌드
- 빌드 실패 시 오류 메시지를 기록하고 3단계로 이행한다
- 타임아웃: 30분 (대형 솔루션 빌드 고려)

### 빌드 결과 경로
```
apps/YSRCRMv2.NET/
├── dist/
│   ├── debug/          ← Debug 빌드 산출물
│   │   ├── Agent/
│   │   ├── App/
│   │   ├── Migrator/
│   │   └── Updator/
│   └── release/        ← Release 빌드 산출물
│       ├── Agent/
│       ├── App/
│       ├── Migrator/
│       └── Updator/
└── Deploy/
    └── Output/         ← 인스톨러 .exe 파일
```

## 3단계: 결과 확인 및 보고

빌드 결과를 확인하고 현재 Phase 문서에 기록한다.

### 3-1. 인스톨러 파일 확인
```bash
ls apps/YSRCRMv2.NET/Deploy/Output/*.exe 2>/dev/null
```

다음 4개 파일이 존재하는지 확인한다:
- `YSRCRMv2_App_Setup_Debug_*.exe`
- `YSRCRMv2_App_Setup_Release_*.exe`
- `YSRCRMv2_Agent_Setup_Debug_*.exe`
- `YSRCRMv2_Agent_Setup_Release_*.exe`

### 3-2. 결과 판정

| 상황 | 판정 | 대응 |
|------|------|------|
| 4개 모두 생성 | ✅ 완료 | 다음 단계 이행 |
| InnoSetup 미설치로 .exe 없음 | ⚠️ Block | 수동 실행 항목으로 기록 |
| MSBuild 실패로 dist/ 없음 | ❌ 실패 | 오류 내용 기록, closer로 이행 |
| 일부만 생성 | ⚠️ 부분 완료 | 누락 항목 원인 기록 |

### 3-3. 보고 형식

다음 형식으로 결과를 보고한다:

```
[build-installer] 결과 보고

빌드 구성: DEBUG + RELEASE

코드 빌드:
  ✅ Debug|x86  → dist/debug/
  ✅ Release|x86 → dist/release/

인스톨러:
  ✅ YSRCRMv2_App_Setup_Debug_2.0.0.1.exe   (N MB)
  ✅ YSRCRMv2_App_Setup_Release_2.0.0.1.exe (N MB)
  ✅ YSRCRMv2_Agent_Setup_Debug_2.0.0.1.exe (N MB)
  ✅ YSRCRMv2_Agent_Setup_Release_2.0.0.1.exe (N MB)

수동 실행 필요:
  ⬜ [InnoSetup 미설치 시] ISCC.exe 설치 후 빌드 재실행
```

# 오류 처리

| 상황 | 대응 |
|------|------|
| MSBuild 미설치 | Block으로 기록, 빌드 건너뜀, 수동 실행 항목으로 등록 |
| Node.js 미설치 | Block으로 기록, UI 빌드 건너뜀, 수동 실행 항목으로 등록 |
| npm install 필요 | `npm install` 실행 후 재시도 |
| MSBuild 컴파일 오류 | 오류 로그를 기록하고 3단계로 이행 |
| InnoSetup 미설치 | Block으로 기록, 코드 빌드 결과만 보고 |
| 빌드 스크립트 오류 | 오류 내용 전체를 기록하고 3단계로 이행 |

# 제약사항 및 원칙

1. **코드 수정 금지**: 빌드 실패 시 코드를 수정하지 않는다. `build-sprint-worker`의 영역이다.
2. **타임아웃 준수**: 30분 내에 완료되지 않으면 강제 종료하고 실패로 기록한다.
3. **산출물 위치 고정**: 인스톨러는 반드시 `Deploy/Output/`에 생성된다. 다른 경로 사용 금지.

# 주의사항

- `deploy/` 산출물은 git 추적 대상이 아니다 (`.gitignore` 적용).
- 빌드 스크립트가 실행되는 경로는 반드시 `apps/YSRCRMv2.NET/`이어야 한다.
- Debug 빌드는 `#if DEBUG` 조건으로 개발 서버 API를 호출한다.
- 테스트 포인트·080 수신거부·콜백 등 일부 API는 Debug/Release 무관하게 항상 운영 서버를 호출한다 (스펙 유지).
