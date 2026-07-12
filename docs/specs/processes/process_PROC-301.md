# 처리상태 확인 API 기능 정의

## 개요

- **정의 대상**: 발송처가 **연동 추적 키**를 기준으로 연동 요청의 처리·결과 확인 상태를 조회하는 서버 대면 API 프로세스. 응답에는 처리 상태 4항목만 담고 회원 키·개인정보를 포함하지 않으며, 최초 조회 성공 시 결과 확인 여부·일시를 멱등 갱신한다. 조회 키는 tracking_key(비유니크)이며 재사용 시 처리 일시 최신 1건을 반환한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 5 "처리상태 확인 API: 발송처가 연동 추적 키 기준으로 처리·결과 확인 상태를 조회".

> **2026-07-11 `#214` 개정**: 조회 키를 **허브 발급 요청 키값(UUID)에서 연동 추적 키(tracking_key)**로 전환했다. FN-007 은 UUID 형식 강제 대신 **비어있지 않음·최대 길이(255)**만 검증하고, FN-009 는 (tracking_key, processed_at DESC) 최신 1건을 조회한다. 인증 주체는 발송처 자격(SEC-003-03)이다.

---

## PROC-301 처리상태 확인 API

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 처리상태 확인 API |
| 분류 | RR |
| 그룹 | 서비스 연동 API |
| 트리거 유형 | API 호출(발송처 서버) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | API-01 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-006 | 처리상태 확인 API |
| 정책(policy) | SEC-003·OPS-001·DATA-002·SEC-004·DATA-003·SEC-005 | API 인증(주체 분리)·요청 제한·형식 검증·상태 갱신·응답 항목 한정·로그/감사 마스킹 |
| 공통 기능(FN) | FN-004(API 인증)·FN-014(요청 제한)·FN-005(입력 검증)·FN-007(추적 키 형식 검증)·FN-009(조회·갱신)·FN-010(응답 선별)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-202(연동 추적 키)·MDL-301(처리 상태)·MDL-302(조회 응답) | 요청·도메인·응답 모델 |
| DB 엔터티(ENT) | ENT-004(처리 상태)·ENT-006(인증 실패 감사) | 조회·갱신·감사 대상 |
| 화면(SCR) | (없음 — 발송처 서버 호출) | 대면 화면 없음 |

### 진입점 및 진입 조건

- **진입점**: `GET /api/status/:trackingKey`. 발송처 서버가 사전 공유 인증 수단으로 호출.
- **진입 조건**: FN-004 API 인증 통과(API 키 또는 서명 헤더, HTTPS 전제) + 인증 주체가 발송처 자격(SEC-003-03).
- **사전 검증**: 인증(FN-004), 요청 제한(FN-014 분당 60회, 인증 주체 기준), 연동 추적 키 형식(FN-007 비어있지 않음·최대 길이 255).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | credential | string | Y | Authorization/API-Key 헤더 또는 서명(로그 배제) |
| 입력 | trackingKey | string | Y | 조회 대상 연동 추적 키(URL 경로 파라미터) |
| 출력 | response | MDL-302 | - | 상태 4항목 + 추적 키 **원문 에코**(회원 키·configId 배제, 로그·감사만 마스킹 — FN-010) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(조회·갱신만).
- **데이터 조회 대상**: ENT-004(tracking_key 조회 — 처리 일시 최신 1건, IX_STATUS_TRACKING).
- **데이터 변경 대상(CRUD)**: ENT-004 UPDATE(최초 조회 시 is_result_confirmed·result_confirmed_at, surrogate id 대상, PROC-401 경유), ENT-006 INSERT(인증 실패 감사).

### 실행 제약사항

- **트랜잭션 경계**: 결과 확인 갱신은 surrogate id 대상 조건절 가드(is_result_confirmed=false) 단건 UPDATE 트랜잭션. 조회는 단순 SELECT(최신 1건).
- **동시성 제어**: 결과 확인 갱신은 surrogate id + WHERE is_result_confirmed=false 멱등 가드로 최초 1회만 반영(BR-301). 재조회는 갱신 없이 현재 상태. 추적 키 재사용 시 처리 일시 최신 1건(EXC-BIZ-12).
- **성능 요구**: 요청 제한 분당 60회 초과 시 429(FN-014). IX_STATUS_TRACKING(tracking_key, processed_at DESC) 최신 1건 조회.
- **보안 요구**: API 인증·주체 분리(SEC-003-03), 응답 4항목만(SEC-005-02)·추적 키는 원문 에코(발송처 자신의 값, 로그·감사만 마스킹 — FN-010·SEC-005-04), 인증 실패 감사 시 추적 키 마스킹(FN-010). 회원 키 응답 배제.

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — 발송처 서버 대면 API 로 허브 SPA(FE) 처리 단계가 없다.
호출 주체는 발송처 서버이며 사전 공유 인증 수단(API 키/서명)으로 요청한다.
응답 계약(성공 엔벨로프 { success, data: MDL-302 } / 실패 { success, error })은
FN-015 가 구성하며, 발송처가 상태 4항목을 소비한다.
```

#### BE 측 처리 (의사코드)

```
B1. API 인증·주체 구분 — FN-004_authenticateServiceApi(credential, requestBody, expectedActor='SERVICE_A'(발송처), trackingKey, now)  (SEC-003-03)
  엔드포인트: GET /api/status/:trackingKey (인증 가드 선적용)
  if (자격 누락·불일치·서명 불일치·시간창 초과·주체 불일치):
        // 인증 실패 감사(API_AUTH_FAIL, target=trackingKey 마스킹)는 FN-004 내부에서 기록
        → 401 EX-SEC-003
  caller = 인증된 호출 주체(요청 제한 주체 키)

B2. 요청 제한 — FN-014_checkRateLimit(caller, 'status', now, 60)  (OPS-001)
  초과 → 감사(RATE_LIMIT, BLOCKED) → 429 EX-OPS-001

B3. 입력 검증 — FN-005 + FN-007_validateTrackingKeyFormat(trackingKey)  (SEC-004·DATA-002-07)
  본문/파라미터 형식(타입)·크기 위반 → 400 EX-SEC-004 / 413 EX-SEC-005
  // 주입 패턴은 파라미터 바인딩 단독 방어(SEC-004-01/02) — 별도 재검증 없이 비매칭 일반값으로 통과, 미존재 시 B4 에서 404 EX-DATA-003
  if (blank(trackingKey) OR len(trackingKey) > 255) → 400 EX-DATA-002   // UUID 강제 아님(발송처 구성 자유)

B4. 상태 조회 — FN-009_findByKey(trackingKey)  (DATA-003-06 진입)
  SELECT id, tracking_key, config_id, is_success, is_result_confirmed,
         processed_at, result_confirmed_at
  FROM TBL_INTERLOCK_PROCESS_STATUS
  WHERE tracking_key = :trackingKey
  ORDER BY processed_at DESC LIMIT 1;   -- IX_STATUS_TRACKING, 재사용 시 최신 1건(EXC-BIZ-12)
  if (row is null) → 404 EX-DATA-003   // 만료 삭제 포함(EXC-DATA-04)

B5. 결과 확인 갱신 — PROC-401 / FN-009_confirmResult(trackingKey, now)  (BR-301, 멱등)
  if (row.is_result_confirmed == false):     // 최초 조회만 갱신
        UPDATE TBL_INTERLOCK_PROCESS_STATUS
          SET is_result_confirmed = true, result_confirmed_at = :now
        WHERE id = :row.id AND is_result_confirmed = false;   // surrogate id·멱등 가드
        row.is_result_confirmed = true; row.result_confirmed_at = now
  // 재조회는 갱신 없이 현재 상태

B6. 응답 변환 — FN-010_selectStatusResponse(status)  (SEC-005-02)
  response = { trackingKey: trackingKey,           // 원문 에코(발송처 자신의 값, 응답 노출) — 로그·감사만 마스킹(FN-010·SEC-005-04)
               isSuccess, isResultConfirmed,
               processedAt(iso8601), resultConfirmedAt(iso8601|null) }  // configId·회원 키 배제
  응답: FN-015_ok(response)   // MDL-302
  정책 적용 지점: SEC-003(인증·주체), OPS-001(제한), DATA-002(형식·불투명), DATA-003(갱신), SEC-005(4항목·마스킹)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 요청→도메인 | BE 컨트롤러 | 헤더+trackingKey | 인증 주체·조회 키 | FN-004 인증·주체 구분·FN-007 형식 검증 |
| ENT→도메인 | BE 리포지토리 | ENT-004 행(최신 1건) | MDL-301 | 직접 매핑·NULL(result_confirmed_at) 처리·내부 id 미노출 |
| 도메인→ENT | BE(PROC-401) | 최초 조회 | ENT-004 UPDATE | is_result_confirmed=true·result_confirmed_at(surrogate id) |
| 도메인→응답 | BE 컨트롤러 | MDL-301 | MDL-302 | 4항목 선별·추적 키 원문 에코(로그·감사만 마스킹)·configId·회원 키 배제·ISO8601 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | API 인증·주체 구분 | (발송처 호출) | FN-004 자격·서명·발송처 자격 검증(실패 마스킹 감사) | 인증 주체 |
| 2 | BE | 요청 제한 | 인증 주체 | FN-014 분당 60회 검사 | 통과 |
| 3 | BE | 입력 검증 | 통과 | FN-005 + FN-007 추적 키 형식(비공백·255) | 조회 키 |
| 4 | BE | 상태 조회 | 조회 키 | ENT-004 tracking_key 최신 1건 조회(미존재 404) | 처리 상태 |
| 5 | BE | 결과 확인 갱신 | 처리 상태 | FN-009 최초 조회 멱등 갱신(surrogate id, BR-301) | 갱신된 상태 |
| 6 | BE | 응답 변환 | 갱신된 상태 | FN-010 4항목 선별·추적 키 원문 에코(로그·감사만 마스킹) + FN-015 | MDL-302 |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-301 | 결과 확인 최초 미확인 / 이미 확인됨 | 최초=결과 확인 여부·일시 갱신, 재조회=무갱신 | 갱신 또는 현재 상태 응답 |
| EX-SEC-003 | API 인증 실패·서명 불일치·주체 불일치 | 응답 차단, 감사(추적 키 마스킹) | 401 인증에 실패했습니다. |
| EX-OPS-001 | 분당 60회 초과 | 요청 거부, 감사 | 429 잠시 후 다시 시도해주세요. |
| EX-DATA-002 | 연동 추적 키 형식 위반(공백·최대 길이 255 초과) | 조회 거부 | 400 연동 추적 키 형식이 올바르지 않습니다. |
| EX-DATA-003 | 연동 추적 키 미존재(만료 삭제 포함) | 조회 실패 | 404 해당 요청을 찾을 수 없습니다. |
| EX-SEC-004 | 형식(타입)·크기 위반(주입 패턴은 파라미터 바인딩 단독 방어 — SEC-004-01, 비매칭 일반값 통과 후 404 EX-DATA-003) | 조회 거부 | 400 요청이 올바르지 않습니다. |
| EX-SEC-005 | 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-FN-999 | 조회·갱신 오류 | 오류 응답 | 500 잠시 후 다시 시도해주세요. |

### 실행 결과

- **정상 결과**: MDL-302 상태 4항목 + 추적 키 원문 에코(로그·감사만 마스킹) 응답. 최초 조회 시 ENT-004 결과 확인 갱신 1회.
- **실패 결과**: EX-SEC-003(401)·EX-OPS-001(429)·EX-DATA-002(400)·EX-DATA-003(404) 엔벨로프. 인증 실패는 추적 키 마스킹 감사.
- **후속 트리거**: 없음. 갱신된 상태는 PROC-402 보관 배치의 결과 확인 건(result_confirmed_at 기준 90일 / created_at 기준 180일 절대 상한) 대상이 된다.

### 의존 프로세스

- **호출 관계**: PROC-401(동기, 결과 확인 갱신 — FN-009_confirmResult).
- **선행 관계**: PROC-203(연동 실행·상태 저장, PROC-401 경유)으로 저장된 처리 상태 존재.
- **이벤트 관계**: 최초 조회 성공이 결과 확인 갱신을 트리거한다.

### 구현 가이드

- 조회 응답 DTO 에 회원 키·configId 필드를 두지 않고, 추적 키는 원문 그대로 에코한다(발송처 자신의 값이므로 응답 노출 — 신규 유출 아님). 마스킹(앞2·뒤2)은 로그·감사·오류 응답 계층에만 적용한다(FN-010·SEC-005-04). 결과 확인 갱신은 최초 조회 성공 시 1회만 수행하도록 surrogate id + 조건절 가드(is_result_confirmed=false)로 멱등하게 설계한다.
- 형식은 맞으나 미존재(만료 삭제 포함)인 연동 추적 키는 404 EX-DATA-003 으로 응답한다(PROC-402 배치 삭제와 정합). 삭제 사실 자체는 보관하지 않는다. 추적 키 재사용 시 (tracking_key, processed_at DESC)로 처리 일시 최신 1건을 조회한다(EXC-BIZ-12).
- 추적 키는 불투명 문자열로 취급해 UUID 등 특정 형식을 강제하지 않는다(발송처 구성 자유, DATA-002-06). 서비스 대면 API 인증 수단(API 키/서명 알고리즘)은 담당자 확정 대기이며 확정 시 SEC-003·FN-004 를 리비전한다. 자격 값은 상수 시간 비교로 검증하고 로그에 남기지 않는다.
