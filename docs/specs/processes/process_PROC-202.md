# 동의·거부 처리 기능 정의

## 개요

- **정의 대상**: 최종 사용자의 동의/거부 결과를 구성 매칭 근거로 검증하고 분기하는 프로세스. 동의(AGREE) 시 연동 실행(PROC-203)을 동기 호출하고, 거부(REJECT) 시 전달 없이 처리 상태(성공 여부=실패·미전달)를 저장(PROC-401)하며 200 정상 종료한다. 개인식별 동의 증빙 원장은 저장하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "사용자 — 이용 동의 페이지: 동의/거부 처리".

---

## PROC-202 동의·거부 처리

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 동의·거부 처리 |
| 분류 | RR |
| 그룹 | 사용자 연동 |
| 트리거 유형 | 사용자 액션(SCR-005 동의/거부 제출) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | USR-01 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-004 | 동의/거부 처리(BR-201) |
| 정책(policy) | BIZ-002·SEC-004·DATA-001·DATA-003 | 동의 검증·입력 검증·무저장·상태 저장 |
| 공통 기능(FN) | FN-005(입력 검증)·FN-008(동의 처리)·FN-012(전달, 동의 시)·FN-009(상태 저장)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-203(동의 결과)·MDL-301(처리 상태) | 요청·저장 모델 |
| DB 엔터티(ENT) | ENT-001(활성 구성)·ENT-004(상태 저장, PROC-401 경유) | 조회·저장 대상 |
| 화면(SCR) | SCR-005·SCR-006(결과) | 제출·결과 표시 |

### 진입점 및 진입 조건

- **진입점**: `POST /api/consent/:requestKey`. SCR-005 [동의]/[거부] 버튼 제출.
- **진입 조건**: 요청 키값 진입 컨텍스트 유효(PROC-201 발급). 필수 동의 항목 체크(FE 선검증).
- **사전 검증**: MDL-203 스키마(requestKey UUID·decision enum·configCode)(FN-005), 진입 컨텍스트 존재·구성 매칭 근거 일치.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | requestKey | string(UUID v4) | Y | 대상 진입 식별 |
| 입력 | decision | 'AGREE'/'REJECT' | Y | 동의/거부 결정 |
| 입력 | configCode | string | Y | 구성 매칭 검증 근거 |
| 출력 | status | MDL-301 | - | 처리 상태(거부/전달 결과) |

### 연관 데이터 및 외부 호출

- **호출 API**: 서비스 B 전달은 동의 시 PROC-203(내부) → FN-012 가 BE 경유로 수행.
- **데이터 조회 대상**: 진입 컨텍스트(메모리), ENT-001(활성 구성, config_code·is_active=1·deleted_at IS NULL).
- **데이터 변경 대상(CRUD)**: ENT-004 INSERT(거부 즉시 / 동의는 PROC-203→PROC-401 저장), ENT-006 INSERT(감사). 처리 후 진입 컨텍스트 폐기.

### 실행 제약사항

- **트랜잭션 경계**: 거부 시 ENT-004 단건 저장 트랜잭션(PROC-401). 동의 시 PROC-203 이 전달·저장 경계를 소유.
- **동시성 제어**: 요청 키값 단위. 처리 완료 후 컨텍스트 폐기로 재제출 방지(재제출 시 EX-DATA-002). ENT-004 PK(request_key) 중복 방지.
- **성능 요구**: 동의 시 서비스 B 전달·재시도 지연 포함(PROC-203). 별도 임계치 없음.
- **보안 요구**: 결과 화면 값 단독 신뢰 금지(서버 구성 매칭 검증), 회원 키 무저장, 거부는 200 정상 종료(EX 아님).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 동의/거부 제출 트리거 → 요청   (SCR-005)
  진입 트리거: SCR-005 [동의](AGREE) 또는 [거부](REJECT) 버튼 제출
  사용 상태/폼: requestKey = route.param, checked = {order:boolean}, consentItems[]
  검증 로직(동의 시): if (!consentItems.filter(i=>i.required).every(i=>checked[i.order]))
                         → "필수 동의 항목에 동의해주세요." → 동의 버튼 비활성 유지
  요청 DTO 변환: payload = { requestKey, decision: 'AGREE'|'REJECT', configCode: ctx.configCode }
  호출 수단: mutation → POST /api/consent/:requestKey (payload)
  진행 중 UI: Submitting — 버튼 Spinner + disabled

F2. 응답 수신 → 결과 전이   (→ SCR-006)
  onSuccess(res→{ success:true }):
    navigate → SCR-006 결과(네비게이션 상태: 동의완료 또는 거부종료)
  onError(err):
    if (err.code=='EX-BIZ-004') → navigate SCR-006(전달실패 상태)   // 상태 1건은 저장됨
    else if (err.code=='EX-DATA-002') → Banner "요청이 올바르지 않습니다."(만료·불일치)
    else → Banner(error)
  정책 적용 지점: 거부는 오류 아닌 정상 종료(EXC-BIZ-03), decision 서버 검증(FN-008)
```

#### BE 측 처리 (의사코드)

```
B1. 진입 → 입력 검증
  엔드포인트: POST /api/consent/:requestKey
  인증: 요청 키값(진입 컨텍스트). 입력 검증 FN-005_validateInput(MDL-203, schema, rawSize)
        크기>1MB → 413 EX-SEC-005 / 위반 → 400 EX-SEC-004

B2. 동의 결과 검증·분기 — FN-008_processDecision(decision, now)   [BR-201]
  ctx = entryContextStore.get(decision.requestKey)
  if (ctx is null OR ctx.configCode != decision.configCode)      // 구성 매칭 근거 검증
        → 400 EX-DATA-002 (만료·불일치)
  config = SELECT id FROM TBL_INTERLOCK_CONFIG
           WHERE config_code = :ctx.configCode AND is_active = 1 AND deleted_at IS NULL;

B3a. 거부 경로 — REJECT (BIZ-002-03)
  status = PROC-401 / FN-009_saveStatus({ requestKey, configId: config.id,
              isSuccess: false, processedAt: now })     // 미전달·실패 상태 1건
  entryContextStore.remove(requestKey)                  // 컨텍스트 폐기(무저장)
  FN-013_writeAudit({ eventType:'CONSENT_REJECT', actorType:'SERVICE',
                      target: requestKey, result:'INFO' })
  응답: FN-015_ok({ success:true })                     // 200 정상 종료(EXC-BIZ-03)

B3b. 동의 경로 — AGREE (BIZ-002-02)
  ctx.consentConfirmed = true                           // FN-012 사전 조건
  status = PROC-203_deliverAndSave(ctx, requestKey, config, now)  // 내부 호출(전달→상태 저장)
      // PROC-203 은 FN-012 전달(재시도 2회)→FN-009 상태 저장. 실패 시 EX-BIZ-004(502) 전파
  entryContextStore.remove(requestKey)                  // 처리 완료 후 컨텍스트 폐기
  응답: 성공 → FN-015_ok({ success:true }) / 실패 → 502 EX-BIZ-004(상태는 저장됨)
  정책 적용 지점: BIZ-002(동의 검증), DATA-001(컨텍스트 폐기·무저장), DATA-003(상태 저장)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | SCR-005 결정·체크 | MDL-203 DTO | decision·configCode 매핑 |
| 요청→도메인 | BE 컨트롤러 | MDL-203 DTO | ConsentResult | FN-005 검증·컨텍스트 매칭 |
| 도메인→ENT | BE(PROC-401) | 결정 결과 | ENT-004 행 | REJECT→is_success=0 / AGREE→전달 결과 반영 |
| 도메인→응답 | BE 컨트롤러 | 처리 상태 | { success } | 상태 값 미노출(결과 유형만) |
| 응답→FE | FE 어댑터 | 응답·에러 | SCR-006 상태 | 동의완료/거부/전달실패 유형 매핑 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 동의/거부 제출 | (사용자 결정) | 필수 항목 검증 + DTO 변환 | MDL-203 DTO |
| 2 | BE | 입력 검증 | MDL-203 DTO | FN-005 재검증 | 검증된 결정 |
| 3 | BE | 컨텍스트·구성 매칭 검증 | 검증된 결정 | FN-008 ctx·configCode 대조(BR-201) | 활성 구성 |
| 4a | BE | 거부 처리 | 활성 구성 | FN-009 상태 저장(실패)·컨텍스트 폐기·감사 | 200 |
| 4b | BE | 동의 처리 | 활성 구성 | PROC-203 전달·저장 호출·컨텍스트 폐기 | 처리 상태 |
| 5 | FE | 결과 전이 | 응답/에러 | SCR-006 결과 유형 표시 | (UI 전이) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-201 | 동의(AGREE) / 거부(REJECT) | AGREE→PROC-203 전달, REJECT→미전달 상태 저장 | 전달 / 종료(상태=실패·미전달) |
| EX-DATA-002 | 요청 키값 미존재·구성 매칭 불일치 | 처리 거부 | 400 요청이 올바르지 않습니다. |
| EX-BIZ-004 | 동의 후 서비스 B 전달 실패(PROC-203 전파) | 502, 상태 1건 저장됨 | 502 연동 대상 처리에 실패했습니다. |
| EX-SEC-004 | 입력 형식 위반·주입 | 요청 거부 | 400 요청이 올바르지 않습니다. |
| EX-SEC-005 | 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-FN-999 | 조회·상태 처리 오류 | 오류 응답 | 500 잠시 후 다시 시도해주세요. |

> 사용자 거부는 EX 코드가 아니다 — 200 정상 종료 + 상태 1건(실패·미전달) 기록(EXC-BIZ-03·EXC-DATA-03).

### 실행 결과

- **정상 결과(동의)**: PROC-203 전달 성공 → 처리 상태 1건(성공), 200. SCR-006 "연동이 완료되었습니다."
- **정상 결과(거부)**: 처리 상태 1건(실패·미전달), CONSENT_REJECT 감사, 200. SCR-006 "연동이 취소되었습니다."
- **실패 결과**: EX-DATA-002(400)·EX-BIZ-004(502, 상태 저장됨). SCR-006 전달실패 안내.
- **후속 트리거**: 동의 시 PROC-203(→PROC-401). 처리 상태는 이후 PROC-301 조회 대상.

### 의존 프로세스

- **호출 관계**: PROC-203(동기, 동의 시). 거부 시 PROC-401(FN-009_saveStatus) 직접 호출.
- **선행 관계**: PROC-201(요청 키값·진입 컨텍스트).
- **이벤트 관계**: 동의 결과가 PROC-203 전달을 트리거한다.

### 구현 가이드

- 동의 결과는 화면 값 단독 신뢰 없이 서버가 진입 컨텍스트의 구성 매칭 근거(configCode)로 검증한다. 한 인터랙션(동의/거부 제출)=1 PROC(PROC-202), 서비스 B 전달은 내부 호출이다.
- 거부는 오류가 아닌 200 정상 종료로 처리하고 상태 1건(실패·미전달)을 남긴다. 처리 완료 후 진입 컨텍스트(회원 키 포함)를 메모리에서 폐기한다(무저장).
- 동의 증빙 원장은 저장하지 않는다(BIZ-002-04). 결과는 처리 상태(is_success)에만 반영된다.
