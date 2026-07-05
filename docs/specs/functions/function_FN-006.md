# 연동 구성 입력 검증·고유성 공통 기능 정의

## 개요

- **기능 목적**: 관리자 연동 구성 등록·편집 시 필수 항목·URL 형식·동의 항목 개수·구성 코드 고유성을 서버단에서 재검증한다. 개인정보 직접 수신 파라미터가 포함되면 저장은 차단하지 않고 경고를 감사에 남긴다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위(관리자 연동 구성 관리) / 정책 BIZ-001.
- **담당자 확정 대기**: BIZ-001-05 개인정보 파라미터 경고(비차단)는 기본안(EXC-BIZ-01).

---

## FN-006 연동 구성 입력 검증·고유성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 연동 구성 입력 검증·고유성 |
| 분류 | POL |
| 사용 서비스 | SVC-001 |
| 호출 PROC | PROC-101 |
| 연관 정책 | [BIZ-001](../policies/policy_BIZ.md#biz-001-연동-구성-입력-검증고유성)(01·02·03·04·05) |
| 참조 데이터 | [MDL-101](../datas/model_admin.md) 연동 구성, [ENT-001](../datas/data_ENT-001.md)·[ENT-002](../datas/data_ENT-002.md)·[ENT-003](../datas/data_ENT-003.md) |
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
| 입력 | config | MDL-101 | Y | FN-005 통과 후 | 검증 대상 구성 |
| 입력 | mode | enum | Y | CREATE/EDIT | 고유성 범위 분기 |
| 입력 | selfId | string(UUID) | N | EDIT 시 필수 | 자기 충돌 제외 |
| 출력 | (void) | - | - | 통과 시 반환 | 검증 결과 |

### 처리 흐름 (의사코드)

```
1. 필수 항목 검증 — POL BIZ-001-01 (validate)
   if (blank(config.configCode) OR blank(config.configName)
       OR blank(config.serviceAEntryUrl) OR blank(config.serviceBDeliveryUrl)
       OR config.parameters is empty)
        → throw ConfigValidationError (422, EX-BIZ-001)

2. URL 형식 검증 — POL BIZ-001-02 (validate)
   if (!isHttpUrl(config.serviceAEntryUrl) OR !isHttpUrl(config.serviceBDeliveryUrl))
        → throw ConfigValidationError (422, EX-BIZ-001)   // http/https 절대 URL

3. 동의 항목 개수 — POL BIZ-001-04 (validate)
   if (config.consentItems.length < 1)
        → throw ConfigValidationError (422, EX-BIZ-001)

4. 고유성 사전 조회 — POL BIZ-001-03 (validate)
   SELECT id FROM TBL_INTERLOCK_CONFIG
   WHERE config_code = :config.configCode AND deleted_at IS NULL;
   if (row exists AND (mode == 'CREATE' OR row.id != selfId))   // EDIT 자기 제외(EXC-BIZ-02)
        → throw ConfigDuplicateError (409, EX-BIZ-002)

5. 개인정보 파라미터 경고 — POL BIZ-001-05 (audit, 비차단)
   if (config.parameters contains 개인정보 직접 수신 항목)
        FN-013_writeAudit({ eventType:'CONFIG_PII_WARN', actorType:'ADMIN',
                            target: config.configCode, result:'INFO' })   // 저장 진행

6. 통과
   return   // 호출 PROC-101 은 영속화 진행(자식 ENT-002·003 동일 트랜잭션)
```

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | POST /api/admin/configs (등록) · PUT /api/admin/configs/:id (편집) |
| HTTP 메서드 | POST / PUT (검증 단계) |
| 인증 요구 | IP(FN-001) + 세션(FN-003) |
| 요청 DTO | MDL-101(연동 구성) — FN-005 재검증 통과 후 |
| 응답 DTO (200) | MDL-101(저장 결과) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-BIZ-001/002 |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 422 | EX-BIZ-001 | 필수 누락·URL 형식 오류·동의 항목 0개 | "입력 값을 확인해주세요." | BIZ-001-01/02/04 |
| 409 | EX-BIZ-002 | 구성 코드 중복(유효 구성 간) | "이미 존재하는 구성입니다." | 필터 유니크(deleted_at IS NULL) |
| 500 | EX-FN-999 | 조회·검증 오류 | "잠시 후 다시 시도해주세요." | - |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-005 | 진입 전(호출 PROC) | 동기 | 형식·크기·주입 선검증 |
| FN-013 | 개인정보 경고(단계 5) | 동기 | 경고 기록 실패는 저장에 영향 없음 |

### 구현 가이드

- URL·필수·고유성은 화면 검증에 의존하지 않고 서버단에서 재수행한다. 고유성은 저장 직전 조회로 확인하며, 편집은 자기 자신을 제외한다(EXC-BIZ-02).
- 소프트 삭제된 구성 코드는 재사용을 허용한다(필터 유니크). 개인정보 직접 수신 파라미터는 값 자체를 저장하지 않으므로 경고만 남기고 차단하지 않는다(무저장 원칙과 양립).
