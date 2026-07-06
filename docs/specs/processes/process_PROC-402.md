# 보관정책 배치 삭제 기능 정의

## 개요

- **정의 대상**: 일 1회 스케줄 배치로 보관 기간이 경과한 처리 상태(ENT-004)를 하드 삭제해 무기한 누적을 막는 배치 프로세스. 결과 확인 완료 건은 결과 확인 일시 기준, 미완료 건은 처리 일시 기준으로 각각 90일 경과분을 선정·삭제하고 실행 결과를 감사 로그에 남긴다. 재실행 시 중복 삭제·부작용이 없도록 멱등하게 동작한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "상태 보관·정리: 일 단위 배치로 보관 기간 경과분 삭제" · §시스템 제약사항 "결과 확인 완료 후 3개월이 지나면 배치로 삭제".

---

## PROC-402 보관정책 배치 삭제

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 보관정책 배치 삭제 |
| 분류 | BAT |
| 그룹 | 상태·보관 |
| 트리거 유형 | 스케줄(일 1회) |
| 처리 방식 | 백그라운드(스케줄 작업) |
| 우선순위 | 보통 |
| 관련 IA 항목 | BAT-02 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-007 | 상태 보관 배치 |
| 정책(policy) | DATA-004·OPS-003·OPS-002 | 보관 기간·하드 삭제·배치 실행·감사 |
| 공통 기능(FN) | FN-011(보관 만료 대상 선정·삭제)·FN-013(감사) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-402(배치 실행 결과) | 감사 detail 요약 |
| DB 엔터티(ENT) | ENT-004(처리 상태)·ENT-006(배치 감사) | 삭제·감사 대상 |
| 화면(SCR) | (없음 — 내부 스케줄 작업) | 대면 화면·엔드포인트 없음 |

### 진입점 및 진입 조건

- **진입점**: 앱 내부 스케줄 작업(일 1회 도래). 사용자·서비스 대면 엔드포인트 없음.
- **진입 조건**: 스케줄 시각 도래. 단일 App Service 내 스케줄러 기동.
- **사전 검증**: 실행 기준 시각(now)·보관 기간(retentionDays 기본안 90) 확정, threshold = now - 90일 산출.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | now | DateTime | Y | 배치 실행 기준 시각(스케줄 도래) |
| 입력 | retentionDays | number | Y | 보관 기간(기본안 90) |
| 출력 | result | MDL-402 | - | targetCount·deletedCount·elapsedMs·runAt(감사 detail) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음.
- **데이터 조회 대상**: ENT-004(완료 건·미완료 건 삭제 대상 — 조건절 청크 DELETE).
- **데이터 변경 대상(CRUD)**: ENT-004 청크 DELETE(하드 삭제, 두 갈래), ENT-006 INSERT(기동·종료 감사). 배치 결과는 상태 테이블 미저장(감사 detail 로만 기록).

### 실행 제약사항

- **트랜잭션 경계**: 삭제는 청크 단위 다중 트랜잭션(청크마다 커밋). 실패 시 진행 중 청크만 롤백(커밋 청크의 삭제는 유지)하고 잔여분은 다음 주기 재시도(OPS-003-03). 배치 결과는 별도 상태 테이블에 저장하지 않음.
- **동시성 제어**: 조건절이 곧 멱등 가드 + 청크 단위 커밋 — 중단·재실행 시 이미 커밋된 삭제분 미해당, 잔여 대상만 다시 삭제(OPS-003-02). 중복 삭제·부작용 없음.
- **성능 요구**: 완료/미완료 부분 인덱스(IX_STATUS_RETENTION_CONFIRMED·PENDING)로 삭제 대상 선정. 대량 삭제는 청크 DELETE(`ctid IN ... LIMIT`, 청크 기본 5,000행)·청크 단위 커밋으로 단일 트랜잭션 크기·잠금을 상한한다 — [ENT-004](../datas/data_ENT-004.md) §구현 가이드·[FN-011](../functions/function_FN-011.md) 확정.
- **보안 요구**: 개인정보 미취급(ENT-004 개인식별 컬럼 부재). 실행 결과 감사(OPS-003-03). 삭제 사실 자체는 미보관.

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 앱 내부 스케줄 작업으로 사용자·서비스 대면 FE 처리 단계가 없다.
삭제된 요청 키값 조회는 PROC-301 에서 404 EX-DATA-003 으로 응답한다(정합).
```

#### BE 측 처리 (의사코드)

```
B1. 기동 — FN-011_runRetentionBatch(now, retentionDays=90)  (OPS-003-01)
  트리거: 스케줄 도래(일 1회, cron 표현식 build 확정)
  start = now; threshold = now - INTERVAL '90 days'
  FN-013_writeAudit({ eventType:'BATCH_RUN', actorType:'BATCH', result:'INFO',
                      detail:'retention start' })

B2. 삭제 대상 선정·삭제 — DATA-004-01/02/03·OPS-003-02  (BR-401)
  // 완료 건: 결과 확인 일시 + 90일 경과 — 부분 인덱스 IX_STATUS_RETENTION_CONFIRMED 로 선정
  deletedConfirmed = 0
  repeat                                      // 청크 DELETE — 청크마다 트랜잭션 커밋(ENT-004 확정)
    n = DELETE FROM TBL_INTERLOCK_PROCESS_STATUS
        WHERE ctid IN (SELECT ctid FROM TBL_INTERLOCK_PROCESS_STATUS
                       WHERE is_result_confirmed = true AND result_confirmed_at < :threshold
                       LIMIT :chunkSize);      // 하드 삭제, chunkSize 내부 상수(기본 5,000행, ENT-004)
    COMMIT; deletedConfirmed += n
  until n = 0
  // 미완료 건: 처리 일시 + 90일 경과(IX_STATUS_RETENTION_PENDING, 무기한 누적 방지)
  deletedPending = 동일 청크 루프
      (WHERE is_result_confirmed = false AND processed_at < :threshold)
  // 하드 삭제(소프트 삭제·보관 플래그 미사용, DATA-004-03). 조건절이 곧 멱등 가드 + 청크 단위 커밋 —
  // 중단·재실행 시 이미 커밋된 삭제분은 미해당, 잔여 대상만 다시 삭제(OPS-003-02)
  // 오류 시 진행 중 청크만 ROLLBACK(커밋 청크의 삭제 유지) → 잔여분 다음 주기 재시도(OPS-003-03)

B3. 결과 집계 — OPS-003-03  (감사)
  result = { targetCount: deletedConfirmed + deletedPending,
             deletedCount: deletedConfirmed + deletedPending,
             elapsedMs: now2 - start, runAt: start }   // MDL-402
  FN-013_writeAudit({ eventType:'BATCH_RUN', actorType:'BATCH', result:'SUCCESS',
                      detail: summarize(result) })      // 감사 detail 로만 기록

B4. 반환(별도 저장 없음)
  return result   // 상태 테이블 미저장
  정책 적용 지점: DATA-004(보관 기간·하드 삭제), OPS-003(기동·멱등·집계 감사), OPS-002(감사)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 도메인→ENT | BE(배치) | threshold 기준 | ENT-004 청크 DELETE(두 갈래) | 완료=result_confirmed_at, 미완료=processed_at |
| 도메인→ENT(감사) | BE(감사) | 배치 결과 | ENT-006 detail | MDL-402 요약을 감사 로그 detail 로 직렬화(OPS-003-03) |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 배치 기동 | (스케줄 도래) | threshold 산출 + 기동 감사 | threshold |
| 2 | BE | 완료 건 삭제 | threshold | is_result_confirmed=true AND result_confirmed_at<threshold 청크 DELETE 루프(청크 커밋) | deletedConfirmed |
| 3 | BE | 미완료 건 삭제 | threshold | is_result_confirmed=false AND processed_at<threshold 청크 DELETE 루프(청크 커밋) | deletedPending |
| 4 | BE | 결과 집계·감사 | 삭제 건수 | MDL-402 요약 + BATCH_RUN SUCCESS 감사 | 배치 결과 |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-401 | 완료 건 / 미완료 건 | 완료=결과확인일시 기준, 미완료=처리일시 기준 각 90일 경과 선정 | 두 갈래 대상 삭제 |
| (내부) 배치 실패 | 삭제 트랜잭션 오류·중단 | 진행 중 청크만 롤백(커밋 청크 유지), 잔여분 다음 주기 재시도, 실행 실패 감사 | 사용자 미노출(HTTP EX 없음) |

> 배치는 서버 내부 스케줄 작업으로 사용자·서비스 대면 응답이 없어 HTTP EX 코드를 두지 않는다. 실패는 다음 주기 재시도로 흡수한다(OPS-003-03).

### 실행 결과

- **정상 결과**: 완료·미완료 두 갈래 하드 삭제, BATCH_RUN(SUCCESS) 감사 detail 에 대상·삭제 건수·소요 기록. 상태 테이블 미저장.
- **실패 결과**: 삭제 트랜잭션 오류 시 진행 중 청크만 롤백(커밋 청크의 삭제 유지) + 실패 감사, 잔여분 다음 주기 재시도. HTTP EX 없음.
- **후속 트리거**: 없음. 삭제된 요청 키값 조회는 PROC-301 에서 404 EX-DATA-003(정합).

### 의존 프로세스

- **호출 관계**: 없음(FN-011·FN-013 단위 로직만 호출).
- **선행 관계**: PROC-401(저장된 처리 상태 존재).
- **이벤트 관계**: 삭제 후 PROC-301 조회 404 정합(삭제 사실 미보관).

### 구현 가이드

- 삭제는 완료·미완료 두 갈래를 한 배치 실행 흐름에서 처리하되, 청크 단위 반복 삭제(`ctid IN ... LIMIT`)와 청크마다 커밋으로 단일 트랜잭션 크기·잠금을 상한한다 — 청크 수치(기본 5,000행)·패턴·근거는 [ENT-004](../datas/data_ENT-004.md) §구현 가이드 확정을 따른다. 조건절이 곧 멱등 가드 + 청크 단위 커밋이므로 중단·재실행 시 이미 커밋된 삭제분은 미해당하고 잔여 대상만 다시 삭제된다(OPS-003-02).
- 삭제 대상 선정은 완료/미완료 부분 인덱스(IX_STATUS_RETENTION_CONFIRMED·PENDING)로 수행한다. 물리 저장 지역성은 삭제 성능 근거로 삼지 않으며, 삭제 후 공간 회수는 autovacuum 에 위임한다(테이블 단위 scale_factor 하향 — [ENT-004](../datas/data_ENT-004.md)). 배치 결과는 별도 상태 테이블에 저장하지 않고 감사 로그 detail 로만 남긴다.
- 90일 기준·일 배치 주기·미완료 삭제 기준은 기본안이며(EXC-DATA-05) 확정 시 DATA-004·FN-011 을 리비전한다. cron 표현식 등 스케줄러 운영 구성값은 build 단계에서 확정한다(청크 삭제 전략은 spec 확정 — ENT-004·FN-011).
