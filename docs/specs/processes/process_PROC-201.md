# 이용 동의 진입·표시 기능 정의

## 개요

- **정의 대상**: 서비스 A 진입 시 허브가 불투명 요청 키값(UUID v4)을 발급하고, 회원 키·파라미터를 비영속 메모리(진입 컨텍스트)에만 연결한 뒤 요청 키값을 서비스 A 에 반환하며, 사용자 동의 화면에 해당 구성의 동의 항목만 표시하는 프로세스. **사용자 키값 파라미터가 지정된 구성이면 진입 처리 중 내부 연동이력 기록 프로세스(PROC-403)를 통해 연동이력(ENT-007) 1건을 생성**(FN-016)하며, 미지정 구성은 이력을 생성하지 않는다. 이 시점에도 처리 상태(ENT-004)는 저장하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "사용자 — 이용 동의 페이지: 구성된 동의 항목 노출" · §수행 범위 7 "연동이력 저장: 지정된 사용자 키값 파라미터 값을 기준으로 연동 요청~완료 콜백까지의 이력을 저장" · §데이터 원칙(무저장·요청 키값). 연동이력 기록 개시는 2026-07-06 요구 추가(`accountinterlockhub#33`).

---

## PROC-201 이용 동의 진입·표시

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 이용 동의 진입·표시(요청 키값 발급·연동이력 기록 개시) |
| 분류 | RR |
| 그룹 | 사용자 연동 |
| 트리거 유형 | 외부 콜백(서비스 A 진입) + 화면 이벤트(SCR-005 mount) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | USR-01, BAT-03 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-004 | 진입·요청 키값 발급·동의 화면 구성·연동이력 기록 개시 |
| 정책(policy) | OPS-001·SEC-004·DATA-002·DATA-001·BIZ-002·BIZ-004(01·02·05)·DATA-005 | 요청 제한·입력 검증·불투명 키·무저장·동의 항목 노출·연동이력 생성·값 완결성·항목 상한 |
| 공통 기능(FN) | FN-014(요청 제한)·FN-005(입력 검증)·FN-007(키 발급)·FN-016(연동이력 생성)·FN-008(동의 화면 구성)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-201(진입 요청)·MDL-202(요청 키값)·MDL-303(연동이력) | 인바운드·응답·이력 모델 |
| DB 엔터티(ENT) | ENT-001(활성 구성·user_key_param_id·전달 파라미터 조회)·ENT-002(동의 항목)·ENT-007(연동이력 생성). ENT-004 미저장 | 조회 대상·이력 INSERT(회원 키는 지정 사용자 키값에 한해 이력에만 저장, EXC-DATA-07) |
| 화면(SCR) | SCR-005 | 이용 동의 화면 |

### 진입점 및 진입 조건

- **진입점**: `GET /interlock/entry`(서비스 A 진입 — 요청 키값 발급) · `GET /api/consent/:requestKey`(SCR-005 mount — 동의 항목 조회).
- **진입 조건**: Public(서비스 A 진입 흐름). 관리자 인증 경로와 분리. 진입 컨텍스트(요청 키값) 유효.
- **사전 검증**: 요청 제한(FN-014 분당 60회, 출발지 IP 기준), 본문/파라미터 크기·형식·주입(FN-005), 유효 활성 구성 참조. **지정 구성**은 지정 파라미터 값 존재·비공백 검증(FN-016, 누락 시 400 EX-BIZ-007, BIZ-004-02).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | entry | MDL-201 | Y | configCode·memberKey(무저장)·parameters |
| 입력 | requestKey | string(UUID v4) | N | 동의 항목 조회 시(발급된 키) |
| 출력 | requestKey | MDL-202 | - | 진입 응답으로 서비스 A 반환 |
| 출력 | history | MDL-303 \| null | - | 지정 구성의 연동이력 1건(진입 시 생성) / 미지정 구성 null(미기록, 내부 산출) |
| 출력 | consentItems | ConsentItem[] | - | 구성 소속 동의 항목(label·description·termsContent·required·order, display_order 오름차순) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(발급·조회·이력 생성만).
- **데이터 조회 대상**: ENT-001(활성 구성, config_code·is_active=true·deleted_at IS NULL — **user_key_param_id 및 전달 파라미터 정의(ENT-003) 포함**), ENT-002(동의 항목, config_id).
- **데이터 변경 대상(CRUD)**: **ENT-007 INSERT 1건**(지정 구성의 연동이력 생성, 내부 PROC-403 → FN-016). 미지정 구성은 미기록. 처리 상태(ENT-004)는 무저장(PROC-202/203/401 단계로 지연). 진입 컨텍스트(회원 키·파라미터)는 비영속 메모리(entryContextStore) put — 지정 사용자 키값 원문은 연동이력에만 영속(EXC-DATA-07).

### 실행 제약사항

- **트랜잭션 경계**: 진입 응답(요청 키값 발급)은 조회·메모리 저장으로 DB 영속화 없음. **지정 구성의 연동이력 생성은 단건 INSERT 트랜잭션**(내부 PROC-403 → FN-016, PK(request_key) 유니크로 1건 보장). 동의 항목 조회(B1b)는 SELECT 만.
- **동시성 제어**: 요청 키값은 UUID v4 로 충돌 무시 수준. 진입 컨텍스트는 요청 키값 단위 격리, TTL 만료(build 확정). 연동이력은 요청 키값 PK 로 연동 요청 1건당 최대 1건(DATA-005-04).
- **성능 요구**: 요청 제한 분당 60회 초과 시 429(FN-014, EXC-OPS-01 기본안). 진입점 미들웨어 카운터.
- **보안 요구**: 회원 키 무저장(메모리 경유만, DATA-001-01), 로그 노출 시 마스킹(FN-010), 요청 키값은 역추적 불가(회원 키와 무관, DATA-002-02).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 동의 화면 mount → 항목 조회   (SCR-005)
  진입 트리거: SCR-005 페이지 mount (/consent/:requestKey)
    ※ 서비스 A `/interlock/entry` 진입은 서버-대-서버/브라우저 리다이렉트로 요청 키값을
       발급받아 본 화면으로 유입된다(FE 폼 없음).
  사용 상태/폼: requestKey = route.param('requestKey'), consentQuery(캐시 키 ["consent",requestKey])
  호출 수단: query → GET /api/consent/:requestKey
  진행 중 UI: Initial/Loading — 카드 Skeleton

F2. 항목 응답 → 렌더
  onSuccess(res→{ data: ConsentItem[] }):
    Checkbox 목록 렌더(각 항목 label·description·required 표시, order 정렬)
    항목별: if (item.termsContent 존재) → 라벨 우측에 [상세] 버튼 렌더(BIZ-002-05)
    동의 버튼 활성 조건 계산: requiredItems.every(checked)
  onDetailClick(item):     // 클라이언트 전용, 서버 호출 없음
    약관 상세 Modal 열기(제목=item.label, 본문=item.termsContent, [동의]/[닫기])
    [동의] → checked[item.order]=true; 모달 닫기; 동의 버튼 활성 재계산   // EXC-BIZ-08
    [닫기] → 모달 닫기(체크 불변)
  onError(err):
    if (err.code=='EX-DATA-002') → Banner "요청이 올바르지 않습니다."(만료·불일치)
    else if (err.code=='EX-OPS-001') → Banner "잠시 후 다시 시도해주세요."
    else → Banner(error)
  정책 적용 지점: 구성 소속 항목만 노출(BIZ-002-01), 회원 키·요청 키값 화면 미표시(DATA-001)
```

#### BE 측 처리 (의사코드)

```
B1a. 진입·요청 키값 발급·연동이력 기록 개시   (GET /interlock/entry, 서비스 A)
  인증: Public. 요청 제한 FN-014_checkRateLimit(sourceIp, 'entry', now, 60)
        초과 → 429 EX-OPS-001
  입력 검증: FN-005_validateInput(MDL-201{configCode,memberKey,parameters}, schema, rawSize)
        크기>1MB → 413 EX-SEC-005 / 위반 → 400 EX-SEC-004
  활성 구성 참조 확인(지정 여부·파라미터 정의 로드):
    config = SELECT id, user_key_param_id FROM TBL_INTERLOCK_CONFIG
             WHERE config_code = :configCode AND is_active = true AND deleted_at IS NULL;   -- UQ_CONFIG_CODE
    if (config is null) → 400 EX-SEC-004 (유효하지 않은 구성 참조)
    config.parameters = SELECT id, param_name, source_key_a FROM TBL_INTERLOCK_PARAMETER
                        WHERE config_id = :config.id;   -- ENT-003, FN-016 의 지정 파라미터(user_key_param_id 매칭) 해석용
  요청 키값 발급 — FN-007_issueRequestKey(entry):
    requestKey = uuidV4()                     // DATA-002-02 역추적 불가
    entryContextStore.put(requestKey, { configCode, memberKey, parameters }, ttl)  // 비영속·무저장

  연동이력 기록 개시 — 내부 PROC-403 생성 진입: FN-016_createInterlockHistory(config, ctx, requestKey, now)  (BIZ-004-01/02/05, BR-203)
    ctx = entryContextStore.get(requestKey)   // 방금 저장한 진입 컨텍스트(configCode·parameters)
    history = FN-016(config, ctx, requestKey, now)
    // FN-016 내부(재서술 없이 위임):
    //   if (config.userKeyParamId is null) → return null          // 미지정 구성: 미기록(BR-203, 정상 진입)
    //   designatedParam = config.parameters.find(p => p.id == config.userKeyParamId)   // user_key_param_id 매칭(구성당 최대 1개)
    //   userKey = ctx.parameters[designatedParam.name]
    //   if (userKey null OR blank) → throw MissingUserKeyValueError(400, EX-BIZ-007)   // 진입 거부(이력 미생성, 부작용 없음)
    //   INSERT INTO TBL_INTERLOCK_HISTORY (request_key, config_id, user_key, requested_at,
    //           callback_received, callback_received_at, created_at)
    //     VALUES (:requestKey, :config.id, :userKey, :now, false, null, now());        // 단건 트랜잭션·PK 1건(DATA-005-04)
    //   FN-013_writeAudit(HISTORY_CREATE, SUCCESS, userKey 마스킹)                       // 원문 미기록(SEC-005-01)
    // EX-BIZ-007 throw 시: 진입 컨텍스트 폐기, 요청 키값 미반환(진입 거부)

  응답: FN-015_ok({ requestKey })             // 진입 응답으로 서비스 A 반환(DATA-002-03) — 이력 생성/미기록과 무관하게 발급 키 반환

B1b. 동의 화면 데이터 구성   (GET /api/consent/:requestKey, SCR-005)
  인증: 요청 키값(진입 컨텍스트). 입력 검증 FN-005
  FN-008_buildConsentView(requestKey):
    ctx = entryContextStore.get(requestKey)
    if (ctx is null) → 400 EX-DATA-002 (만료·미존재)
    config = SELECT id FROM TBL_INTERLOCK_CONFIG
             WHERE config_code = :ctx.configCode AND is_active = true AND deleted_at IS NULL;
    items = SELECT item_label, item_description, terms_content, is_required, display_order
            FROM TBL_INTERLOCK_CONSENT_ITEM
            WHERE config_id = :config.id ORDER BY display_order;   -- IX_CONSENT_CONFIG, 구성 외 노출 금지, 약관 컨텐츠 포함
  응답: FN-015_ok(items)   -- ConsentItem[] = {label, description?, termsContent?, required, order}
  정책 적용 지점: OPS-001(요청 제한), DATA-002(키 발급), DATA-001(무저장), BIZ-002-01(구성 소속 항목), BIZ-002-05(약관 컨텐츠 포함)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 요청→도메인 | BE 컨트롤러 | MDL-201(서비스 A) | EntryRequest | FN-005 검증, 활성 구성 참조·파라미터 정의 로드(저장 아님) |
| 도메인→메모리 | BE(컨텍스트) | EntryRequest | entryContext | 요청 키값 키로 비영속 저장(memberKey 무저장) |
| 도메인→ENT(이력) | BE(FN-016, 내부 PROC-403) | 지정 파라미터 값·구성·요청 키값 | MDL-303 → ENT-007 행(INSERT) | 지정 구성만, 지정 값 원문 추출(무변형, DATA-005-03), 6항목 상한. 미지정=미기록 |
| 도메인→응답 | BE 컨트롤러 | 발급 키·동의 항목 | MDL-202 / ConsentItem[] | UUID 반환·display_order 정렬 |
| 응답→FE | FE 어댑터 | 동의 항목 DTO | Checkbox 모델 | 라벨·필수 표식 매핑, 약관 컨텐츠 있으면 [상세]→약관 모달 바인딩 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 진입 요청 제한·검증 | (서비스 A 진입) | FN-014 + FN-005 + 활성 구성·파라미터 정의 로드 | 검증된 진입 |
| 2 | BE | 요청 키값 발급 | 검증된 진입 | FN-007 UUID 발급·컨텍스트 메모리 저장 | requestKey |
| 3 | BE | 연동이력 기록 개시 | requestKey·config·ctx | 내부 PROC-403(FN-016): 지정 구성 INSERT 1건 / 미지정 미기록 / 값 누락 400 EX-BIZ-007(BR-203) | 이력/null |
| 4 | BE | 진입 응답 | requestKey | 서비스 A 로 requestKey 반환 | (서비스 A 리다이렉트) |
| 5 | FE | 동의 화면 mount | requestKey(경로) | GET /api/consent/:requestKey | 조회 요청 |
| 6 | BE | 동의 항목 구성 | 조회 요청 | FN-008 컨텍스트·구성 소속 항목 조회 | ConsentItem[] |
| 7 | FE | 항목 렌더 | ConsentItem[] | Checkbox 렌더·동의 버튼 조건 계산·약관 있으면 [상세]→약관 모달 | (UI 갱신) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-203 | 구성의 사용자 키값 파라미터 지정 / 미지정 | 지정=지정 값 검증·연동이력 1건 생성(FN-016), 미지정=이력 미기록(정상 진입) | 이력 기록 / 미기록(완료 확인·완료 콜백 대상 밖) |
| EX-OPS-001 | 진입 분당 60회 초과 | 요청 거부, 감사 | 429 잠시 후 다시 시도해주세요. |
| EX-SEC-004 | 파라미터 형식 위반·유효하지 않은 구성 참조 | 진입 거부 | 400 요청이 올바르지 않습니다. |
| EX-SEC-005 | 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-BIZ-007 | 지정 구성 진입의 지정 파라미터 값 누락·공백 | 진입 거부(이력 미생성·컨텍스트 폐기, 부작용 없음) | 400 연동에 필요한 값이 누락되었습니다. |
| EX-DATA-002 | 요청 키값 미존재·컨텍스트 만료 | 조회 거부 | 400 요청이 올바르지 않습니다. |
| EX-FN-999 | UUID 생성·컨텍스트 저장·이력 INSERT 오류 | 오류 응답, 감사 | 500 잠시 후 다시 시도해주세요. |

> 처리 상태(ENT-004) 저장은 본 PROC 에서 발생하지 않는다 — 동의/거부(PROC-202) 및 전달(PROC-203) 이후 PROC-401 이 저장한다. **연동이력(ENT-007)**은 본 PROC 진입 시점에 지정 구성에 한해 생성되며(내부 PROC-403), 두 추적은 요청 키값 참조로만 연결된다(DATA-005-04·BIZ-004-06). EX-BIZ-007 은 지정 구성의 값 완결성 위반 시에만 발생하고, 미지정 구성(BR-203)은 예외 없이 정상 진입한다.

### 실행 결과

- **정상 결과**: 요청 키값 발급(서비스 A 반환), 진입 컨텍스트 메모리 저장, **지정 구성의 연동이력 1건 INSERT(내부 PROC-403 → FN-016) / 미지정 구성 미기록**, 동의 항목 목록 응답. 처리 상태(ENT-004) 영속화 없음.
- **실패 결과**: EX-OPS-001·EX-SEC-004/005·EX-BIZ-007(지정 값 누락)·EX-DATA-002 엔벨로프. EX-BIZ-007·컨텍스트 미저장 시 재진입 필요.
- **후속 트리거**: 진입 처리 중 내부 PROC-403(연동이력 생성) 호출(동기). 이후 사용자 동의/거부 제출 → PROC-202.

### 의존 프로세스

- **호출 관계**: PROC-403(동기, 생성 진입 — 지정 구성의 연동이력 생성, FN-016). 그 외 FN 단위 로직만 호출.
- **선행 관계**: PROC-101(활성 연동 구성 존재·사용자 키값 파라미터 지정 여부 결정).
- **이벤트 관계**: 요청 키값 발급 결과가 PROC-202(동의/거부)의 진입 컨텍스트가 된다. 생성된 연동이력은 PROC-303(완료 콜백)·PROC-302(완료 확인)의 대상·판정 근거가 된다.

### 구현 가이드

- 요청 키값은 표준 UUID v4 로 발급하고 예측 가능한 시퀀스·타임스탬프 노출식 식별자를 쓰지 않는다. 진입 컨텍스트(회원 키 포함)는 비영속 메모리에만 두고 DB 영속화를 금지한다.
- 동의 화면은 해당 구성에 설정된 동의 항목만 노출한다(구성 외 노출 금지). 진입 컨텍스트 저장 수단(단일 인메모리/공유 캐시)·TTL 은 build 확정한다.
- 동의 항목 조회 응답에 약관 컨텐츠(terms_content)를 포함한다. [상세] 버튼·약관 모달 표시와 모달 [동의]/[닫기] 처리는 클라이언트(SCR-005)에서 수행하며 서버 호출을 추가하지 않는다(BIZ-002-05·EXC-BIZ-08). 약관 컨텐츠가 없는 항목은 [상세] 버튼을 렌더하지 않는다.
- 회원 키는 로그·응답에 원문 노출하지 않고 마스킹한다(FN-010). 요청 제한은 사용자 진입은 출발지 IP 기준으로 카운트한다.
- 연동이력 생성은 처리상태 저장(PROC-401)과 분리된 저장 흐름(내부 PROC-403 → FN-016)으로 수행하고, 두 추적의 연결은 요청 키값 참조로만 둔다(DATA-005-04). 지정 구성의 지정 파라미터 값은 완결성(존재·비공백)을 검증해 원문 그대로 이력에 저장하며(무변형, DATA-005-03), 값 누락은 진입을 부작용 없이 거부한다(400 EX-BIZ-007). 미지정 구성은 이력을 생성하지 않고 정상 진입한다(BR-203). 활성 구성 조회 시 지정 파라미터 해석에 필요한 전달 파라미터 정의(ENT-003)를 함께 로드한다.
