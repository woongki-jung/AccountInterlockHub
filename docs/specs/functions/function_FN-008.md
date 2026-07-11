# 사용자 동의 처리 공통 기능 정의

## 개요

- **기능 목적**: 진입한 접근 주소 구성에 설정된 동의 항목만 노출하고(구성 외 노출 금지), 사용자 동의/거부 결과를 구성 매칭 근거로 재검증한다. 필수 연동 동의를 모두 체크한 승인만 연동 실행(SVC-005 복호화·전달)으로 진행하고, 거부·필수 미충족은 복호화를 수행하지 않고 결과 코드를 최소 감사 기록한 뒤 200 정상 종료한다. `#214` 로 **복호화 이전 단계라 연동 추적 키가 없어** 거부·미충족 시 처리상태·연동이력을 남기지 않는다(구 거부 시 상태 저장 폐기). 개인식별 동의 증빙 원장은 저장하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 3(사용자 — 접근·동의·승인 페이지) / 정책 BIZ-002.
- **담당자 확정 대기 (Q3)**: 동의 증빙 원장 미저장·결과만 반영은 기본안(BIZ-002-04·EXC-BIZ-04).

---

## FN-008 사용자 동의 처리

### 기본 정보

| 항목 | 내용 |
|------|------|
| 기능명 | 사용자 동의 처리 |
| 분류 | POL |
| 사용 서비스 | SVC-004 |
| 호출 PROC | PROC-201(화면 구성), PROC-202(동의/거부·승인 게이팅) |
| 연관 정책 | [BIZ-002](../policies/policy_BIZ.md#biz-002-사용자-동의-처리)(01·04·05·06·07) |
| 참조 데이터 | [ENT-002](../datas/data_ENT-002.md) 동의 항목, [ENT-001](../datas/data_ENT-001.md) 구성, [MDL-203](../datas/model_user.md) 동의 결과 |
| 관련 IA 항목 | USR-01 |

### 시그니처

```
function FN-008_buildConsentView (
  accessAddressId: string,   // 진입한 접근 주소 고유 ID(발송처 식별자, ENT-001.config_code)
): ConsentItem[]             // 구성 소속 동의 항목만(display_order 오름차순, 약관 컨텐츠 포함)

function FN-008_processDecision (
  decision: ConsentResult,   // MDL-203 (accessAddressId·decision·requiredConsentMet)
  now: DateTime,
): ApprovalOutcome           // { approved: boolean } — 승인 시 SVC-005 트리거, 거부·미충족 시 종료
```

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 제약 | 설명 |
|------|--------|------------|------|------|------|
| 입력 | accessAddressId | string | Y | 유효 활성 구성 참조 | 진입 접근 주소 고유 ID(발송처 식별자) |
| 입력 | decision | MDL-203 | Y | AGREE/REJECT + requiredConsentMet | 동의/거부 결정·필수 충족 여부 |
| 입력 | now | DateTime | Y | UTC | 감사 시각 |
| 출력 | ConsentItem[] | ENT-002 파생 | - | 구성 소속만 | 화면 노출 항목(label·description·termsContent·required·order) |
| 출력 | ApprovalOutcome | 구조 | - | { approved } | 승인 여부(승인만 SVC-005 진행) |

### 처리 흐름 (의사코드)

```
화면 구성 — buildConsentView, POL BIZ-002-01/05 (transform)
1. config = SELECT id FROM TBL_INTERLOCK_CONFIG
            WHERE config_code = :accessAddressId AND is_active = true AND deleted_at IS NULL;
   // 접근 주소 유효성(활성 구성 실재)은 진입(PROC-201·FN-005)에서 선검증(유효하지 않으면 EX-SEC-004)
2. items = SELECT item_label, item_description, terms_content, is_required, display_order
           FROM TBL_INTERLOCK_CONSENT_ITEM
           WHERE config_id = :config.id ORDER BY display_order;   // 구성 외 노출 금지, 약관 컨텐츠 포함
3. return items          // ConsentItem[] = {label, description?, termsContent?, required, order}

동의/거부·승인 게이팅 — processDecision, POL BIZ-002-06/07/04 (validate·transform·audit)
1. config = SELECT id, deleted_at, is_active FROM TBL_INTERLOCK_CONFIG
            WHERE config_code = :decision.accessAddressId AND is_active = true AND deleted_at IS NULL;
   // 구성 매칭 근거 재검증(화면 값 단독 신뢰 금지, BIZ-002-06)

2. 필수 동의 충족 서버 재검증 — POL BIZ-002-06 (validate)
   requiredItems = SELECT id FROM TBL_INTERLOCK_CONSENT_ITEM
                   WHERE config_id = :config.id AND is_required = true;
   serverRequiredMet = (decision.decision == 'AGREE') AND allChecked(requiredItems, decision)

3. if (decision.decision == 'REJECT' OR NOT serverRequiredMet)   // 거부·필수 미충족 — BIZ-002-07
        FN-013_writeAudit({ eventType:'CONSENT_REJECT', actorType:'SERVICE',
                            target: decision.accessAddressId, result:'INFO' })   // 결과 코드 최소 기록(PII·추적 키·원문 미포함)
        return { approved: false }   // 200 정상 종료(EXC-BIZ-03) — 복호화 미수행, 추적 키 없어 처리상태·연동이력 미생성(EXC-BIZ-11)

4. else  // AGREE + 필수 충족 — BIZ-002-06
        FN-013_writeAudit({ eventType:'CONSENT_AGREE', actorType:'SERVICE',
                            target: decision.accessAddressId, result:'INFO' })
        return { approved: true }    // 호출 PROC-202 가 연동 실행(SVC-005·PROC-203 복호화·전달) 트리거
```

> 동의 증빙 원장은 저장하지 않는다(BIZ-002-04) — 동의/거부 결과만 감사 로그(결과 코드)에 반영한다. 동의 결과는 화면 값 단독 신뢰 없이 서버가 구성 매칭 근거(accessAddressId)와 필수 동의 충족을 재검증한다(BIZ-002-06). 승인(AGREE·필수 충족)만 SVC-005 로 진행해 복호화·전달을 개시하고, 거부·미충족은 복호화를 수행하지 않는다. 복호화 이전이라 연동 추적 키가 없어 처리상태·연동이력을 남기지 않고(EXC-BIZ-11), 암호값(encX·encY)·생년월일은 본 단계에서 저장·기록하지 않는다(DATA-001·SEC-005-06).

### API 인터페이스

| 항목 | 내용 |
|------|------|
| 엔드포인트 | GET /api/consent/:accessAddressId (동의 항목 조회) · POST /api/interlock/approve (동의/거부·승인) |
| HTTP 메서드 | GET / POST |
| 인증 요구 | Public(발송처 링크 진입 컨텍스트) — 요청 제한(FN-014)·입력 검증(FN-005) 선적용 |
| 요청 DTO | GET: accessAddressId / POST: MDL-203(동의 결과) + 접근 컨텍스트(encX·encY·생년월일, 승인 시 SVC-005 복호화 입력) |
| 응답 DTO (200) | GET: 동의 항목 배열 / POST: 승인→SVC-005 실행 결과 / 거부·미충족→{ success:true }(종료 안내) |
| 응답 DTO (4xx) | 공통 에러 엔벨로프(FN-015): EX-SEC-004(진입) / 승인 후 복호화·전달 EX 는 SVC-005(EX-SEC-006/007·EX-BIZ-008/004) |

### 에러 처리 (에러 코드 카탈로그)

| HTTP status | EX 코드 | 발생 조건 | 사용자 메시지 | 개발자 노트 |
|-------------|---------|-----------|---------------|-------------|
| 400 | EX-SEC-004 | 접근 주소 참조 무효·진입 파라미터 형식·필수 위반 | "요청이 올바르지 않습니다." | 진입 검증(FN-005), 유효하지 않은 접근 주소 |
| 500 | EX-FN-999 | 조회·감사 처리 오류 | "잠시 후 다시 시도해주세요." | - |

- 사용자 거부·필수 동의 미충족 승인 차단은 EX 코드가 아니다 — 200 정상 종료 + 최소 감사(EXC-BIZ-03·EXC-BIZ-11). 승인 후 복호화 실패·암호 파라미터 형식·추적 키 누락은 연동 실행 단계(SVC-005·FN-020)에서 EX-SEC-006/007·EX-BIZ-008 로 처리한다.

### 의존 기능

| FN 코드 | 호출 시점 | 동기/비동기 | 실패 시 처리 |
|---------|----------|------------|--------------|
| FN-005 | 진입 검증(호출 PROC) | 동기 | 형식·크기·주입 선검증 |
| FN-013 | 동의/거부 감사(단계 3·4) | 동기 | 감사 실패는 처리에 영향 없음 |

- 승인 시 연동 실행(SVC-005)은 호출 PROC-202 가 트리거하며, 복호화(FN-020)·이력 생성(FN-016)·전달(FN-012)·상태 저장(FN-009)은 PROC-203 이 오케스트레이션한다. 본 FN 은 동의/거부 판정·게이팅까지만 책임진다.

### 구현 가이드

- 동의 화면은 접근 주소 구성에 설정된 동의 항목만 노출하고(구성 외 노출 금지, BIZ-002-01), 약관 컨텐츠(terms_content)가 있는 항목만 [상세] 버튼·약관 모달을 화면이 렌더한다(BIZ-002-05). 모달의 [동의]/[닫기] 는 제출 전 클라이언트 상태 조작으로 별도 서버 호출을 만들지 않는다(EXC-BIZ-08).
- 결과 검증은 서버가 구성 매칭 근거와 필수 동의 충족을 재검증한다(화면 값 단독 신뢰 금지, BIZ-002-06). 거부·미충족은 오류가 아닌 200 정상 종료로 처리하고, 복호화를 수행하지 않아 추적 키·처리상태·연동이력을 남기지 않는다(EXC-BIZ-11). `#214` 로 구 요청 키값(UUID) 발급·진입 컨텍스트 저장·거부 시 처리상태 저장·진입 시 연동이력 생성은 폐기·이동했다(연동이력 생성은 복호화 성공 후 SVC-005).
