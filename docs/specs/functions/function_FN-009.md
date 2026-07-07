# 처리상태 저장·조회·결과확인 갱신 공통 기능 정의

## 개요

- **기능 목적**: 처리 상태(ENT-004)의 저장·조회·결과 확인 갱신을 담당하는 공통 데이터 처리 기능이다. 연동 실행 결과 확정 시 상태 1건을 생성(전달 성공·실패·거부 모두)하고, 서비스 A 조회 성공 시 결과 확인 여부·일시를 최초 1회 멱등 갱신한다. 저장 항목을 요청 키값·구성 참조·상태 4항목·생성 감사로 한정하고 개인식별 컬럼을 원천 배제한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항(요청 키값별 최소 상태) / 정책 DATA-003·DATA-001-02.

---

## FN-009 처리상태 저장·조회·결과확인 갱신

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 처리상태 저장·조회·결과확인 갱신 |
| 분류 | DAT |
| 사용 서비스 | SVC-004, SVC-005, SVC-006 |
| 호출 PROC | PROC-401(저장), PROC-301(조회·갱신) |
| 연관 정책 | [DATA-003](../policies/policy_DATA.md#data-003-처리상태-저장-최소항목)(01·02·03), [DATA-001-02](../policies/policy_DATA.md#data-001-회원-키-무저장개인정보-최소화) |
| 참조 데이터 | [ENT-004](../datas/data_ENT-004.md) 처리 상태, [MDL-301](../datas/model_api.md) 처리 상태 |
| 관련 IA 항목 | BAT-01, API-01, USR-02 |

### 시그니처

```
function FN-009_saveStatus (
  status: ProcessStatus,  // MDL-301 (requestKey·configId·isSuccess·processedAt)
): ProcessStatus          // 저장된 상태(결과 확인 여부 false)

function FN-009_findByKey (
  requestKey: string,     // UUID v4(FN-007 검증 통과)
): ProcessStatus          // 조회된 상태
  throws NotFoundError { code: EX-DATA-003, http: 404 }

function FN-009_confirmResult (
  requestKey: string,
  now: DateTime,
): ProcessStatus          // 결과 확인 갱신 후 상태(멱등)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | status | MDL-301 | Y | 회원 키·개인정보 미포함 | 저장 대상 상태 |
| 입력 | requestKey | string(UUID v4) | Y | PK | 조회·갱신 키 |
| 입력 | now | DateTime | Y | UTC | 결과 확인 일시 |
| 출력 | ProcessStatus | MDL-301 | - | 상태 4항목 + 참조 | 저장·조회·갱신 결과 |

### 처리 흐름 (의사코드)

```
저장 — saveStatus, POL DATA-003-01/02·DATA-001-02 (transform)
1. assert(status has only {requestKey, configId, isSuccess, processedAt})  // 개인식별 컬럼 배제
2. INSERT INTO TBL_INTERLOCK_PROCESS_STATUS
       (request_key, config_id, is_success, is_result_confirmed,
        processed_at, result_confirmed_at, created_at)
   VALUES (:requestKey, :configId, :isSuccess, false, :processedAt, NULL, now());
   // 성공·실패·거부 모두 1건(EXC-DATA-03·EXC-BIZ-06)
3. return status(isResultConfirmed=false)

조회 — findByKey, POL DATA-003-03 진입 (validate)
1. SELECT request_key, config_id, is_success, is_result_confirmed,
          processed_at, result_confirmed_at
   FROM TBL_INTERLOCK_PROCESS_STATUS WHERE request_key = :requestKey;
2. if (row is null)      → throw NotFoundError (404, EX-DATA-003)   // 만료 삭제 포함(EXC-DATA-04)
3. return row → MDL-301

결과 확인 갱신 — confirmResult, POL DATA-003-03 (transform, 멱등·BR-301)
1. status = findByKey(requestKey)                 // 미존재는 404 전파
2. if (status.isResultConfirmed == false)          // 최초 조회만 갱신
        UPDATE TBL_INTERLOCK_PROCESS_STATUS
        SET is_result_confirmed = true, result_confirmed_at = :now
        WHERE request_key = :requestKey AND is_result_confirmed = false;   // 멱등 가드
        status.isResultConfirmed = true; status.resultConfirmedAt = now
3. return status                                    // 재조회는 갱신 없이 현재 상태
```

> 저장 항목은 요청 키값·구성 참조·상태 4항목·생성 감사로 한정한다. 회원 키·개인식별 컬럼을 스키마·모델에 두지 않는다(DATA-001-02). 결과 확인 여부와 확인 일시의 정합은 DB CHECK 로 강제된다([ENT-004](../datas/data_ENT-004.md)).

### API 인터페이스

해당 없음 — 상태 저장(PROC-401)·조회 갱신(PROC-301)의 데이터 처리 유닛으로, 서비스 대면 응답은 PROC-301 이 FN-010(마스킹)·FN-015(엔벨로프)로 구성한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 404 | EX-DATA-003 | 요청 키값 미존재(만료 삭제 포함) | "해당 요청을 찾을 수 없습니다." | EXC-DATA-02/04, 삭제 사실 미보관 |
| 500 | EX-FN-999 | INSERT·UPDATE·조회 오류 | "잠시 후 다시 시도해주세요." | 감사 로그 권장 |

### 의존 기능

없음(leaf) — DB 접근만 수행한다. 조회 응답 마스킹·필드 선별은 호출 PROC-301 이 FN-010 으로 수행한다.

### 구현 가이드

- 요청 키값을 조회 키(PK)로 두고, 4개 상태 항목 외 개인정보성 컬럼을 스키마에서 원천 배제한다(스키마 상세는 [ENT-004](../datas/data_ENT-004.md)). DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02).
- 결과 확인 갱신은 최초 조회 성공 시 1회 수행하도록 조건절 가드(is_result_confirmed=false)로 멱등하게 설계한다(BR-301). 삭제된 키 조회는 404 로 응답한다(FN-011 배치 삭제와 정합).
