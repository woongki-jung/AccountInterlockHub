# 접근 주소 구성 입력 검증·고유성 공통 기능 정의

## 개요

- **기능 목적**: 관리자 발송처 접근 주소 구성 등록·편집 시 필수 항목(수신처 B 전달 주소·동의 항목)·URL 형식·동의 항목 개수·접근 주소 고유 ID 고유성을 서버단에서 재검증한다. `#214` 로 입력이 단일 암호화 JSON(encX·encY)으로 바뀌어 **전달 파라미터 정의·사용자 키값 파라미터 exactly-one 지정(`#33`)·발송처 진입 URL·개인정보 파라미터 경고를 폐기**했다 — 수신처에 넘길 회원 키·연동 추적 키는 발송처가 전달 데이터 X 안에 담아 전달하므로(SEC-006) 구성에 파라미터를 두지 않는다(EXC-BIZ-14).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 1(관리자 — 발송처 접근 주소 구성: 수신처 B 전달 주소·동의 항목 설정, 접근 주소 고유 ID=발송처 구분값) / 정책 BIZ-001.
- **담당자 확정 대기**: 약관 컨텐츠 '선택'(BIZ-001-06)·'필수' 전환 여부는 담당자 확정 대기다(EXC-BIZ-07). 활성/비활성 전환 규칙은 SVC-002 확정 대기.

---

## FN-006 접근 주소 구성 입력 검증·고유성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 접근 주소 구성 입력 검증·고유성 |
| 분류 | POL |
| 사용 서비스 | SVC-001 |
| 호출 PROC | PROC-101 |
| 연관 정책 | [BIZ-001](../policies/policy_BIZ.md#biz-001-접근-주소-구성-입력-검증고유성)(04·06·08·09·10·11) |
| 참조 데이터 | [MDL-101](../datas/model_admin.md) 접근 주소 구성, [ENT-001](../datas/data_ENT-001.md)·[ENT-002](../datas/data_ENT-002.md) |
| 관련 IA 항목 | ADM-01 |

### 시그니처

```
function FN-006_validateConfig (
  config: InterlockConfig,    // MDL-101 (요청 DTO, FN-005 통과 후)
  mode: 'CREATE' | 'EDIT',    // 등록/편집(고유성 검증 범위 분기, BR-101)
  selfId?: string,            // EDIT 시 자기 자신 id(EXC-BIZ-02 제외)
): void
  throws ConfigValidationError { code: EX-BIZ-001, http: 422 }
        | ConfigDuplicateError  { code: EX-BIZ-002, http: 409 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | config | MDL-101 | Y | FN-005 통과 후 | 검증 대상 구성(configCode·serviceBDeliveryUrl·serviceBHttpMethod·isActive·consentItems) |
| 입력 | mode | enum | Y | CREATE/EDIT | 고유성 범위 분기 |
| 입력 | selfId | string(UUID) | N | EDIT 시 필수 | 자기 충돌 제외 |
| 출력 | (void) | - | - | 통과 시 반환 | 검증 결과 |

### 처리 흐름 (의사코드)

```
1. 필수 항목 검증 — POL BIZ-001-08 (validate)
   if (blank(config.serviceBDeliveryUrl) OR config.consentItems is empty)
        → throw ConfigValidationError (422, EX-BIZ-001)   // 수신처 B 전달 주소·동의 항목 필수

2. 수신처 B 전달 주소 URL 형식 검증 — POL BIZ-001-09 (validate)
   if (!isHttpUrl(config.serviceBDeliveryUrl))            // http/https 절대 URL
        → throw ConfigValidationError (422, EX-BIZ-001)

3. 동의 항목 개수 — POL BIZ-001-04 (validate)
   if (config.consentItems.length < 1)
        → throw ConfigValidationError (422, EX-BIZ-001)

4. 접근 주소 고유 ID 고유성 사전 조회 — POL BIZ-001-10 (validate)
   SELECT id FROM TBL_INTERLOCK_CONFIG
   WHERE config_code = :config.configCode AND deleted_at IS NULL;   // 부분 유니크(UQ_CONFIG_CODE)
   if (row exists AND (mode == 'CREATE' OR row.id != selfId))       // EDIT 자기 제외(EXC-BIZ-02)
        → throw ConfigDuplicateError (409, EX-BIZ-002)

5. 통과
   return   // 호출 PROC-101 은 영속화 진행(고유 ID 1회 부여·불변 BIZ-001-11, 자식 ENT-002 동의 항목 동일 트랜잭션)
```

> 접근 주소 고유 ID(config_code)는 발송처 식별자로 접근 주소 생성 시 1회 부여하고 이후 불변이다(BIZ-001-11) — 사용자가 진입한 접근 주소(고유 ID)가 곧 발송처 구분값이다. 접근 URL 은 `허브 접근 주소(고유 ID) + encX·encY 파라미터`로 구성되며, 발송처키·암호값·회원 키·연동 추적 키는 구성에 저장하지 않는다(DATA-001·SEC-002·EXC-BIZ-14). 동의 항목의 약관 컨텐츠(termsContent)는 선택 입력이라 본 검증에서 필수·형식으로 차단하지 않는다(BIZ-001-06). 크기 상한(1MB)은 진입 검증(FN-005 SEC-004-03)이 담당한다.

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/admin/configs (등록) · PUT /api/admin/configs/:id (편집) |
| HTTP 메서드 | POST / PUT (검증 단계) |
| 인증 요구 | IP(FN-001) + 세션(FN-003) |
| 요청 DTO | MDL-101(접근 주소 구성) — FN-005 재검증 통과 후 |
| 응답 DTO (200) | MDL-101(저장 결과) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-BIZ-001/002 |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 422 | EX-BIZ-001 | 필수 누락(수신처 B 주소·동의 항목)·URL 형식 오류·동의 항목 0개 | "입력 값을 확인해주세요." | BIZ-001-08/09/04 |
| 409 | EX-BIZ-002 | 접근 주소 고유 ID 중복(유효 구성 간) | "이미 존재하는 접근 주소입니다." | 부분 유니크(deleted_at IS NULL) |
| 500 | EX-FN-999 | 조회·검증 오류 | "잠시 후 다시 시도해주세요." | - |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-005 | 진입 전(호출 PROC) | 동기 | 형식·크기·주입 선검증 |

### 구현 가이드

- URL·필수·고유성은 화면 검증에 의존하지 않고 서버단에서 재수행한다. 고유성은 저장 직전 조회로 확인하며, 편집은 자기 자신을 제외한다(EXC-BIZ-02). 소프트 삭제된 접근 주소 고유 ID 는 재사용을 허용한다(부분 유니크).
- 동의 항목의 약관 컨텐츠(termsContent)는 선택 입력이라 필수·형식으로 차단하지 않고(BIZ-001-06), 값은 자식(ENT-002.terms_content)으로 부모 구성과 함께 영속화한다(PROC-101). 크기 상한(1MB)은 진입 검증(FN-005 SEC-004-03)이 담당한다.
- `#214` 로 전달 파라미터 정의(구 ENT-003)·사용자 키값 파라미터 exactly-one 지정(구 BIZ-001-07·EXC-BIZ-09)·발송처 진입 URL·개인정보 파라미터 경고(구 BIZ-001-05)는 폐기됐다 — 구성에 파라미터를 두지 않으며, 회원 키·연동 추적 키는 발송처가 전달 데이터 X 안에 담아 전달한다(EXC-BIZ-14). 진입 시점의 지정 파라미터 값 검증(구 EX-BIZ-007)도 폐기됐다.
