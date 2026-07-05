# 사용자 동의 처리 공통 기능 정의

## 개요

- **기능 목적**: 진입 컨텍스트의 연동 구성에 설정된 동의 항목만 노출하고, 사용자 동의/거부 결과를 구성 매칭 근거로 검증한다. 동의 시 연동 실행(FN-012 전달)으로 진행하고, 거부 시 전달 없이 처리 상태(성공 여부=실패·미전달)를 기록하며 200 정상 종료한다. 개인식별 동의 증빙 원장은 저장하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위(이용 동의 페이지) / 정책 BIZ-002.
- **담당자 확정 대기 (Q3)**: 동의 증빙 원장 미저장·결과만 반영은 기본안(BIZ-002-04·EXC-BIZ-04).

---

## FN-008 사용자 동의 처리

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 사용자 동의 처리 |
| 분류 | POL |
| 사용 서비스 | SVC-004 |
| 호출 PROC | PROC-201(화면 구성), PROC-202(동의/거부) |
| 연관 정책 | [BIZ-002](../policies/policy_BIZ.md#biz-002-사용자-동의-처리)(01·02·03·04) |
| 참조 데이터 | [ENT-002](../datas/data_ENT-002.md) 동의 항목, [MDL-203](../datas/model_user.md) 동의 결과, [MDL-301](../datas/model_api.md) 처리 상태 |
| 관련 IA 항목 | USR-01 |

### 시그니처

```
function FN-008_buildConsentView (
  requestKey: string,     // 발급된 요청 키값(진입 컨텍스트 조회 키)
): ConsentItem[]          // 구성 소속 동의 항목만(display_order 오름차순)
  throws InvalidKeyFormatError { code: EX-DATA-002, http: 400 }

function FN-008_processDecision (
  decision: ConsentResult,  // MDL-203 (requestKey·decision·configCode)
  now: DateTime,
): ProcessStatus          // MDL-301 (거부 시 즉시 저장 / 동의 시 전달 결과 반영)
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | requestKey | string(UUID v4) | Y | FN-007 검증 | 진입 컨텍스트 조회 키 |
| 입력 | decision | MDL-203 | Y | AGREE/REJECT | 동의/거부 결정 |
| 입력 | now | DateTime | Y | UTC | 처리 일시 |
| 출력 | ConsentItem[] | ENT-002 파생 | - | 구성 소속만 | 화면 노출 항목 |
| 출력 | ProcessStatus | MDL-301 | - | - | 처리 상태(거부/전달 결과) |

### 처리 흐름 (의사코드)

```
화면 구성 — buildConsentView, POL BIZ-002-01 (transform)
1. ctx = entryContextStore.get(requestKey)     // 진입 컨텍스트(FN-007)
   if (ctx is null)                              → throw InvalidKeyFormatError (400, EX-DATA-002)
2. config = SELECT id FROM TBL_INTERLOCK_CONFIG
            WHERE config_code = :ctx.configCode AND is_active = 1 AND deleted_at IS NULL;
3. items = SELECT item_label, item_description, is_required, display_order
           FROM TBL_INTERLOCK_CONSENT_ITEM
           WHERE config_id = :config.id ORDER BY display_order;   // 구성 외 노출 금지
4. return items

동의/거부 — processDecision, POL BIZ-002-02/03/04 (validate·transform)
1. ctx = entryContextStore.get(decision.requestKey)
   if (ctx is null OR ctx.configCode != decision.configCode)      // 구성 매칭 근거 검증
        → throw InvalidKeyFormatError (400, EX-DATA-002)
2. config = SELECT id FROM TBL_INTERLOCK_CONFIG
            WHERE config_code = :ctx.configCode AND is_active = 1 AND deleted_at IS NULL;
3. if (decision.decision == 'REJECT')            // BIZ-002-03
        status = FN-009_saveStatus({ requestKey: decision.requestKey,
                    configId: config.id, isSuccess: false, processedAt: now })  // 미전달
        entryContextStore.remove(decision.requestKey)   // 처리 완료 후 컨텍스트 폐기
        FN-013_writeAudit({ eventType:'CONSENT_REJECT', actorType:'SERVICE',
                            target: decision.requestKey, result:'INFO' })
        return status                             // 200 정상 종료(EXC-BIZ-03, 오류 아님)
4. else  // AGREE — BIZ-002-02
        ctx.consentConfirmed = true              // 동의 완료 표식(FN-012 사전 조건)
        status = FN-012_deliverToServiceB(ctx, decision.requestKey, config, now)  // 전달→상태 저장
        entryContextStore.remove(decision.requestKey)   // 처리 완료 후 컨텍스트 폐기
        return status
```

> 동의 증빙 원장은 저장하지 않는다(BIZ-002-04). 결과는 처리 상태(is_success)에만 반영된다. 동의 결과는 화면 값 단독 신뢰 없이 서버가 구성 매칭 근거(configCode)로 검증한다.

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | GET /api/consent/:requestKey (항목 조회) · POST /api/consent/:requestKey (동의/거부) |
| HTTP 메서드 | GET / POST |
| 인증 요구 | 요청 키값(진입 컨텍스트) — 입력 검증(FN-005) 선적용 |
| 요청 DTO | GET: requestKey / POST: MDL-203(동의 결과) |
| 응답 DTO (200) | GET: 동의 항목 배열 / POST: { success:true } (전달·상태 반영 결과) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-DATA-002 |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | EX-DATA-002 | 요청 키값 미존재·구성 매칭 불일치 | "요청이 올바르지 않습니다." | 진입 컨텍스트 만료·불일치 |
| 502 | EX-BIZ-004 | 동의 후 서비스 B 전달 실패(FN-012 전파) | "연동 대상 처리에 실패했습니다." | 상태 1건은 저장됨(EXC-BIZ-06) |
| 500 | EX-FN-999 | 조회·상태 처리 오류 | "잠시 후 다시 시도해주세요." | - |

- 사용자 거부는 EX 코드가 아니다 — 200 정상 종료 + 상태 1건(실패·미전달) 기록(EXC-DATA-03).

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-005 | 진입 검증 | 동기 | 형식·크기·주입 선검증 |
| FN-009 | 거부 시 상태 저장(단계 2) | 동기 | 저장 실패 시 EX-FN-999 |
| FN-012 | 동의 시 전달(단계 3) | 동기 | 전달 실패 시 EX-BIZ-004 전파(상태는 저장) |
| FN-013 | 거부·경고 감사 | 동기 | 감사 실패는 처리에 영향 없음 |

### 구현 가이드

- 동의 화면은 구성에 설정된 동의 항목만 노출한다(구성 외 노출 금지). 결과 검증은 서버가 진입 컨텍스트의 구성 매칭 근거로 수행한다.
- 거부는 오류가 아닌 200 정상 종료로 처리하고 상태 1건(실패·미전달)을 남긴다. 처리 완료 후 진입 컨텍스트(회원 키 포함)를 메모리에서 폐기한다(무저장).
</content>
