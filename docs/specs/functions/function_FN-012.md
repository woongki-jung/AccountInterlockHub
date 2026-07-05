# 서비스 B 전달 공통 기능 정의

## 개요

- **기능 목적**: 사용자 동의가 완료된 연동 요청을 관리자 구성의 서비스 B 전달 주소로 중개한다. 회원 키는 원본 무변형으로 전달 페이로드에만 실어 보내고 저장하지 않으며(값 신뢰성은 서비스 A 위임), 전달 실패 시 최대 2회 재시도 후 실패로 확정한다. 전달 결과(성공·실패)는 처리 상태 1건으로 저장(FN-009)된다. 외부 호출은 반드시 백엔드를 경유한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위(연동 실행) / [`../../prd/devspec/external-apis.md`](../../prd/devspec/external-apis.md) §2 접점 / 정책 BIZ-003·SEC-002·DATA-001.
- **담당자 확정 대기**: 재시도 최대 횟수(2회)는 기본안(EXC-BIZ-05).

---

## FN-012 서비스 B 전달

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 서비스 B 전달 |
| 분류 | EXT |
| 사용 서비스 | SVC-005 |
| 호출 PROC | PROC-203 |
| 연관 정책 | [BIZ-003](../policies/policy_BIZ.md#biz-003-서비스-b-전달-규칙상태-전이)(01·02·03·04), [SEC-002](../policies/policy_SEC.md#sec-002-회원-키-신뢰-위임)(01·02), [DATA-001-01](../policies/policy_DATA.md#data-001-회원-키-무저장개인정보-최소화) |
| 참조 데이터 | [MDL-204](../datas/model_user.md) 전달 페이로드, [ENT-001](../datas/data_ENT-001.md)·[ENT-003](../datas/data_ENT-003.md), [MDL-301](../datas/model_api.md) 처리 상태 |
| 관련 IA 항목 | USR-02 |

### 시그니처

```
function FN-012_deliverToServiceB (
  ctx: EntryContext,      // 진입 컨텍스트(configCode·memberKey·parameters, 메모리 경유)
  requestKey: string,     // 상태 저장 연결 키
  config: InterlockConfig,// MDL-101 (동의 완료 확인된 활성 구성)
  now: DateTime,
): ProcessStatus          // MDL-301 (전달 결과 반영 후 저장된 상태)
  throws DeliveryFailedError { code: EX-BIZ-004, http: 502 }
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | ctx | EntryContext | Y | 메모리 경유·무저장 | 회원 키·파라미터 원천 |
| 입력 | requestKey | string(UUID v4) | Y | - | 상태 연결 키 |
| 입력 | config | MDL-101 | Y | 활성·동의 완료 | 전달 대상·파라미터 정의 |
| 입력 | now | DateTime | Y | UTC | 처리 일시 |
| 출력 | ProcessStatus | MDL-301 | - | - | 전달 결과 상태(저장됨) |

### 처리 흐름 (의사코드)

```
1. 사전 조건 검증 — POL BIZ-003-01·BIZ-003-04 (validate)
   if (!ctx.consentConfirmed)                 // 미동의 전달 차단
        FN-013_writeAudit({ eventType:'DELIVERY_BLOCK', actorType:'SYSTEM',
                            target: requestKey, result:'BLOCKED' })
        → 내부 차단(EX 코드 없음)
   assert(stateTransition == '동의→전달')       // 역전이 금지(BIZ-003-04)

2. 전달 대상 결정 — POL BIZ-003-02 (validate)
   targetUrl = config.serviceBDeliveryUrl      // 구성 외 주소 금지
   method    = config.serviceBHttpMethod

3. 페이로드 구성 — POL SEC-002·DATA-001-01 (transform)
   payload = {                                  // MDL-204, 저장 안 함
       targetUrl, httpMethod: method,
       memberKey: ctx.memberKey,                // 원본 무변형(SEC-002-02), 메모리 전용
       parameters: mapParameters(ctx.parameters, config.parameters WHERE deliverToB=1)
   }

4. 전달·재시도 — POL BIZ-003-03 (transform, BR-202)
   attempt = 0; success = false
   while (attempt <= 2 AND !success)            // 최초 1 + 재시도 2회(기본안)
        resp = httpCall(payload, timeout)       // BE 경유 외부 호출
        if (resp.ok)   success = true
        else           attempt = attempt + 1
   isSuccess = success

5. 상태 저장 — DATA-003-02, PROC-401 (transform)
   status = FN-009_saveStatus({ requestKey, configId: config.id,
                                isSuccess, processedAt: now })   // 성공·실패 모두 1건

6. 결과 처리 — BIZ-003-03·OPS-002 (audit)
   if (!isSuccess)
        FN-013_writeAudit({ eventType:'DELIVERY_FAIL', actorType:'SERVICE',
                            target: requestKey, result:'FAIL' })
        → throw DeliveryFailedError (502, EX-BIZ-004)   // 상태는 저장됨(EXC-BIZ-06)
   return status
```

> 회원 키는 전달 페이로드로만 사용하고 저장·해석하지 않는다(SEC-002·DATA-001). 값 변형·정규화·복호화를 수행하지 않는다. 전송 계층 검증(형식·크기)은 FN-005 로 별개 수행한다(EXC-SEC-02).

### API 인터페이스

해당 없음 — 허브→서비스 B 아웃바운드 외부 연동으로, 서비스 A 대면 엔드포인트가 아니다. POST /api/consent/:requestKey(동의 제출, FN-008)의 동의 경로에서 내부 호출된다.

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 502 | EX-BIZ-004 | 서비스 B 오류·전달 실패(재시도 2회 후) | "연동 대상 처리에 실패했습니다." | 처리 상태 1건은 저장(EXC-BIZ-06) |
| (내부 차단) | - | 미동의 전달·구성 외 주소·역전이 | (사용자 미노출) | BIZ-003-01/02/04, 감사 로그 |
| 500 | EX-FN-999 | 페이로드 구성·저장 오류 | "잠시 후 다시 시도해주세요." | - |

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-009 | 상태 저장(단계 5) | 동기 | 저장 실패 시 EX-FN-999 |
| FN-013 | 차단·실패 감사(단계 1·6) | 동기 | 감사 실패는 전달 결정에 영향 없음 |

### 구현 가이드

- 회원 키는 요청 처리 컨텍스트 밖으로 넘기지 않고 저장 모델에서 원천 배제한다. 전달 대상 주소는 구성의 서비스 B 주소로만 한정하고 구성 외 주소 전달을 금지한다.
- 타임아웃·재시도 정책(최대 2회)은 기본안이며 확정 시 BIZ-003 을 리비전한다. 외부 호출은 반드시 백엔드를 경유하며(HTTP 클라이언트 라이브러리 강제 없음), 전달 실패여도 처리 상태 1건은 반드시 남긴다.
</content>
