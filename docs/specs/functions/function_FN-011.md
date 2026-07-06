# 보관 만료 대상 선정·삭제 배치 공통 기능 정의

## 개요

- **기능 목적**: 일 1회 스케줄 배치로 보관 기간이 경과한 처리 상태를 하드 삭제해 무기한 누적을 막는다. 결과 확인 완료 건은 결과 확인 일시 기준, 미완료 건은 처리 일시 기준으로 각각 90일 경과분을 선정해 삭제하고, 실행 결과(대상·삭제 건수·소요)를 감사 로그에 남긴다. 재실행 시 중복 삭제·부작용이 없도록 멱등하게 동작한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위(상태 보관·정리) / 정책 DATA-004·OPS-003.
- **담당자 확정 대기 (Q4)**: 90일 기준·일 배치 주기·미완료 삭제 기준은 기본안(EXC-DATA-05).

---

## FN-011 보관 만료 대상 선정·삭제 배치

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 보관 만료 대상 선정·삭제 배치 |
| 분류 | DAT |
| 사용 서비스 | SVC-007 |
| 호출 PROC | PROC-402 |
| 연관 정책 | [DATA-004](../policies/policy_DATA.md#data-004-상태-보관삭제)(01·02·03), [OPS-003](../policies/policy_OPS.md#ops-003-상태-보관-배치-실행)(01·02·03) |
| 참조 데이터 | [ENT-004](../datas/data_ENT-004.md) 처리 상태, [MDL-402](../datas/model_api.md) 배치 결과 |
| 관련 IA 항목 | BAT-02 |

### 시그니처

```
function FN-011_runRetentionBatch (
  now: DateTime,          // 실행 기준 시각(스케줄 도래)
  retentionDays: number,  // 보관 기간(기본안 90)
): BatchRunResult         // MDL-402 (targetCount·deletedCount·elapsedMs·runAt)
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

2. 삭제 대상 선정·삭제 — DATA-004-01/02/03·OPS-003-02 (validate·transform, BR-401)
   // 완료 건: 결과 확인 일시 + 90일 경과
   deletedConfirmed = DELETE FROM TBL_INTERLOCK_PROCESS_STATUS
       WHERE is_result_confirmed = true AND result_confirmed_at < :threshold;   // 하드 삭제
   // 미완료 건: 처리 일시 + 90일 경과(무기한 누적 방지)
   deletedPending = DELETE FROM TBL_INTERLOCK_PROCESS_STATUS
       WHERE is_result_confirmed = false AND processed_at < :threshold;
   // 두 갈래를 한 배치 흐름에서 처리, 조건절 자체가 멱등(재실행 시 이미 삭제분 미해당)

3. 결과 집계 — OPS-003-03 (audit)
   result = { targetCount: deletedConfirmed + deletedPending,
              deletedCount: deletedConfirmed + deletedPending,
              elapsedMs: now2 - start, runAt: start }
   FN-013_writeAudit({ eventType:'BATCH_RUN', actorType:'BATCH', result:'SUCCESS',
                       detail: summarize(result) })   // MDL-402 → 감사 detail(OPS-003-03)

4. 반환(별도 저장 없음)
   return result   // 상태 테이블 미저장, 감사 로그로만 기록
```

> 삭제는 하드 삭제로 수행하고 소프트 삭제(보관 플래그)를 사용하지 않는다(DATA-004-03). 실패 시 트랜잭션 롤백 후 다음 주기 재시도로 흡수한다(OPS-003-03). 삭제된 요청 키값 조회는 FN-009 에서 404(EX-DATA-003)로 응답한다(정합).

### API 인터페이스

해당 없음 — 앱 내부 스케줄 작업으로 사용자·서비스 대면 엔드포인트가 없다. 실패는 HTTP EX 코드 없이 다음 주기 재시도로 처리한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| (내부) | - | 삭제 트랜잭션 오류·중단 | (사용자 미노출) | 롤백 후 다음 주기 재시도(OPS-003-03), 실패 감사 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-013 | 기동·종료 감사(단계 1·3) | 동기 | 감사 실패는 삭제 결과에 영향 없음 |

### 구현 가이드

- 삭제 대상 선정은 완료·미완료 두 갈래를 모두 포함하고 한 트랜잭션 흐름에서 처리한다. 조건절이 곧 멱등 가드이므로 재실행 시 중복 삭제가 발생하지 않는다(OPS-003-02).
- 완료/미완료 부분 인덱스(IX_STATUS_RETENTION_CONFIRMED·PENDING)를 활용해 범위 삭제 지역성을 높인다([ENT-004](../datas/data_ENT-004.md)). 배치 결과는 별도 상태 테이블에 저장하지 않고 감사 로그 detail 로만 남긴다.
