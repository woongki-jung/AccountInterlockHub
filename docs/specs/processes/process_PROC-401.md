# 처리상태 저장·결과확인 갱신 기능 정의

## 개요

- **정의 대상**: 처리 상태(ENT-004)의 저장·결과 확인 갱신을 담당하는 데이터 처리 프로세스. 연동 실행 결과 확정 시 상태 1건을 생성(전달 성공·실패·거부 모두)하고, 서비스 A 조회 성공 시 결과 확인 여부·일시를 최초 1회 멱등 갱신한다. 저장 항목을 요청 키값·구성 참조·상태 4항목·생성 감사로 한정하고 개인식별 컬럼을 원천 배제한다. PROC-203(저장)·PROC-301(갱신)이 위임 호출하는 종착(persistence) 프로세스다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §시스템 제약사항 "요청 키값별 상태(처리 성공 여부·결과 확인 여부·처리일시·결과 확인일시)만 저장".

---

## PROC-401 처리상태 저장·결과확인 갱신

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 처리상태 저장·결과확인 갱신 |
| 분류 | RR·EVT |
| 그룹 | 상태 저장 |
| 트리거 유형 | 시스템 이벤트(PROC-203 저장 호출·PROC-301 갱신 호출) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | BAT-01 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-005 | 처리상태 저장(BAT-01) |
| 정책(policy) | DATA-003·DATA-001-02 | 최소 항목 저장·개인식별 배제 |
| 공통 기능(FN) | FN-009(저장·조회·갱신) | 호출 단위 로직(데이터 처리 유닛) |
| 데이터 모델(MDL) | MDL-301(처리 상태) | 도메인 모델 |
| DB 엔터티(ENT) | ENT-004(처리 상태) | 저장·갱신 대상 |
| 화면(SCR) | (없음 — 내부 데이터 처리) | 대면 화면 없음 |

### 진입점 및 진입 조건

- **진입점**: PROC-203 저장 호출(`FN-009_saveStatus`, 전달 결과 확정 시) · PROC-301 갱신 호출(`FN-009_confirmResult`, 최초 조회 성공 시). 독립 엔드포인트 아님.
- **진입 조건**: 저장은 연동 실행 결과 확정(성공·실패·거부), 갱신은 대상 상태 존재(조회 성공).
- **사전 검증**: 저장 시 개인식별 컬럼 부재 assert(요청 키값·구성 참조·상태 4항목만), 갱신 시 결과 확인 여부 가드.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력(저장) | status | MDL-301 | Y | requestKey·configId·isSuccess·processedAt(개인정보 미포함) |
| 입력(갱신) | requestKey, now | string·DateTime | Y | 결과 확인 갱신 키·일시 |
| 출력 | status | MDL-301 | - | 저장·갱신 결과 |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(DB 접근만).
- **데이터 조회 대상**: ENT-004(갱신 전 조회 — findByKey는 PROC-301 이 수행, 본 PROC 은 조건절 가드 UPDATE).
- **데이터 변경 대상(CRUD)**: ENT-004 INSERT(저장) / UPDATE(결과 확인 갱신). 감사는 호출 PROC(203·301)이 수행.

### 실행 제약사항

- **트랜잭션 경계**: 저장·갱신 각각 단건 트랜잭션. 저장 INSERT 는 PK(request_key) 유니크로 중복 방지.
- **동시성 제어**: 결과 확인 갱신은 WHERE is_result_confirmed=false 멱등 가드로 최초 1회만 반영(BR-301). 재실행 시 미갱신.
- **성능 요구**: 단건 INSERT/UPDATE. PK 조회. 별도 임계치 없음.
- **보안 요구**: 개인식별 컬럼 원천 배제(DATA-001-02·DATA-003-01), 회원 키·마스킹 대상 필드 부재. 결과 확인 여부·일시 정합은 DB CHECK 로 강제.

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 상태 저장·조회 갱신의 데이터 처리 유닛으로 FE 처리 단계가 없다.
서비스 대면 응답(마스킹·엔벨로프)은 호출 PROC-301 이 FN-010·FN-015 로 구성한다.
```

#### BE 측 처리 (의사코드)

```
B1. 상태 저장 — FN-009_saveStatus(status)  (DATA-003-01/02·DATA-001-02)  [PROC-203 호출]
  assert(status has only { requestKey, configId, isSuccess, processedAt })  // 개인식별 배제
  BEGIN;
    INSERT INTO TBL_INTERLOCK_PROCESS_STATUS
      (request_key, config_id, is_success, is_result_confirmed,
       processed_at, result_confirmed_at, created_at)
    VALUES (:requestKey, :configId, :isSuccess, false, :processedAt, NULL, now());
    // 성공·실패·거부 모두 1건(EXC-DATA-03·EXC-BIZ-06)
    // CHECK: (is_result_confirmed=false AND result_confirmed_at IS NULL) 정합 만족
  COMMIT;
  return status(isResultConfirmed=false)

B2. 결과 확인 갱신 — FN-009_confirmResult(requestKey, now)  (DATA-003-03, 멱등)  [PROC-301 호출]
  // 조회(findByKey)는 PROC-301 B4 에서 선행(미존재 404 판정)
  if (status.isResultConfirmed == false):    // 최초 조회만 갱신
      BEGIN;
        UPDATE TBL_INTERLOCK_PROCESS_STATUS
          SET is_result_confirmed = true, result_confirmed_at = :now
        WHERE request_key = :requestKey AND is_result_confirmed = false;   // 멱등 가드
      COMMIT;
      status.isResultConfirmed = true; status.resultConfirmedAt = now
  return status                              // 재조회는 갱신 없이 현재 상태
  정책 적용 지점: DATA-003(저장·갱신 시점), DATA-001-02(개인식별 배제), ENT-004 CHECK 정합
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 도메인→ENT | BE 리포지토리 | MDL-301(저장) | ENT-004 행(INSERT) | requestKey·configId·is_success·processed_at, is_result_confirmed=false |
| 도메인→ENT | BE 리포지토리 | 갱신 명령 | ENT-004 UPDATE | is_result_confirmed=true·result_confirmed_at(가드 조건) |
| ENT→도메인 | BE 리포지토리 | ENT-004 행 | MDL-301 | 직접 매핑·NULL 처리 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 상태 저장(호출 PROC-203) | 전달 결과 | 개인식별 배제 assert + INSERT 1건 | 저장된 상태 |
| 2 | BE | 결과 확인 갱신(호출 PROC-301) | 조회된 상태 | is_result_confirmed=false 가드 UPDATE(BR-301) | 갱신된 상태 |

> 두 진입은 서로 다른 호출 PROC(저장=PROC-203, 갱신=PROC-301)에서 독립 위임된다. 한 요청에서 저장·갱신이 연쇄하지 않는다(저장은 연동 실행 시점, 갱신은 이후 조회 시점).

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-301 | 결과 확인 최초 미확인 / 이미 확인됨 | 최초=UPDATE(가드), 재실행=미갱신 | 멱등 갱신 |
| EX-DATA-003 | (조회 시) 요청 키값 미존재 | PROC-301 findByKey 에서 판정 | 404(본 PROC UPDATE 미진입) |
| EX-FN-999 | INSERT·UPDATE 오류 | 롤백, 감사 권장 | 500 잠시 후 다시 시도해주세요. |

> 저장은 성공·실패·거부 모두 1건 생성한다(EXC-DATA-03·EXC-BIZ-06). 삭제된 키 조회는 FN-009 findByKey(PROC-301)에서 404 로 판정되므로 본 PROC 갱신은 진입하지 않는다.

### 실행 결과

- **정상 결과(저장)**: ENT-004 1건 INSERT(is_result_confirmed=false, result_confirmed_at=NULL). 호출 PROC-203 로 반환.
- **정상 결과(갱신)**: 최초 조회 시 is_result_confirmed=true·result_confirmed_at 갱신(멱등). 재조회는 무갱신.
- **실패 결과**: EX-FN-999(INSERT·UPDATE 오류). 트랜잭션 롤백.
- **후속 트리거**: 없음(종착 프로세스). 저장된 상태는 PROC-301 조회·PROC-402 보관 대상.

### 의존 프로세스

- **호출 관계**: 없음(FN-009 단위 로직만 수행). 어떤 PROC 도 호출하지 않는 종착 프로세스(순환 없음).
- **선행 관계**: 저장=PROC-203(전달 결과 확정) 또는 PROC-202 거부 경로 / 갱신=PROC-301(조회 성공).
- **이벤트 관계**: 없음.

### 구현 가이드

- 요청 키값을 조회 키(PK)로 두고, 4개 상태 항목 외 개인정보성 컬럼을 스키마에서 원천 배제한다(스키마 상세는 ENT-004). DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02).
- 결과 확인 갱신은 최초 조회 성공 시 1회 수행하도록 조건절 가드(is_result_confirmed=false)로 멱등하게 설계한다. 결과 확인 여부·일시 정합은 DB CHECK 로 강제한다(ENT-004).
- 본 PROC 은 조회 응답 마스킹·엔벨로프를 수행하지 않는다 — 서비스 대면 응답은 호출 PROC-301 이 FN-010·FN-015 로 구성한다.
