# 연동 구성 등록·편집 폼 화면 정의

## 개요

- **화면 목적**: 연동 관리자가 서비스 A↔서비스 B 연동 1건을 코드 개발 없이 화면 구성만으로 등록·편집한다. 서비스 A 호출 주소·전달 파라미터 정의·사용자 동의 항목·서비스 B 전달 주소를 입력하며, 동의 항목·파라미터는 동적 반복 행으로 여러 개 입력한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "관리자 — 연동 구성 관리: 서비스 A의 호출 주소·전달 파라미터, 사용자 노출 동의 항목, 완료 시 서비스 B로 전달할 주소값 설정". 서비스 근거 [SVC-001](../services/service_SVC-001.md).
- **디자인**: [`design-system.md`](design-system.md) 관리자 셸·`TextField`·`Select`·`RepeatableRows`·`Toast` 인용.

---

## SCR-003 연동 구성 등록·편집 폼

### 기본 정보

| 항목 | 내용 |
|------|------|
| 화면명 | 연동 구성 등록·편집 폼 |
| 화면 경로 | 등록 `/admin/configs/new` · 편집 `/admin/configs/:id/edit` |
| 접근 권한 | IP 허용([SEC-001](../policies/policy_SEC.md#sec-001-관리자-경로-ip-접근-제한)) + 인증 세션([AUTH-001](../policies/policy_AUTH.md#auth-001-관리자-로그인-인증)) |
| 관련 서비스 | [SVC-001](../services/service_SVC-001.md) 연동 구성 등록·편집 |
| 트리거 PROC | PROC-101(등록·편집 제출) · PROC-102(편집 진입 상세 로드) |
| 선행 화면 | SCR-002(등록 버튼) · SCR-004(편집 이동) |
| 관련 IA 항목 | ADM-01 |

### 레이아웃 구성

- 관리자 셸 + 본문 컨테이너(최대 폭 1120px). 상단 제목("연동 구성 등록" / "연동 구성 편집") + 하단 저장·취소 `Button`.
- 섹션 순서: (1) 기본 정보(구성 코드·구성명·활성 여부) → (2) 서비스 A 진입(호출 주소) → (3) 전달 파라미터 정의(`RepeatableRows`) → (4) 사용자 동의 항목(`RepeatableRows`, 각 행 라벨·설명·약관 컨텐츠·필수) → (5) 서비스 B 전달(전달 주소·HTTP 메서드).
- 동의 항목 각 반복 행은 라벨·설명·필수 입력에 더해 '약관 컨텐츠'(전체 약관 본문) 여러 줄 입력(textarea)을 둔다. 선택 입력이며(BIZ-001-06), 입력하면 사용자 동의 화면(SCR-005)에서 해당 항목에 [상세] 버튼이 노출된다(BIZ-002-05).
- 반응형: desktop 2컬럼(라벨-입력), mobile 1컬럼. 반복 행은 mobile 에서 필드 세로 스택.

### 데이터 표시

| 표시 항목 | 데이터 모델(MDL) | 속성 | 표시 형식 | 마스킹 규칙 |
|-----------|-----------------|------|-----------|-------------|
| 구성 코드 | [MDL-101](../datas/model_admin.md) | configCode | 텍스트 입력(편집 시 읽기전용 권장) | 설정 데이터, 마스킹 없음(EXC-SEC-05) |
| 구성명 | MDL-101 | configName | 텍스트 입력 | 마스킹 없음 |
| 서비스 A 호출 주소 | MDL-101 | serviceAEntryUrl | URL 입력 | 마스킹 없음 |
| 서비스 B 전달 주소 | MDL-101 | serviceBDeliveryUrl | URL 입력 | 마스킹 없음(EXC-SEC-05) |
| 전달 방식 | MDL-101 | serviceBHttpMethod | Select(GET/POST/PUT/PATCH) | 마스킹 없음 |
| 활성 여부 | MDL-101 | isActive | Toggle | 마스킹 없음 |
| 동의 항목(행) | MDL-101 | consentItems[] {label·description·termsContent·required·order} | 반복 행(약관 컨텐츠=textarea) | 마스킹 없음(설정 메타) |
| 전달 파라미터(행) | MDL-101 | parameters[] {name·sourceKeyA·deliverToB·required·order} | 반복 행 | 마스킹 없음 |

> 편집 진입 시 상세(MDL-101)를 GET /api/admin/configs/:id 로 로드해 폼에 프리필한다. 회원 키·처리 상태 필드는 본 모델에 없다(설정 데이터 전용).

### 사용자 인터랙션

| 인터랙션 | 대상 요소 | 동작 | 호출 API(FN) | 트리거 PROC | 결과 |
|----------|-----------|------|-------------|-------------|------|
| 페이지 mount(편집) | (자동) | 대상 구성 상세 로드·프리필 | GET /api/admin/configs/:id([FN-001](../functions/function_FN-001.md)·FN-003·FN-010) | PROC-102 | 폼 프리필 / Error |
| 클릭 | 동의 항목/파라미터 "행 추가" | 반복 행 추가 | (없음, 클라이언트) | (트리거 없음) | 빈 행 추가 |
| 클릭 | 행 삭제 | 반복 행 제거 | (없음, 클라이언트) | (트리거 없음) | 행 제거 |
| 입력 | 각 필드 | FE 유효성 검사 | (없음) | (트리거 없음) | 인라인 에러·저장 버튼 상태 갱신 |
| 클릭 | 저장 버튼 | 폼 데이터 제출(등록/편집) | POST(등록)/PUT(편집) /api/admin/configs([FN-005](../functions/function_FN-005.md)·[FN-006](../functions/function_FN-006.md)·FN-013) | PROC-101 | 성공 `Toast` + SCR-004 이동 / 검증 에러 |
| 클릭 | 취소 버튼 | 이탈 확인 후 목록 이동 | (없음) | (네비게이션) | SCR-002 이동 |

> 등록/편집은 경로(신규/`:id`)와 메서드(POST/PUT)로 구분되며 모두 PROC-101 을 트리거한다(BR-101 등록/편집 분기는 PROC-101 내부 처리).

### 화면 상태 전이

| 상태 | 진입 조건 | PROC 단계 매핑 | 표시 내용 |
|------|----------|---------------|-----------|
| Initial(등록) | 페이지 mount(신규) | (트리거 전) | 빈 폼(파라미터·동의 항목 각 1행 기본) |
| Initial(편집) | 페이지 mount(:id) | (트리거 전) | 폼 골격 Skeleton |
| Loading(편집 로드) | 상세 요청 대기 | PROC-102 상세 조회 진입 직후 | Skeleton 유지 |
| Loaded(편집) | 200 응답 | PROC-102 응답 DTO 변환 | 프리필된 폼 |
| Submitting | 저장 요청 대기 | PROC-101 입력 DTO 재검증 진입 직후 | 저장 버튼 Spinner + 폼 `disabled` |
| Success | 201/200 응답 | PROC-101 응답 반환 | `Toast` + SCR-004 이동 |
| Error(검증) | 422 EX-BIZ-001 | PROC-101 입력 DTO 재검증 실패 | 필드별 인라인 에러(`error.details` 매핑) |
| Error(중복) | 409 EX-BIZ-002 | PROC-101 고유성 검증 실패 | 구성 코드 필드 에러 "이미 존재하는 구성입니다." |
| Error(형식) | 400 EX-SEC-004 / 413 EX-SEC-005 | PROC-101 입력 검증 | `Banner`(error) 형식/크기 안내 |

### 입력 폼 정의

| 필드명 | 입력 유형 | 데이터 모델(MDL) | 필수 | 유효성 규칙 (FE 검증 의사코드) | 에러 메시지 |
|--------|-----------|-----------------|------|--------------------------------|-------------|
| 구성 코드 | text input | MDL-101.configCode | Y | `value.trim().length > 0 && value.length <= 64` (BIZ-001-01) | "구성 코드를 입력해주세요(최대 64자)." |
| 구성명 | text input | MDL-101.configName | Y | `value.trim().length > 0 && value.length <= 100` | "구성명을 입력해주세요(최대 100자)." |
| 서비스 A 호출 주소 | url input | MDL-101.serviceAEntryUrl | Y | `/^https?:\/\/\S+$/.test(value) && value.length <= 2048` (BIZ-001-02) | "http/https 로 시작하는 주소를 입력해주세요." |
| 서비스 B 전달 주소 | url input | MDL-101.serviceBDeliveryUrl | Y | `/^https?:\/\/\S+$/.test(value) && value.length <= 2048` (BIZ-001-02) | "http/https 로 시작하는 주소를 입력해주세요." |
| 전달 방식 | select | MDL-101.serviceBHttpMethod | Y | `['GET','POST','PUT','PATCH'].includes(value)` | "전달 방식을 선택해주세요." |
| 동의 항목 라벨(행) | text input | MDL-101.consentItems[].label | Y | `value.trim().length > 0 && value.length <= 200` | "동의 항목 라벨을 입력해주세요." |
| 동의 항목 설명(행) | text input | MDL-101.consentItems[].description | N | `value.length <= 1000` | "설명이 너무 깁니다(최대 1000자)." |
| 동의 항목 약관 컨텐츠(행) | textarea | MDL-101.consentItems[].termsContent | N | 선택 입력, 본문 크기는 요청 상한(1MB) 내(BIZ-001-06) | "약관 본문이 너무 깁니다." |
| 동의 항목 필수(행) | checkbox | MDL-101.consentItems[].required | N | (boolean) | (해당 없음) |
| 동의 항목 목록 | RepeatableRows | MDL-101.consentItems | Y | `consentItems.length >= 1` (BIZ-001-04) | "동의 항목을 1개 이상 등록해주세요." |
| 파라미터명(행) | text input | MDL-101.parameters[].name | Y | `value.trim().length > 0 && value.length <= 100` | "파라미터명을 입력해주세요." |
| 원천 키명(행) | text input | MDL-101.parameters[].sourceKeyA | Y | `value.trim().length > 0 && value.length <= 100` | "서비스 A 원천 키명을 입력해주세요." |
| 서비스 B 전달 여부(행) | checkbox | MDL-101.parameters[].deliverToB | N | (boolean, 기본 true) | (해당 없음) |
| 전달 파라미터 목록 | RepeatableRows | MDL-101.parameters | Y | `parameters.length >= 1` (BIZ-001-01) | "전달 파라미터를 1개 이상 정의해주세요." |

> 모든 규칙은 서버단에서 재검증([FN-005](../functions/function_FN-005.md)·[FN-006](../functions/function_FN-006.md))되며 FE 검증은 1차 방어다. 고유성(BIZ-001-03)·개인정보 파라미터 경고(BIZ-001-05)는 서버 전담이며 FE 는 사전 판단하지 않는다.

### 조건부 표시

| 대상 요소 | 표시 조건 | 관련 정책 |
|-----------|-----------|-----------|
| 구성 코드 읽기전용 | 편집 모드(`mode === 'EDIT'`) | BIZ-001-03(고유 식별자 변경 방지, 권장) |
| 개인정보 파라미터 안내 `Banner` | 원천 키명이 개인정보성 명칭 패턴에 해당(참고 안내) | BIZ-001-05(경고·비차단) |
| 폼 전체 | 인증 세션 유효 | AUTH-001 |

### 이동 경로 (Navigation)

| 이동 대상 | 트리거 | 조건 | 트리거 PROC |
|-----------|--------|------|-------------|
| SCR-004 상세 | 저장 성공 | 201/200 응답 | PROC-101(저장) |
| SCR-002 목록 | 취소 클릭 | 이탈 확인 | (네비게이션, PROC 없음) |

### 구현 가이드

- 반복 행 추가·삭제·순서(order)는 클라이언트 상태로 관리하고 제출 시 배열로 직렬화한다. `order` 는 화면 순서로 부여한다(display_order 오름차순 정합).
- 개인정보 파라미터 경고는 저장을 차단하지 않는다(BIZ-001-05). FE 는 안내만 노출하고 서버가 감사 기록한다. 구성 코드는 편집 시 변경을 막아 고유성·참조 안정성을 지킨다(값 변경 필요 시 신규 등록 권장).
