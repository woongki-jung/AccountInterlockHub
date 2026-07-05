# 감사 로그 기록 공통 기능 정의

## 개요

- **기능 목적**: 관리자 인증·연동 구성 변경·IP 차단·API 인증 실패·연동 전달 실패·배치 실행 등 운영 이벤트를 감사 로그(ENT-006)에 append-only 로 기록한다. 기록 직전 민감값(회원 키·자격·요청 키값)을 마스킹(FN-010)하며 개인정보를 포함하지 않는다. 전 도메인이 횡단으로 호출하는 공통 기록 기능이다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §제공 가치(처리 추적)·시스템 제약(운영) / 정책 OPS-002·SEC-005.
- **담당자 확정 대기**: 감사 로그 보존 기간(1년)은 기본안(EXC-OPS-02). 보존 초과분 삭제 수단은 build/운영 확정.

---

## FN-013 감사 로그 기록

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 감사 로그 기록 |
| 분류 | CRS |
| 사용 서비스 | 전 SVC(공통) |
| 호출 PROC | PROC-101, PROC-103, PROC-104, PROC-105, PROC-106, PROC-203, PROC-301, PROC-402 |
| 연관 정책 | [OPS-002](../policies/policy_OPS.md#ops-002-감사-로그)(01·02·03), [SEC-005](../policies/policy_SEC.md#sec-005-민감값-마스킹), [DATA-001-03](../policies/policy_DATA.md#data-001-회원-키-무저장개인정보-최소화) |
| 참조 데이터 | [ENT-006](../datas/data_ENT-006.md) 감사 로그, [MDL-401](../datas/model_common.md) 감사 로그 항목 |
| 관련 IA 항목 | 공통 |

### 시그니처

```
function FN-013_writeAudit (
  entry: AuditLogEntry,   // MDL-401 (eventType·actorType·actorId·target·result·detail)
): void                   // append-only, 실패 시 주 처리에 영향 없음(best-effort)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | entry.eventType | string | Y | 정의된 코드값 | LOGIN_SUCCESS·CONFIG_CREATE·IP_BLOCK·API_AUTH_FAIL·DELIVERY_FAIL·BATCH_RUN 등 |
| 입력 | entry.actorType | enum | Y | ADMIN/SERVICE/SYSTEM/BATCH | 행위자 유형 |
| 입력 | entry.actorId | string\|null | N | MaxLength(64)·마스킹 | 관리자 username·서비스 식별 |
| 입력 | entry.target | string\|null | N | MaxLength(200)·마스킹 | 구성 코드·요청 키값 등 |
| 입력 | entry.result | enum | Y | SUCCESS/FAIL/BLOCKED/INFO | 처리 결과 |
| 입력 | entry.detail | string\|null | N | MaxLength(1000)·마스킹 | 부가 상세 |
| 출력 | (void) | - | - | best-effort | 기록 결과 |

### 처리 흐름 (의사코드)

```
1. 마스킹 — POL SEC-005-01·DATA-001-03·OPS-002-02 (mask)
   entry.actorId = FN-010_mask(entry.actorId)     // 자격·회원 키 원문 배제
   entry.target  = FN-010_mask(entry.target)      // 요청 키값 등 마스킹
   entry.detail  = maskSensitive(entry.detail)    // 개인정보·회원 키 배제
   assert(no memberKey plaintext in entry)         // DATA-001-03

2. 기록 — POL OPS-002-01/02 (audit)
   INSERT INTO TBL_AUDIT_LOG
       (event_type, actor_type, actor_id, target, result, detail, occurred_at)
   VALUES (:eventType, :actorType, :actorId, :target, :result, :detail, SYSUTCDATETIME());
   // append-only, 수정 없음

3. 실패 처리 — best-effort
   on error: 애플리케이션 로그로 폴백 기록, 주 처리 흐름은 계속(감사 실패가 업무 차단 아님)
```

> 감사 로그는 무저장 원칙 대상이 아니며(개인정보 미포함) 최소 1년 보존한다(OPS-002-03). event_type·actor_type·result 코드값은 애플리케이션 상수로 통일한다.

### API 인터페이스

해당 없음 — 각 PROC 의 "커밋 후 감사 로그"·"차단 후 감사 로그"·"인증 실패 감사 로그"·"배치 종료 감사 로그" 단계에서 호출되는 횡단 유틸리티다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| (없음) | - | 기록 실패 시 폴백 | (사용자 미노출) | best-effort — 주 처리 흐름 비차단 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-010 | 기록 직전(단계 1) | 동기 | 마스킹 후 기록(민감값 원문 배제) |

### 구현 가이드

- 감사 로그는 애플리케이션 로그와 분리 가능한 채널로 남기고, 기록 직전 FN-010 마스킹을 일괄 적용한다. append-only 특성상 수정하지 않으며, 대량 기록 환경의 파티셔닝·아카이브는 build 검토한다([ENT-006](../datas/data_ENT-006.md)).
- 기록은 best-effort 로 처리해 감사 실패가 업무 처리를 차단하지 않게 한다. 보존 초과분 삭제 배치·PROC 는 MVP 미정의이며 도입 시 시각 인덱스·삭제 PROC 를 함께 채번한다.
