# 연동이력 생성 공통 기능 정의

## 개요

- **기능 목적**: 사용자 키값 파라미터가 지정된 구성의 연동 요청 진입 시 연동이력(ENT-007) 1건을 생성한다. 진입 전달 파라미터에서 지정 파라미터의 값을 원문 그대로 추출해 지정 사용자 키값으로 기록하고, 연동 구성 참조·요청 키값·연동 요청 일시를 함께 저장한다(항목 상한 6종). 지정 파라미터의 값이 누락·공백이면 진입을 거부하고, 미지정 구성은 이력을 기록하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 7 "연동이력 저장: 지정된 사용자 키값 파라미터 값을 기준으로 연동 요청~완료 콜백까지의 이력을 저장" / 정책 BIZ-004·DATA-005. 2026-07-06 요구 추가(`accountinterlockhub#33`).
- **담당자 확정 대기 (Q5)**: 지정 파라미터 값 누락 시 진입 거부(400 EX-BIZ-007)·지정 사용자 키값 원문 저장(DATA-005-03)은 확정 기본안(EXC-DATA-09).

---

## FN-016 연동이력 생성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 연동이력 생성 |
| 분류 | DAT |
| 사용 서비스 | SVC-004 |
| 호출 PROC | PROC-201(예약 — 내부 PROC-403) |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(01·02·05), [DATA-005](../policies/policy_DATA.md#data-005-연동이력-저장-최소항목)(01·02·03·04), [DATA-001-01](../policies/policy_DATA.md#data-001-회원-키-무저장개인정보-최소화)(EXC-DATA-07) |
| 참조 데이터 | [MDL-303](../datas/model_api.md) 연동이력, [MDL-201](../datas/model_user.md) 진입 요청(값 출처), [MDL-101](../datas/model_admin.md) 연동 구성, [ENT-007](../datas/data_ENT-007.md)·[ENT-001](../datas/data_ENT-001.md)·[ENT-003](../datas/data_ENT-003.md) |
| 관련 IA 항목 | BAT-03, USR-01 |

### 시그니처

```
function FN-016_createInterlockHistory (
  config: InterlockConfig,   // MDL-101 (활성 구성 — userKeyParamId·중첩 Parameter 포함)
  ctx: EntryContext,         // 진입 컨텍스트(configCode·parameters — 메모리 경유, 무저장)
  requestKey: string,        // 진입 시 발급된 요청 키값(UUID v4, FN-007)
  now: DateTime,             // 연동 요청 일시(진입 처리 시각)
): InterlockHistory | null   // MDL-303 (생성 이력) | null(미지정 구성 — 미기록)
  throws MissingUserKeyValueError { code: EX-BIZ-007, http: 400 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | config | MDL-101 | Y | 활성·동의 화면 진입 구성 | userKeyParamId(지정 참조)·parameters 정의 포함 |
| 입력 | ctx | EntryContext | Y | 메모리 경유·무저장 | 지정 파라미터 값의 원천(parameters) |
| 입력 | requestKey | string(UUID v4) | Y | 처리상태 연결 키(DATA-005-04) | 이력 PK |
| 입력 | now | DateTime | Y | UTC | requested_at |
| 출력 | InterlockHistory | MDL-303 | - | 지정 구성만 생성 | 미지정 구성은 null 반환 |

### 처리 흐름 (의사코드)

```
1. 지정 여부 확인 — POL BIZ-004-05·BIZ-001-07 (validate)
   if (config.userKeyParamId is null)         → return null   // 미지정 구성: 이력 미기록(대상 밖)

2. 지정 파라미터 값 추출·완결성 검증 — POL BIZ-004-02 (validate)
   designatedParam = config.parameters.find(p => p.id == config.userKeyParamId)   // isUserKey=true 파라미터(구성당 최대 1개)
   userKey = ctx.parameters[designatedParam.name]
   if (userKey is null OR blank(userKey))
        → throw MissingUserKeyValueError (400, EX-BIZ-007)     // 진입 거부 — 근거 데이터 완결성 보장

3. 이력 레코드 구성 — POL DATA-005-01/02/03 (transform)
   history = {
       requestKey,                     // 요청 키값 참조(DATA-005-04)
       configId:  config.id,           // 연동 구성 참조
       userKey,                        // 지정 사용자 키값 — 원문 무변형(해석·해시·암복호화 금지, DATA-005-03)
       requestedAt: now,               // 연동 요청 일시
       callbackReceived: false,        // 진입 시점 = 완료 콜백 미수신
       callbackReceivedAt: null
   }
   // 6항목 상한 — 지정 사용자 키값 외 전달 파라미터 원문·개인식별 컬럼 없음(DATA-005-02)

4. 영속화 — DATA-005-04, PROC-403 (transform)
   INSERT INTO TBL_INTERLOCK_HISTORY
       (request_key, config_id, user_key, requested_at, callback_received, callback_received_at, created_at)
   VALUES (:requestKey, :configId, :userKey, :now, false, null, now());
   // PK(request_key) 로 연동 요청 1건당 최대 1건 보장(DATA-005-04). CHECK(length(user_key)>0)·수신 정합 CHECK 는 ENT-007

5. 감사 — POL OPS-002·SEC-005 (audit)
   FN-013_writeAudit({ eventType:'HISTORY_CREATE', actorType:'SYSTEM',
                       target: requestKey, result:'SUCCESS',
                       detail: 'userKey=' + FN-010_mask(userKey) })   // 원문 미기록(SEC-005-01)

6. 반환
   return history   // 호출 PROC-201 은 진입 처리를 계속(요청 키값 응답 반환)
```

> 회원 키(=지정 사용자 키값)를 저장하는 유일 예외 저장소가 연동이력이다(DATA-001-01·EXC-DATA-07). 지정 파라미터 값의 크기·형식·주입 방어(전송 안전성)는 진입 검증(FN-005 SEC-004)이 선행하며 본 FN 은 완결성(존재·비공백)만 추가 검증한다(EXC-SEC-02). 미지정 구성(step 1 null 반환)은 정상 진입하되 완료 확인(API-02)·완료 콜백(API-03) 대상이 아니다(BIZ-004-05).

### API 인터페이스

해당 없음 — 서비스 A 진입(GET /interlock/entry) 처리 중 PROC-201 이 내부 호출하는 이력 생성 단위 로직이다(독립 엔드포인트 없음). 진입 계약·응답은 SVC-004/MDL-202 가 담당한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | EX-BIZ-007 | 지정 구성의 진입에서 지정 파라미터 값 누락·공백 | "연동에 필요한 값이 누락되었습니다." | BIZ-004-02, 진입 거부(이력 미생성) |
| 500 | EX-FN-999 | INSERT·조회 오류 | "잠시 후 다시 시도해주세요." | PK 충돌(중복 진입)은 감사 후 재발급 여부 build 확정 |

> 미지정 구성은 예외가 아니라 null 반환(정상 진입, 이력 미기록)이다 — EX 코드를 두지 않는다.

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-005 | 진입 전(호출 PROC) | 동기 | 전송 안전성 선검증(형식·크기·주입) |
| FN-010 | 감사 마스킹(단계 5) | 동기 | userKey 원문 배제 |
| FN-013 | 생성 감사(단계 5) | 동기 | 감사 실패는 이력 생성 결과에 영향 없음 |

### 구현 가이드

- 지정 사용자 키값은 지정 파라미터의 값을 원문 그대로 추출해 저장한다(해석·정규화·해시·암복호화 금지 — DATA-005-03·SEC-002). 값의 의미적 신뢰성은 서비스 A 책임이다.
- 이력 생성은 처리상태 저장(PROC-401)과 분리된 저장 흐름(PROC-403)으로 수행하고, 두 추적의 연결은 요청 키값 참조로만 둔다(DATA-005-04·BIZ-004-06). 처리상태는 본 FN 에서 생성·변경하지 않는다.
- 지정 파라미터 값 완결성 검증(EX-BIZ-007)은 진입 처리 중 이력 생성 직전에 수행되며, 진입 시점에는 요청 키값·처리상태가 아직 영속화되지 않아 throw 시 진입이 부작용 없이 거부된다(PROC-201 예외 표에 등재).
- user_key 길이 상한(512)·수신 정합 CHECK 등 스키마 상세는 [ENT-007](../datas/data_ENT-007.md) 이 확정한다.
