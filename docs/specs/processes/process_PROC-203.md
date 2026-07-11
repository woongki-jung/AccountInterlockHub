# 연동 실행·수신처 B 전달 기능 정의

## 개요

- **정의 대상**: 사용자 승인이 완료된 연동 요청에 대해 허브가 **사용자 생년월일로 이중 암호값을 복호화**(encY→복원 키→encX→전달 데이터 X)해 연동 추적 키를 확보하고, **연동이력 1건을 생성**(복호화 후)한 뒤 복호화 원문 X 를 접근 주소 구성의 **수신처(B) 전달 주소로 서버-서버 POST** 로 중개하고 처리 상태 1건을 저장하는 연동형 프로세스. 복호화 원문·암호값·생년월일·복원 키는 메모리에서만 다루고 전달 후 폐기한다. 외부 호출은 반드시 BE 를 경유한다(브라우저 미경유).
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 4 "연동 실행(허브 복호화·전달): 승인 시 허브가 생년월일로 encY→키→encX→X 복호화 → X 를 접근 주소에 설정된 수신처(B) 주소로 전달 → 성공 시 연동 완료 페이지".

> **2026-07-11 `#214` 개정**: 회원 키 직수신·직전달을 **허브 복호화(encX/encY)·복호화 원문 X 서버-서버 전달**로 재정의하고, **연동이력 생성을 복호화 성공 이후(내부 PROC-403)로 편입**했다. 전달 페이로드는 복호화 원문 X 이며, 추적 키는 X 내부 필드다. 전달 파라미터 정의(구 ENT-003)·회원 키 리매핑·요청 키값 컨텍스트는 폐기됐다.

---

## PROC-203 연동 실행·수신처 B 전달

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 실행 — 허브 복호화·연동이력 생성·수신처 B 서버-서버 전달·처리 상태 저장 |
| 분류 | INT |
| 그룹 | 사용자 연동 |
| 트리거 유형 | 시스템 이벤트(PROC-202 승인 경로 내부 호출) |
| 처리 방식 | 동기(복호화·외부 호출·재시도 포함) |
| 우선순위 | 높음 |
| 관련 IA 항목 | USR-02, BAT-01, BAT-03 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-005 | 복호화·연동이력 생성·수신처 전달·상태 저장(BR-204·BR-202) |
| 정책(policy) | BIZ-003·BIZ-004·SEC-006·SEC-007·SEC-002·AUTH-004·DATA-001·DATA-002·DATA-003·DATA-005·SEC-005·OPS-002 | 복호화·전달·상태 전이·이력·신뢰 위임·무저장·마스킹·감사 |
| 공통 기능(FN) | FN-020(허브 복호화·추적 키 추출)·FN-016(연동이력 생성, PROC-403)·FN-012(수신처 B 서버-서버 전달)·FN-009(상태 저장, PROC-401)·FN-010(마스킹)·FN-013(감사) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-201(접근 컨텍스트·입력)·MDL-204(복호화 원문 X)·MDL-202(연동 추적 키)·MDL-303(연동이력)·MDL-301(처리 상태) | 입력·아웃바운드·저장 모델 |
| DB 엔터티(ENT) | ENT-001(구성 참조)·ENT-007(연동이력 생성, PROC-403)·ENT-004(상태 저장, PROC-401) | 참조·저장 대상 |
| 화면(SCR) | (없음 — PROC-202 내부 호출) | 결과는 SCR-006 표시 |

### 진입점 및 진입 조건

- **진입점**: PROC-202 승인(AGREE) 경로의 내부 호출(`PROC-203_executeInterlock(config, ctx, now)`). 독립 엔드포인트 아님.
- **진입 조건**: PROC-202 승인 게이팅 통과(필수 동의 충족·활성 구성 확인 완료), 접근 컨텍스트(encX·encY·생년월일) 확보.
- **사전 검증**: 승인 완료 확인(미승인 복호화·전달 차단), 상태 전이 유효성(승인→복호화→전달, 역전이 금지), 전달 대상 주소는 구성의 수신처 B 주소로 한정.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | config | MDL-101 | Y | 승인 게이팅 통과한 활성 구성(수신처 B 주소·메서드) |
| 입력 | ctx | 접근 컨텍스트 | Y | encX·encY·birthDate·accessAddressId(메모리·무저장) |
| 입력 | now | DateTime | Y | 연동 요청·처리 일시 |
| 출력 | status | MDL-301 | - | 전달 결과 반영 후 저장된 처리 상태 |

### 연관 데이터 및 외부 호출

- **호출 API**: 수신처 B 전달 주소(config.serviceBDeliveryUrl) — BE 경유 서버-서버 POST(SEC-007-01, 브라우저 미경유). 메서드=config.serviceBHttpMethod, 타임아웃·재시도 2회(기본안).
- **데이터 조회 대상**: config.serviceBDeliveryUrl·method(구성 참조). `#214` 로 전달 파라미터 정의(구 ENT-003) 조회는 폐기됐다.
- **데이터 변경 대상(CRUD)**: ENT-007 INSERT(연동이력 1건, 복호화 후 PROC-403→FN-016), ENT-004 INSERT(처리 상태 1건, 전달 후 PROC-401→FN-009), ENT-006 INSERT(복호화·전달 결과 감사).

### 실행 제약사항

- **트랜잭션 경계**: 복호화는 트랜잭션 밖 메모리 연산. 연동이력 생성(PROC-403)은 단건 INSERT 트랜잭션. 외부 전달은 트랜잭션 밖(멱등성 없는 side-effect). 처리 상태 저장(PROC-401)은 전달 결과 확정 후 단건 트랜잭션. 전달 실패여도 복호화 성공 이후이므로 연동이력·처리 상태 1건은 반드시 저장(EXC-BIZ-06·EXC-BIZ-11). 복호화 이전 실패(EX-SEC-006/007·EX-BIZ-008)는 추적 키가 없어 이력·상태를 생성하지 않는다(감사만).
- **동시성 제어**: 승인 컨텍스트 1회 실행(PROC-202 컨텍스트 폐기로 재실행 차단). 재시도는 순차(최초 1 + 재시도 2회). ENT-004·ENT-007 은 surrogate uuid PK 로 요청별 1행 안정 저장(추적 키 재사용 수용).
- **성능 요구**: 복호화(메모리 결정론)·외부 호출 타임아웃·재시도 정책(build 확정). 재시도 2회 후 실패 확정.
- **보안 요구**: encX·encY·생년월일·복원 키·복호화 원문 X·회원 키는 저장·로깅 금지(DATA-001-04·SEC-005-06), 복호화 원문 X 원본 무변형 전달(SEC-002-03)·서버-서버 전용(SEC-007-01), 구성 외 주소 전달 금지(BIZ-003-02), 로그·감사의 추적 키는 앞2·뒤2 마스킹(SEC-005-04, FN-010).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — PROC-202 승인 경로의 BE 내부 호출로 FE 처리 단계가 없다.
복호화·전달 결과(완료/복호화 실패·재입력/링크 오류/전달 실패)는 PROC-202 응답을 통해
SCR-005(복호화 실패 재입력·전달 실패 재시도) 또는 SCR-006(완료·링크 오류)에서 표시된다.
복호화 원문 X·회원 키·연동 추적 키는 완료 페이지 DTO·URL 에 포함하지 않는다(SEC-007-02).
```

#### BE 측 처리 (의사코드)

```
B1. 사전 조건 검증 — POL BIZ-003-06/07 (validate)
  // 진입 전제: PROC-202 가 FN-008 승인 게이팅(필수 동의 충족·활성 구성 확인)을 통과한 경우에만 본 PROC 을 호출
  assert(approvedByGating == true)               // 미승인 복호화·전달 차단(BIZ-003-06)
  assert(stateTransition == '승인→복호화')          // 역전이 금지(BIZ-003-07)
  if (!조건 충족)
        FN-013_writeAudit({ eventType:'DELIVERY_BLOCK', actorType:'SYSTEM',
                            target: ctx.accessAddressId, result:'BLOCKED' })
        → 내부 차단(EX 코드 없음)

B2. 허브 복호화·연동 추적 키 추출 — FN-020_decryptInterlock(ctx.encX, ctx.encY, ctx.birthDate, ctx.accessAddressId)  (SEC-006, BR-204)
  // FN-020 내부(재서술 없이 위임, 메모리 전용·전량 미기록):
  //   normalize32(s)=utf8[0:32] 또는 부족분 0x5F('_') 우패딩 ; iv16(s)=utf8[0:16] 또는 0x5F 우패딩
  //   ① rawY=base64urlDecode(encY); rawX=base64urlDecode(encX)                  → 실패 throw EX-SEC-007(400)
  //   ② keyY=normalize32(birthDate); ivY=iv16(birthDate)
  //      keyXstr = AES-256-CBC-decrypt(rawY, key=keyY, iv=ivY, pad=PKCS7)         → 패딩·키 불일치 throw EX-SEC-006(400)
  //   ③ keyX=normalize32(keyXstr); ivX=iv16(keyXstr)
  //      Xjson = AES-256-CBC-decrypt(rawX, key=keyX, iv=ivX, pad=PKCS7)           → 패딩·키 불일치 throw EX-SEC-006(400)
  //   ④ X = JSON.parse(Xjson)                                                     → 파싱 실패 throw EX-BIZ-008(400)
  //      trackingKey = X["trackingKey"] ; if (blank) throw EX-BIZ-008(400)
  //   ⑤ DECRYPT_SUCCESS 감사(target=accessAddressId, detail=trackingKey 마스킹) — 암호값·생년월일·원문 미기록(SEC-005-06)
  { X, trackingKey } = FN-020(...)               // 메모리 전용 반환
  // 전파: EX-SEC-007(암호 파라미터 형식)·EX-SEC-006(복호화 실패·생년월일 재입력)·EX-BIZ-008(추적 키 누락) → 이력·상태 미생성(추적 키 없음)

B3. 연동이력 생성(복호화 후) — 내부 PROC-403 생성 진입: FN-016_createInterlockHistory(trackingKey, config, now)  (BIZ-004-07·DATA-005)
  BEGIN;
    INSERT INTO TBL_INTERLOCK_HISTORY
      (id, tracking_key, config_id, requested_at, callback_received, callback_received_at, created_at)
    VALUES (gen_random_uuid(), :trackingKey, :config.id, :now, false, null, now());   // surrogate PK·5항목·전달에 앞서 생성
  COMMIT;
  FN-013_writeAudit({ eventType:'HISTORY_CREATE', actorType:'SYSTEM',
                      target: FN-010_mask(trackingKey), result:'SUCCESS' })

B4. 수신처 B 서버-서버 전달·상태 저장(위임) — FN-012_deliverToServiceB(X, trackingKey, config, now)  (SEC-007-01·BIZ-003-03, BR-202)
  // FN-012 내부(재서술 없이 위임 — 전달·재시도·상태 저장·실패 처리를 한 단위로 소유):
  //   ① targetUrl = config.serviceBDeliveryUrl; method = config.serviceBHttpMethod ?? 'POST'   // 구성 외 주소 금지(BIZ-003-02)
  //   ② payload = { targetUrl, httpMethod: method, payload: X }   // MDL-204 복호화 원문 X 무변형·저장 안 함(SEC-002-03)
  //   ③ attempt=0; success=false
  //      while (attempt<=2 AND !success):        // 최초 1 + 재시도 2회(기본안)
  //          resp = serverToServerCall(method, targetUrl, X, timeout)   // BE 직접 호출·브라우저 미경유(SEC-007-01)
  //          success = resp.ok ? true : (attempt++, false)
  //   ④ status = FN-009_saveStatus({ trackingKey, configId: config.id, isSuccess: success, processedAt: now })   // 내부 PROC-401
  //        // INSERT INTO TBL_INTERLOCK_PROCESS_STATUS (id, tracking_key, config_id, is_success, is_result_confirmed, processed_at, result_confirmed_at, created_at)
  //        //   VALUES (gen_random_uuid(), :trackingKey, :config.id, :success, false, :now, null, now());   // surrogate PK·성공/실패 1건(EXC-BIZ-06)
  //   ⑤ release(X)   // 전달 완료 즉시 복호화 원문 참조 해제(무저장·미기록, DATA-001-04)
  //   ⑥ if (!success) → DELIVERY_FAIL 감사(추적 키 마스킹) → throw DeliveryFailedError(502, EX-BIZ-004)   // 처리 상태·연동이력 저장됨(EXC-BIZ-06·EXC-BIZ-11)
  //      else          → DELIVERY_SUCCESS 감사(추적 키 마스킹) → return status
  status = FN-012_deliverToServiceB(X, trackingKey, config, now)   // 전파: EX-BIZ-004(502, 전달 실패·상태 저장됨)

B5. 접근 컨텍스트 폐기·완료 반환 — POL DATA-001-04·SEC-005-06
  release(ctx.encX, ctx.encY, ctx.birthDate, keyXstr)   // 승인 컨텍스트·복원 키 참조 해제(무저장·전량 미기록)
  return status   // 호출 PROC-202 가 완료 페이지(SCR-006, 복호화 원문·회원 키 미포함 SEC-007-02) 반환
  정책 적용 지점: SEC-006(복호화 규약)·SEC-002(무변형)·SEC-007(서버-서버·원문 미노출)·DATA-001(무저장)·BIZ-003(전달·재시도)·BIZ-004-07(이력 생성)·OPS-002(감사)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 요청→도메인 | BE(FN-020) | encX·encY·생년월일(메모리) | 복호화 원문 X + 연동 추적 키 | normalize32/iv16 정규화·AES-256-CBC·PKCS#7·encY→encX→X 순 복호화·추적 키 필드 추출(무저장) |
| 도메인→ENT(이력) | BE(FN-016, PROC-403) | 추적 키·구성 참조 | MDL-303 → ENT-007 행(INSERT) | 추적 키 무변형·5항목·복호화 후 생성(전달에 앞서, BIZ-004-07) |
| 도메인→응답(아웃바운드) | BE(FN-012) | 복호화 원문 X·config | MDL-204 페이로드 | X 무변형·서버-서버 POST(브라우저 미경유), 구성 바운드 targetUrl |
| 응답→도메인 | BE(FN-012) | 수신처 B 응답 | isSuccess | resp.ok 판정·재시도 집계 |
| 도메인→ENT(상태) | BE(PROC-401) | 전달 결과 | ENT-004 행(INSERT) | trackingKey·configId·is_success·processed_at, surrogate PK |
| 도메인→로그 | BE(감사) | 복호화·전달 이벤트 | ENT-006 행 | 추적 키 마스킹(FN-010)·암호값·원문·생년월일 미기록 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 사전 조건 검증 | (PROC-202 승인) | 승인 완료·상태 전이 검증(미승인 차단) | 검증 통과 |
| 2 | BE | 허브 복호화·추적 키 추출 | 접근 컨텍스트 | FN-020 encY→키→encX→X 복호화·추적 키 추출(BR-204, 실패 EX-SEC-006/007·EX-BIZ-008) | X·추적 키 |
| 3 | BE | 연동이력 생성 | 추적 키·구성 | 내부 PROC-403(FN-016) INSERT 1건(전달에 앞서, BIZ-004-07) | 연동이력 |
| 4 | BE | 수신처 B 전달·상태 저장 | X·구성 | FN-012 서버-서버 POST(재시도 2회, BR-202)·FN-009 상태 저장(내부 PROC-401)·실패 시 502 EX-BIZ-004 | 처리 상태 |
| 5 | BE | 컨텍스트 폐기·완료 반환 | 처리 상태 | 접근 컨텍스트·복원 키 폐기(무저장)·완료 페이지 반환(원문 미포함) | status/502 |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-204 | 복호화 성공 / 실패(생년월일 불일치·패딩 오류) | 성공=추적 키 추출·이력 생성·전달, 실패=생년월일 재입력 재시도 유도(하드 잠금 없음) | 성공→전달 / 실패→400 EX-SEC-006(SCR-005 재입력) |
| BR-202 | 수신처 B 응답 성공 / 실패 | 성공=처리완료, 실패=최대 2회 재시도 후 실패 확정 | 성공 상태 / 실패 상태(502 EX-BIZ-004) |
| EX-SEC-007 | 암호 파라미터(encX·encY) 누락·Base64URL 형식 오류 | 복호화 미수행·거부(발송처 데이터 오류, 재입력 불가) | 400 요청이 올바르지 않습니다.(SCR-006 링크 오류) |
| EX-SEC-006 | 복호화 실패(생년월일 불일치·패딩·키 불일치) | 생년월일 재입력 재시도 유도(하드 잠금 없음, 시도 감사) | 400 사용자 정보가 일치하지 않습니다.(SCR-005 재입력) |
| EX-BIZ-008 | 복호화된 X 파싱 실패·연동 추적 키 필드 누락·공백 | 연동 거부(발송처 데이터 오류, 재입력 불가) | 400 연동에 필요한 값이 없습니다.(SCR-006 링크 오류) |
| EX-BIZ-004 | 수신처 B 오류·전달 실패(재시도 2회 후) | 실패 상태 저장 + 감사 | 502 연동 대상 처리에 실패했습니다.(SCR-005 유지·재시도) |
| (내부 차단) | 미승인 전달·구성 외 주소·역전이 | 감사 로그 + 내부 차단(EX 코드 없음) | 사용자 미노출(BIZ-003-06/02/07) |
| EX-FN-999 | 복호화 라이브러리·이력·상태 저장 오류 | 롤백(진행 트랜잭션), 감사 | 500 잠시 후 다시 시도해주세요. |

> 복호화 실패(EX-SEC-006, 사용자 정정 가능=생년월일 재입력)와 발송처 데이터 오류(EX-SEC-007·EX-BIZ-008, 재입력 불가)는 구별한다(EXC-BIZ-13). 복호화 이전 실패는 추적 키가 없어 연동이력·처리 상태를 남기지 않는다(감사만). 전달 실패(EX-BIZ-004)여도 복호화 성공 이후라 연동이력·처리 상태 1건은 반드시 저장된다(EXC-BIZ-06·EXC-BIZ-11).

### 실행 결과

- **정상 결과**: 복호화 성공→연동 추적 키 추출→연동이력 1건 생성(복호화 후)→수신처 B 전달 성공→처리 상태 1건(is_success=true) 저장. PROC-202 로 200 반환 → SCR-006 "연동이 완료되었습니다."
- **실패 결과**: 복호화 실패(EX-SEC-006, 재입력)·발송처 데이터 오류(EX-SEC-007·EX-BIZ-008, 링크 오류)·전달 실패(EX-BIZ-004, 재시도 2회 후 실패→처리 상태 1건 is_success=false·연동이력 유지). 미승인·구성 외 주소는 내부 차단(감사).
- **후속 트리거**: PROC-403(연동이력 생성)·PROC-401(처리 상태 저장). 저장된 상태·이력은 PROC-301·302·303 소비, PROC-402 보관 대상.

### 의존 프로세스

- **호출 관계**: PROC-403(동기, 연동이력 생성 진입 — FN-016)·PROC-401(동기, 처리 상태 저장 — FN-009_saveStatus).
- **선행 관계**: PROC-202(승인 게이팅 완료·접근 컨텍스트 확보).
- **이벤트 관계**: 복호화 성공이 PROC-403 이력 생성을, 전달 결과 확정이 PROC-401 상태 저장을 트리거한다.

### 구현 가이드

- 복호화 함수(FN-020)의 입력은 encX·encY·생년월일뿐이며, 키 32B·IV 16B 정규화(`_` 우패딩·초과 절단)와 encY→encX→X 복호화 순서를 결정론적으로 구현한다(SEC-006-02/04, 라이브러리 강제 없음). 출력 X 는 수신처 전달 페이로드(FN-012)로만 사용하고 저장하지 않는다. 발송처키는 encY 로부터 생년월일로 일시 복원할 뿐 저장·검증하지 않는다(SEC-002-04).
- 복호화 성공 후 X 에서 연동 추적 키를 추출해 연동이력을 **전달에 앞서** 생성하고(BIZ-004-07), 전달 결과를 처리 상태 4항목에 반영한다(DATA-003). 연동이력 기록(PROC-403)과 처리 상태 저장(PROC-401)은 분리된 흐름으로 두되 연동 추적 키로 연결한다(DATA-005-08).
- 복호화 원문 X 는 요청 처리 컨텍스트 밖으로 넘기지 않고 전달 완료 즉시 참조를 해제한다 — 어떤 테이블·파일·로그에도 남기지 않는다(DATA-001-04·SEC-005-06). 전달 대상 주소는 구성의 수신처 B 주소로만 한정한다(BIZ-003-02). 외부 호출은 반드시 BE 를 경유하고 리다이렉트·URL 파라미터로 X 를 노출하지 않는다(SEC-007-01, HTTP 클라이언트 라이브러리 강제 없음).
- 타임아웃·재시도 정책(최대 2회)은 기본안이며 확정 시 BIZ-003 을 리비전한다. 전달 실패여도 복호화 성공 이후이므로 처리 상태 1건과 연동이력은 반드시 남긴다(EXC-BIZ-06·EXC-BIZ-11). 복호화 실패(EX-SEC-006)와 발송처 데이터 오류(EX-SEC-007·EX-BIZ-008)는 사용자 재시도 가능 여부가 달라 구분해 처리한다(EXC-BIZ-13).
