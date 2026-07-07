# 보관 만료 대상 선정·삭제 배치 공통 기능 정의

## 개요

- **기능 목적**: 일 1회 스케줄 배치로 보관 기간이 경과한 처리 상태·연동이력을 하드 삭제해 무기한 누적을 막는다. 처리상태는 결과 확인 완료 건=결과 확인 일시·미완료 건=처리 일시 기준, 연동이력은 완료 콜백 수신 건=수신 일시·미수신 건=연동 요청 일시 기준으로 각각 90일 경과분을 선정해 삭제하고, 실행 결과(대상·삭제 건수·소요 — 처리상태·연동이력 각각 집계)를 감사 로그에 남긴다. 재실행 시 중복 삭제·부작용이 없도록 멱등하게 동작한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위(상태 보관·정리) / [`../../prd/devspec/database.md`](../../prd/devspec/database.md) §보관 정책(연동이력 동일 배치 정리) / 정책 DATA-004·DATA-006·OPS-003.
- **담당자 확정 대기 (Q4·Q5)**: 처리상태 90일·일 배치 주기·미완료 삭제 기준은 기본안(EXC-DATA-05). 연동이력 보관 90일·기산점 이원화(수신=수신 일시, 미수신=연동 요청 일시)는 확정 기본안(EXC-DATA-10, `accountinterlockhub#33`).

---

## FN-011 보관 만료 대상 선정·삭제 배치

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 보관 만료 대상 선정·삭제 배치 |
| 분류 | DAT |
| 사용 서비스 | SVC-007 |
| 호출 PROC | PROC-402 |
| 연관 정책 | [DATA-004](../policies/policy_DATA.md#data-004-상태-보관삭제)(01·02·03), [DATA-006](../policies/policy_DATA.md#data-006-연동이력-보관삭제)(01·02·03), [OPS-003](../policies/policy_OPS.md#ops-003-상태-보관-배치-실행)(01·02·03) |
| 참조 데이터 | [ENT-004](../datas/data_ENT-004.md) 처리 상태, [ENT-007](../datas/data_ENT-007.md) 연동이력, [MDL-402](../datas/model_api.md) 배치 결과 |
| 관련 IA 항목 | BAT-02 |

### 시그니처

```
function FN-011_runRetentionBatch (
  now: DateTime,          // 실행 기준 시각(스케줄 도래)
  retentionDays: number,  // 보관 기간(기본안 90)
): BatchRunResult         // MDL-402 (statusTargetCount·statusDeletedCount·historyTargetCount·historyDeletedCount·elapsedMs·runAt)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | now | DateTime | Y | UTC | 배치 실행 기준 시각 |
| 입력 | retentionDays | number | Y | 기본안 90 | 보관 기간(일) |
| 출력 | BatchRunResult | MDL-402 | - | - | 실행 결과 요약(감사 detail) |

### 처리 흐름 (의사코드)

```
1. 기동 — OPS-003-01 (audit)
   start = now; threshold = now - retentionDays days
   FN-013_writeAudit({ eventType:'BATCH_RUN', actorType:'BATCH', result:'INFO',
                       detail:'retention start' })

2. 처리상태 삭제 대상 선정·삭제 — DATA-004-01/02/03·OPS-003-02 (validate·transform, BR-401)
   // 완료 건: 결과 확인 일시 + 90일 경과 — 부분 인덱스 IX_STATUS_RETENTION_CONFIRMED 로 선정
   statusDeletedConfirmed = 0
   repeat                                      // 청크 DELETE — 청크마다 트랜잭션 커밋(ENT-004 확정)
     n = DELETE FROM TBL_INTERLOCK_PROCESS_STATUS
         WHERE ctid IN (SELECT ctid FROM TBL_INTERLOCK_PROCESS_STATUS
                        WHERE is_result_confirmed = true AND result_confirmed_at < :threshold
                        LIMIT :chunkSize);      // 하드 삭제, chunkSize 내부 상수(기본 5,000행, ENT-004)
     COMMIT; statusDeletedConfirmed += n
   until n = 0
   // 미완료 건: 처리 일시 + 90일 경과(무기한 누적 방지) — IX_STATUS_RETENTION_PENDING 활용
   statusDeletedPending = 동일 청크 루프
       (WHERE is_result_confirmed = false AND processed_at < :threshold)
   statusDeleted = statusDeletedConfirmed + statusDeletedPending
   // 두 갈래를 한 배치 실행 흐름에서 처리. 조건절이 곧 멱등 가드 + 청크 단위 커밋 —
   // 중단·재실행 시 이미 커밋된 삭제분은 미해당, 잔여 대상만 다시 삭제(OPS-003-02)

3. 연동이력 삭제 대상 선정·삭제 — DATA-006-01/02/03·OPS-003-02 (validate·transform, BR-402)
   // 수신 건: 완료 콜백 수신 일시 + 90일 경과 — 부분 인덱스 IX_HISTORY_RETENTION_RECEIVED 로 선정
   historyDeletedReceived = 처리상태와 동일 청크 루프 (대상 테이블 TBL_INTERLOCK_HISTORY, 청크마다 커밋)
       (WHERE callback_received = true AND callback_received_at < :threshold)   // IX_HISTORY_RETENTION_RECEIVED
   // 미수신 건: 연동 요청 일시 + 90일 경과(무기한 누적 방지 — 콜백 미도래 건 정리, EXC-BIZ-11)
   historyDeletedPending = 동일 청크 루프 (TBL_INTERLOCK_HISTORY)
       (WHERE callback_received = false AND requested_at < :threshold)          // IX_HISTORY_RETENTION_PENDING
   historyDeleted = historyDeletedReceived + historyDeletedPending
   // 연동이력도 처리상태와 같은 배치·청크 DELETE 흐름·멱등 가드를 공유한다(DATA-006 구현 가이드)

4. 결과 집계 — OPS-003-03 (audit)
   result = { statusTargetCount:  statusDeleted,  statusDeletedCount:  statusDeleted,
              historyTargetCount: historyDeleted, historyDeletedCount: historyDeleted,
              elapsedMs: now2 - start, runAt: start }
   FN-013_writeAudit({ eventType:'BATCH_RUN', actorType:'BATCH', result:'SUCCESS',
                       detail: summarize(result) })   // MDL-402 → 감사 detail(처리상태·연동이력 각각 집계, OPS-003-03)

5. 반환(별도 저장 없음)
   return result   // 상태·이력 테이블 미저장, 감사 로그로만 기록
```

> 처리상태·연동이력 모두 하드 삭제로 수행하고 소프트 삭제(보관 플래그)를 사용하지 않는다(DATA-004-03·DATA-006-03). 실패 시 진행 중 청크만 롤백되고 이미 커밋된 청크의 삭제는 유지된다 — 잔여 대상은 다음 주기 재시도로 흡수한다(OPS-003-03). 삭제된 요청 키값의 처리상태 조회는 FN-009 에서 404(EX-DATA-003)로, 삭제된 연동이력의 완료 확인 조회는 FN-017 에서 404(EX-BIZ-005)로 응답한다(EXC-DATA-04·EXC-DATA-11 정합).

### API 인터페이스

해당 없음 — 앱 내부 스케줄 작업으로 사용자·서비스 대면 엔드포인트가 없다. 실패는 HTTP EX 코드 없이 다음 주기 재시도로 처리한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| (내부) | - | 삭제 트랜잭션 오류·중단 | (사용자 미노출) | 진행 청크만 롤백(커밋 청크 유지), 잔여분은 다음 주기 재시도(OPS-003-03), 실패 감사 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-013 | 기동·종료 감사(단계 1·3) | 동기 | 감사 실패는 삭제 결과에 영향 없음 |

### 구현 가이드

- 삭제는 처리상태(완료/미완료)·연동이력(수신/미수신) 네 갈래를 한 배치 실행 흐름에서 처리하되, 각 갈래를 청크 단위 반복 삭제(`ctid IN ... LIMIT`)와 청크마다 커밋으로 단일 트랜잭션 크기·잠금을 상한한다 — 청크 수치(기본 5,000행)·패턴·근거는 [ENT-004](../datas/data_ENT-004.md)·[ENT-007](../datas/data_ENT-007.md) §구현 가이드 확정(동일 접근)을 따른다. 조건절이 곧 멱등 가드이므로 중단·재실행 시 이미 커밋된 삭제분은 미해당하고 잔여 대상만 다시 삭제된다(OPS-003-02).
- 삭제 대상 선정은 처리상태 완료/미완료 부분 인덱스(IX_STATUS_RETENTION_CONFIRMED·PENDING)와 연동이력 수신/미수신 부분 인덱스(IX_HISTORY_RETENTION_RECEIVED·PENDING)로 수행한다. PostgreSQL 힙에는 클러스터드 인덱스가 없어 물리 저장 지역성을 삭제 성능 근거로 삼지 않으며, 삭제 후 공간 회수는 autovacuum 에 위임한다(고변경 테이블 ENT-004·ENT-007 테이블 단위 scale_factor 하향). 배치 결과는 별도 상태 테이블에 저장하지 않고 처리상태·연동이력 각각 집계해 감사 로그 detail 로만 남긴다(MDL-402).
