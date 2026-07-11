# 연동이력 생성 공통 기능 정의

## 개요

- **기능 목적**: 복호화 성공으로 연동 추적 키를 확보하면 수신처 전달에 앞서 연동이력(ENT-007) 1건을 생성한다. 연동 추적 키·연동 구성(접근 주소) 참조·연동 요청 일시를 기록하고 완료 콜백 수신 여부는 미수신(false)으로 초기화한다(항목 상한 5종, DATA-005-05). `#214` 로 생성 시점이 진입 시(구 SVC-004)에서 **복호화 성공 후(SVC-005)**로 이동했고, 저장 키가 구 요청 키값·지정 사용자 키값 원문에서 **연동 추적 키 단독**으로 전환됐다 — 회원 키·복호화 원문은 저장하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 8 "연동이력 저장: 연동 추적 키 기준으로 연동 요청~완료 콜백까지의 이력을 저장" / 정책 BIZ-004·DATA-005.
- **담당자 확정 대기 (EXC-DATA-09, `accountinterlockhub#33`)**: 연동이력 통계 목적 장기 보관 여부는 담당자 확정 대기다. 미확정까지 처리상태 준용 보관 fallback 을 적용한다.

---

## FN-016 연동이력 생성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 연동이력 생성 |
| 분류 | DAT |
| 사용 서비스 | SVC-005 |
| 호출 PROC | PROC-403(PROC-203 내부) |
| 연관 정책 | [BIZ-004](../policies/policy_BIZ.md#biz-004-연동이력-기록완료-판정)(07), [DATA-005](../policies/policy_DATA.md#data-005-연동이력-저장-최소항목)(05·06·07·08), [DATA-001-05](../policies/policy_DATA.md#data-001-무저장개인정보-최소화) |
| 참조 데이터 | [MDL-303](../datas/model_api.md) 연동이력, [MDL-202](../datas/model_user.md) 연동 추적 키, [MDL-101](../datas/model_admin.md) 연동 구성, [ENT-007](../datas/data_ENT-007.md)·[ENT-001](../datas/data_ENT-001.md) |
| 관련 IA 항목 | BAT-03, USR-02 |

### 시그니처

```
function FN-016_createInterlockHistory (
  trackingKey: string,       // 복호화된 X 에서 추출·검증된 연동 추적 키(FN-020, MDL-202)
  config: InterlockConfig,   // MDL-101 (활성 구성 — 접근 주소 참조)
  now: DateTime,             // 연동 요청 일시(복호화 성공 시각)
): InterlockHistory          // MDL-303 (생성 이력)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | trackingKey | string | Y | NotBlank, MaxLength(255) | 연동 추적 키(불투명 원문, 완결성은 FN-020 검증 완료) |
| 입력 | config | MDL-101 | Y | 활성·복호화 완료 구성 | 접근 주소 구성 참조(config.id) |
| 입력 | now | DateTime | Y | UTC | requested_at |
| 출력 | InterlockHistory | MDL-303 | - | 5항목 상한 | 생성 이력(내부 surrogate id 미노출) |

### 처리 흐름 (의사코드)

```
   // 사전: 복호화 성공·연동 추적 키 완결성 검증(비공백)은 FN-020 이 완료(누락·공백 시 EX-BIZ-008 로 이미 거부). 본 FN 은 지정된 추적 키로 이력을 생성

1. 이력 레코드 구성 — POL DATA-005-05/06/07 (transform)
   history = {
       trackingKey,                    // 불투명 원문 무변형(해석·해시·암복호화 금지, DATA-005-07)
       configId:  config.id,           // 연동 구성(접근 주소) 참조
       requestedAt: now,               // 연동 요청 일시(복호화 성공 시각·스코프 최신 건 선정 기준)
       callbackReceived: false,        // 생성 시점 = 완료 콜백 미수신
       callbackReceivedAt: null
   }
   // 5항목 상한(DATA-005-05) — 회원 키·복호화 원문(X 내용)·개인식별 컬럼 없음(DATA-005-06)

2. 영속화 — DATA-005-05/08, PROC-403 (transform)
   INSERT INTO TBL_INTERLOCK_HISTORY
       (id, tracking_key, config_id, requested_at, callback_received, callback_received_at, created_at)
   VALUES (gen_random_uuid(), :trackingKey, :configId, :now, false, null, now());
   // surrogate uuid PK(id) — tracking_key 는 비유니크 조회 인덱스(IX_HISTORY_TRACKING). 연동 요청 1건당 1건(DATA-005-08). 수신 정합 CHECK 는 ENT-007

3. 감사 — POL OPS-002·SEC-005-04 (audit)
   FN-013_writeAudit({ eventType:'HISTORY_CREATE', actorType:'SYSTEM',
                       target: FN-010_mask(trackingKey), result:'SUCCESS' })   // 추적 키 앞2·뒤2 마스킹

4. 반환
   return history   // 호출 PROC-203 은 수신처 전달(FN-012)로 계속 — 이력은 전달에 앞서 생성됨(BIZ-004-07)
```

> 연동이력은 연동 추적 키·구성 참조·타임스탬프만 두고 회원 키·복호화 원문(전달 데이터 X 내용)을 저장하지 않는다(DATA-005-06, 무저장 경계 유지). 추적 키는 X 에서 추출한 불투명 문자열 원문 그대로 저장한다(DATA-005-07). 이력 생성은 처리상태 저장(PROC-401)과 분리된 저장 흐름(PROC-403)으로 수행하고 두 추적은 연동 추적 키로 연결한다(DATA-005-08). 처리상태는 본 FN 에서 생성·변경하지 않는다.

### API 인터페이스

해당 없음 — 연동 실행(PROC-203)의 복호화 성공 이후 단계에서 내부 호출(PROC-403)하는 이력 생성 단위 로직이다(독립 엔드포인트 없음). 진입 계약·응답은 SVC-005 가 담당한다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 500 | EX-FN-999 | INSERT·조회 오류 | "잠시 후 다시 시도해주세요." | 추적 키 재사용 시 surrogate PK 로 다건 공존 허용(EXC-BIZ-12) |

> `#214` 로 지정 파라미터 값 누락 거부(구 EX-BIZ-007)·미지정 구성 null 분기는 폐기됐다 — 연동 추적 키 완결성(누락·공백)은 복호화 단계(FN-020, EX-BIZ-008)에서 이미 검증되므로 본 FN 은 검증 예외를 두지 않는다(정상 경로는 항상 유효 추적 키로 진입).

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-010 | 감사 마스킹(단계 3) | 동기 | 추적 키 앞2·뒤2 마스킹 |
| FN-013 | 생성 감사(단계 3) | 동기 | 감사 실패는 이력 생성 결과에 영향 없음 |

### 구현 가이드

- 연동 추적 키는 복호화된 X 의 지정 필드에서 원문 그대로 추출(FN-020)한 값을 무변형 저장한다(해석·정규화·해시·암복호화 금지 — DATA-005-07·SEC-002). 값의 의미적 신뢰성은 발송처 책임이다.
- 이력 생성은 처리상태 저장(PROC-401)과 분리된 저장 흐름(PROC-403)으로 수행하고, 두 추적의 연결은 연동 추적 키 공유로만 둔다(DATA-005-08). 처리상태는 본 FN 에서 생성·변경하지 않으며, 완료 콜백 수신은 별도(FN-018)로 연동이력만 갱신한다(BIZ-004-11).
- 연동 추적 키는 발송처 구성 값이라 유니크를 강제할 수 없어 내부 surrogate uuid `id` 를 PK 로 두고 tracking_key 를 비유니크 조회 인덱스로 둔다 — 재사용 시 완료 판정·콜백 특정은 연동 요청 일시 최신 1건 규칙(EXC-BIZ-12)으로 단일화한다(FN-019). 전달 실패(EX-BIZ-004) 건의 이력도 삭제하지 않고 완료 콜백 미수신 상태로 남겨 보관 배치가 정리한다(EXC-BIZ-11). user_key·수신 정합 CHECK 등 스키마 상세는 [ENT-007](../datas/data_ENT-007.md) 이 확정한다.
