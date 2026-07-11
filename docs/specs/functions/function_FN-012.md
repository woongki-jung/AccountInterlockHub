# 수신처 B 서버-서버 전달 공통 기능 정의

## 개요

- **기능 목적**: 복호화 성공한 연동 요청의 복호화 원문 X 를 접근 주소 구성의 수신처(B) 전달 주소로 **서버-서버 POST** 로 중개한다. X 는 원본 무변형으로 전달 페이로드에만 실어 보내고 저장·해석하지 않으며(값 신뢰성은 발송처 위임, SEC-002), 브라우저를 경유하지 않는다(SEC-007-01). 전달 실패 시 최대 2회 재시도 후 실패로 확정하고, 전달 결과(성공·실패)를 연동 추적 키 기준 처리 상태 1건으로 저장한다(FN-009). `#214` 로 입력이 회원 키 직수신에서 복호화 원문 X 로 바뀌었다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 4(연동 실행 — 수신처 전달) / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §2 접점(허브→수신처 B) / 정책 BIZ-003·SEC-007·SEC-002·DATA-001·DATA-003.
- **담당자 확정 대기**: 재시도 최대 횟수(2회)는 기본안(EXC-BIZ-05).

---

## FN-012 수신처 B 서버-서버 전달

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 수신처 B 서버-서버 전달 |
| 분류 | EXT |
| 사용 서비스 | SVC-005 |
| 호출 PROC | PROC-203 |
| 연관 정책 | [BIZ-003](../policies/policy_BIZ.md#biz-003-연동-실행--복호화수신처-전달상태-전이)(02·03·06·07), [SEC-007](../policies/policy_SEC-crypto.md#sec-007-복호화-원문-서버-서버-전달)(01), [SEC-002](../policies/policy_SEC.md#sec-002-발송처키전달-데이터-신뢰-위임)(03), [DATA-001-04](../policies/policy_DATA.md#data-001-무저장개인정보-최소화), [DATA-003](../policies/policy_DATA.md#data-003-처리상태-저장-최소항목) |
| 참조 데이터 | [MDL-204](../datas/model_user.md) 전달 페이로드(복호화 원문 X), [MDL-101](../datas/model_admin.md) 연동 구성, [MDL-301](../datas/model_api.md) 처리 상태, [ENT-001](../datas/data_ENT-001.md) |
| 관련 IA 항목 | USR-02 |

### 시그니처

```
function FN-012_deliverToServiceB (
  payloadX: object,       // 복호화 원문 X(FN-020 반환, 메모리 전용·무저장·무변형)
  trackingKey: string,    // X 에서 추출한 연동 추적 키(상태 저장 키, MDL-202)
  config: InterlockConfig,// MDL-101 (승인·복호화 완료된 활성 구성 — 수신처 B 주소·메서드)
  now: DateTime,
): ProcessStatus          // MDL-301 (전달 결과 반영 후 저장된 처리 상태)
  throws DeliveryFailedError { code: EX-BIZ-004, http: 502 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | payloadX | object | Y | 메모리 전용·무저장·무변형(SEC-002-03) | 복호화 원문 X(회원 키·추적 키 등) |
| 입력 | trackingKey | string | Y | NotBlank, MaxLength(255) | 처리 상태 연결 키(불투명) |
| 입력 | config | MDL-101 | Y | 활성·복호화 완료 | 전달 대상 주소·메서드 |
| 입력 | now | DateTime | Y | UTC | 처리 일시 |
| 출력 | ProcessStatus | MDL-301 | - | - | 전달 결과 상태(저장됨) |

### 처리 흐름 (의사코드)

```
   // 사전: 사용자 승인·복호화 성공(FN-020)은 PROC-203 이 본 FN 호출 전 완료. 연동이력 생성(FN-016)은 본 전달에 앞서 수행됨(BIZ-004-07)

1. 전달 사전 조건 검증 — POL BIZ-003-06 (validate)
   assert(복호화 성공·연동 추적 키 확보)          // 미승인·복호화 실패 상태 전달 차단
   assert(stateTransition == '복호화→전달')        // 역전이 금지(BIZ-003-07)
   if (!조건 충족)
        FN-013_writeAudit({ eventType:'DELIVERY_BLOCK', actorType:'SYSTEM',
                            target: FN-010_mask(trackingKey), result:'BLOCKED' })
        → 내부 차단(EX 코드 없음)

2. 전달 대상 결정 — POL BIZ-003-02 (validate)
   targetUrl = config.serviceBDeliveryUrl        // 구성 외 주소 금지(구성 바운드)
   method    = config.serviceBHttpMethod ?? 'POST'

3. 페이로드 구성 — POL SEC-002-03·SEC-007-01·DATA-001-04 (transform)
   payload = { targetUrl, httpMethod: method,
               payload: payloadX }                // MDL-204 — 복호화 원문 X 무변형, 저장 안 함
   // 회원 키·X 내용은 업무 유효성 판단 없이 원문 그대로 전달(SEC-002-03)

4. 서버-서버 전달·재시도 — POL BIZ-003-03·SEC-007-01 (transform, BR-202)
   attempt = 0; success = false
   while (attempt <= 2 AND !success)              // 최초 1 + 재시도 2회(기본안)
        resp = serverToServerCall(method, targetUrl, payloadX, timeout)  // BE 직접 호출, 브라우저 미경유
        if (resp.ok)   success = true
        else           attempt = attempt + 1
   isSuccess = success

5. 처리 상태 저장 — DATA-003-05, PROC-401 (transform)
   status = FN-009_saveStatus({ trackingKey, configId: config.id,
                                isSuccess, processedAt: now })   // 성공·실패 모두 1건(EXC-BIZ-06)

6. 원문 폐기·결과 처리 — DATA-001-04·BIZ-003-03·OPS-002 (mask·audit)
   release(payloadX)                              // 전달 완료 즉시 복호화 원문 참조 해제(무저장·미기록)
   if (!isSuccess)
        FN-013_writeAudit({ eventType:'DELIVERY_FAIL', actorType:'SERVICE',
                            target: FN-010_mask(trackingKey), result:'FAIL' })
        → throw DeliveryFailedError (502, EX-BIZ-004)   // 처리 상태는 저장됨(EXC-BIZ-06·EXC-BIZ-11 이력 유지)
   FN-013_writeAudit({ eventType:'DELIVERY_SUCCESS', actorType:'SERVICE',
                       target: FN-010_mask(trackingKey), result:'SUCCESS' })
   return status
```

> 복호화 원문 X 는 전달 페이로드로만 사용하고 저장·해석·변형하지 않는다(SEC-002-03·DATA-001-04). 전달은 허브 서버에서 수신처 B 로 **직접 서버-서버 POST** 로 호출하고, 리다이렉트·URL 파라미터로 X 를 노출하지 않는다(SEC-007-01). 사용자에게는 원문·회원 키·전달 상세를 뺀 완료 페이지만 반환한다(SEC-007-02, PROC-203). 전송 계층 검증(형식·크기)은 진입 시 FN-005 로 별개 수행한다(EXC-SEC-02).

### API 인터페이스

해당 없음 — 허브→수신처 B 아웃바운드 외부 연동으로, 서비스 대면 엔드포인트가 아니다. 연동 실행(PROC-203)의 복호화 성공 이후 단계에서 내부 호출된다. 완료 콜백(FN-018)은 수신처 B 가 X 에서 얻은 연동 추적 키 단독으로 회신하므로 별도 동봉 계약이 없다(구 configCode·requestKey 동봉 폐기, MDL-204).

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 502 | EX-BIZ-004 | 수신처 B 오류·전달 실패(재시도 2회 후) | "연동 대상 처리에 실패했습니다." | 처리 상태 1건은 저장(EXC-BIZ-06), 연동이력 유지(EXC-BIZ-11) |
| (내부 차단) | - | 미복호화 전달·구성 외 주소·역전이 | (사용자 미노출) | BIZ-003-06/02/07, 감사 로그 |
| 500 | EX-FN-999 | 페이로드 구성·저장 오류 | "잠시 후 다시 시도해주세요." | 원문 미기록 |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-009 | 상태 저장(단계 5) | 동기 | 저장 실패 시 EX-FN-999 |
| FN-010 | 감사 마스킹(단계 1·6) | 동기 | trackingKey 앞2·뒤2 마스킹 |
| FN-013 | 차단·실패·성공 감사(단계 1·6) | 동기 | 감사 실패는 전달 결정에 영향 없음 |

### 구현 가이드

- 복호화 원문 X 는 요청 처리 컨텍스트 밖으로 넘기지 않고 전달 완료 즉시 참조를 해제한다 — 어떤 테이블·파일·로그에도 남기지 않는다(DATA-001-04·SEC-005-06). 전달 대상 주소는 구성의 수신처 B 주소로만 한정하고 구성 외 주소 전달을 금지한다(BIZ-003-02).
- 타임아웃·재시도 정책(최대 2회)은 기본안이며 확정 시 BIZ-003 을 리비전한다. 외부 호출은 반드시 백엔드를 경유하며(서버-서버, HTTP 클라이언트 라이브러리 강제 없음), 전달 실패여도 복호화 성공 이후이므로 처리 상태 1건과 연동이력(FN-016)은 반드시 남긴다(EXC-BIZ-06·EXC-BIZ-11).
- 연동이력 생성(FN-016)은 본 전달에 앞서 수행되고(BIZ-004-07), 본 FN 은 전달 결과를 처리상태 4항목에 반영한다(DATA-003). 두 추적은 연동 추적 키로 연결하되 완료 콜백 수신은 연동이력만 갱신한다(BIZ-004-11).
