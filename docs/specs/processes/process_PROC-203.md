# 연동 실행·서비스 B 전달 기능 정의

## 개요

- **정의 대상**: 사용자 동의가 완료된 연동 요청을 관리자 구성의 서비스 B 전달 주소로 중개하는 연동형 프로세스. 회원 키는 원본 무변형으로 전달 페이로드에만 실어 보내고 저장하지 않으며, 전달 실패 시 최대 2회 재시도 후 실패로 확정한다. 전달 결과(성공·실패)는 처리 상태 1건으로 저장(PROC-401)한다. 외부 호출은 반드시 BE 를 경유한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 "연동 실행: 서비스 A의 데이터 수신 → 동의 완료 시 서비스 B로 요청 전달".

---

## PROC-203 연동 실행·서비스 B 전달

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 실행·서비스 B 전달 |
| 분류 | INT |
| 그룹 | 사용자 연동 |
| 트리거 유형 | 시스템 이벤트(PROC-202 동의 경로 내부 호출) |
| 처리 방식 | 동기(외부 호출·재시도 포함) |
| 우선순위 | 높음 |
| 관련 IA 항목 | USR-02 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-005 | 서비스 B 전달·상태 전이(BR-202) |
| 정책(policy) | BIZ-003·SEC-002·DATA-001·DATA-003·OPS-002 | 전달 규칙·신뢰 위임·무저장·상태 저장·감사 |
| 공통 기능(FN) | FN-012(서비스 B 전달)·FN-009(상태 저장, PROC-401 경유)·FN-010(마스킹)·FN-013(감사) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-204(전달 페이로드)·MDL-301(처리 상태) | 아웃바운드·저장 모델 |
| DB 엔터티(ENT) | ENT-001·ENT-003(전달 파라미터 정의)·ENT-004(상태 저장) | 참조·저장 대상 |
| 화면(SCR) | (없음 — PROC-202 내부 호출) | 결과는 SCR-006 표시 |

### 진입점 및 진입 조건

- **진입점**: PROC-202 동의(AGREE) 경로의 내부 호출(`FN-012_deliverToServiceB`). 독립 엔드포인트 아님.
- **진입 조건**: 진입 컨텍스트 `consentConfirmed == true`(동의 완료), 활성 연동 구성 확인 완료.
- **사전 검증**: 동의 완료 확인(미동의 전달 차단), 상태 전이 유효성(동의→전달, 역전이 금지), 전달 대상 주소는 구성의 서비스 B 주소로 한정.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | ctx | EntryContext | Y | configCode·memberKey(무저장)·parameters·consentConfirmed |
| 입력 | requestKey | string(UUID v4) | Y | 상태 저장 연결 키 |
| 입력 | config | MDL-101 | Y | 동의 완료 확인된 활성 구성 |
| 입력 | now | DateTime | Y | 처리 일시 |
| 출력 | status | MDL-301 | - | 전달 결과 반영 후 저장된 상태 |

### 연관 데이터 및 외부 호출

- **호출 API**: 서비스 B 전달 주소(config.serviceBDeliveryUrl) — BE 경유 아웃바운드. 메서드=config.serviceBHttpMethod, 타임아웃·재시도 2회(기본안).
- **데이터 조회 대상**: ENT-003(전달 파라미터 정의, deliver_to_b=1), config.serviceBDeliveryUrl·method(구성 참조).
- **데이터 변경 대상(CRUD)**: ENT-004 INSERT(상태 1건, PROC-401 경유), ENT-006 INSERT(전달 실패·차단 감사).

### 실행 제약사항

- **트랜잭션 경계**: 외부 전달은 트랜잭션 밖(멱등성 없는 side-effect). 상태 저장(PROC-401)은 전달 결과 확정 후 단건 트랜잭션. 전달 실패여도 상태 1건은 반드시 저장(EXC-BIZ-06).
- **동시성 제어**: 요청 키값 단위 1회 실행(PROC-202 컨텍스트 폐기로 재실행 차단). 재시도는 순차(최초 1 + 재시도 2회).
- **성능 요구**: 외부 호출 타임아웃·재시도 정책(build 확정). 재시도 2회 후 실패 확정.
- **보안 요구**: 회원 키 원본 무변형 전달(SEC-002-02)·무저장(DATA-001-01), 구성 외 주소 전달 금지(BIZ-003-02), 로그 노출 시 마스킹(FN-010).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
해당 없음 — PROC-202 동의 경로의 BE 내부 호출로 FE 처리 단계가 없다.
전달 결과(성공/전달실패)는 PROC-202 응답을 통해 SCR-006 결과 화면에서 표시된다
(동의완료=success / 전달실패=EX-BIZ-004 error Banner).
```

#### BE 측 처리 (의사코드)

```
B1. 사전 조건 검증 — FN-012 진입 (BIZ-003-01·BIZ-003-04)
  if (!ctx.consentConfirmed)                 // 미동의 전달 차단
        FN-013_writeAudit({ eventType:'DELIVERY_BLOCK', actorType:'SYSTEM',
                            target: requestKey, result:'BLOCKED' })
        → 내부 차단(EX 코드 없음)
  assert(stateTransition == '동의→전달')       // 역전이 금지(BIZ-003-04)

B2. 전달 대상 결정 — BIZ-003-02
  targetUrl = config.serviceBDeliveryUrl      // 구성 외 주소 금지
  method    = config.serviceBHttpMethod

B3. 페이로드 구성 — SEC-002·DATA-001-01 (전달 파라미터 정의 조회)
  paramDefs = SELECT param_name, source_key_a, deliver_to_b
              FROM TBL_INTERLOCK_PARAMETER
              WHERE config_id = :config.id AND deliver_to_b = 1
              ORDER BY display_order;                          -- IX_PARAM_CONFIG
  payload = {                                  // MDL-204, 저장 안 함
      targetUrl, httpMethod: method,
      memberKey: ctx.memberKey,                // 원본 무변형(SEC-002-02), 메모리 전용
      parameters: mapParameters(ctx.parameters, paramDefs)   // source_key_a→param_name 리매핑
  }

B4. 전달·재시도 — BIZ-003-03 (BR-202)
  attempt = 0; success = false
  while (attempt <= 2 AND !success):           // 최초 1 + 재시도 2회(기본안)
        resp = httpCall(payload, timeout)      // BE 경유 외부 호출(라이브러리 비강제)
        if (resp.ok)   success = true
        else           attempt = attempt + 1
  isSuccess = success

B5. 상태 저장 — PROC-401 / FN-009_saveStatus (DATA-003-02)
  status = FN-009_saveStatus({ requestKey, configId: config.id,
                               isSuccess, processedAt: now })   // 성공·실패 모두 1건

B6. 결과 처리 — BIZ-003-03·OPS-002
  if (!isSuccess):
        FN-013_writeAudit({ eventType:'DELIVERY_FAIL', actorType:'SERVICE',
                            target: requestKey, result:'FAIL' })
        → throw DeliveryFailedError (502, EX-BIZ-004)   // 상태는 저장됨(EXC-BIZ-06)
  return status
  정책 적용 지점: SEC-002(무변형), DATA-001(무저장), BIZ-003(전달·재시도), OPS-002(실패 감사)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| 도메인→응답(아웃바운드) | BE(FN-012) | ctx·config·paramDefs | MDL-204 페이로드 | source_key_a→param_name 리매핑, deliver_to_b=1만, memberKey 무변형 |
| 응답→도메인 | BE(FN-012) | 서비스 B 응답 | isSuccess | resp.ok 판정·재시도 집계 |
| 도메인→ENT | BE(PROC-401) | 전달 결과 | ENT-004 행 | requestKey·configId·is_success·processed_at |
| 도메인→로그 | BE(감사) | 실패·차단 이벤트 | ENT-006 행 | requestKey 마스킹(FN-010) |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | BE | 사전 조건 검증 | (PROC-202 동의) | 동의 완료·상태 전이 검증(미동의 차단) | 검증 통과 |
| 2 | BE | 전달 대상 결정 | 검증 통과 | 구성의 서비스 B 주소·메서드 확정 | 전달 대상 |
| 3 | BE | 페이로드 구성 | 전달 대상 | deliver_to_b=1 파라미터 매핑·회원 키 무변형 | MDL-204 |
| 4 | BE | 전달·재시도 | MDL-204 | 서비스 B 호출(최대 2회 재시도, BR-202) | isSuccess |
| 5 | BE | 상태 저장 | isSuccess | PROC-401 상태 1건 저장 | 처리 상태 |
| 6 | BE | 결과 처리 | 처리 상태 | 실패 시 감사·502 EX-BIZ-004 / 성공 반환 | status/502 |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-202 | 서비스 B 응답 성공 / 실패 | 성공=처리완료, 실패=최대 2회 재시도 후 실패 확정 | 성공 상태 / 실패 상태 |
| EX-BIZ-004 | 서비스 B 오류·전달 실패(재시도 2회 후) | 실패 상태 저장 + 감사 | 502 연동 대상 처리에 실패했습니다. |
| (내부 차단) | 미동의 전달·구성 외 주소·역전이 | 감사 로그 + 내부 차단(EX 코드 없음) | 사용자 미노출(BIZ-003-01/02/04) |
| EX-FN-999 | 페이로드 구성·상태 저장 오류 | 오류 응답 | 500 잠시 후 다시 시도해주세요. |

> 전달 실패(EX-BIZ-004)여도 처리 상태 1건은 반드시 저장된다(EXC-BIZ-06). 재시도 후 실패만 EX-BIZ-004 로 확정한다.

### 실행 결과

- **정상 결과**: 서비스 B 전달 성공, 처리 상태 1건(is_success=1) 저장. PROC-202 로 200 반환 → SCR-006 "연동이 완료되었습니다."
- **실패 결과**: 재시도 2회 후 실패 → 처리 상태 1건(is_success=0) 저장 + DELIVERY_FAIL 감사 + 502 EX-BIZ-004. 미동의·구성 외 주소는 내부 차단(감사).
- **후속 트리거**: PROC-401(상태 저장). 저장된 상태는 PROC-301 조회·PROC-402 보관 대상.

### 의존 프로세스

- **호출 관계**: PROC-401(동기, 상태 저장 — FN-009_saveStatus).
- **선행 관계**: PROC-202(동의 완료 확인).
- **이벤트 관계**: 전달 결과 확정이 PROC-401 상태 저장을 트리거한다.

### 구현 가이드

- 회원 키는 요청 처리 컨텍스트 밖으로 넘기지 않고 저장 모델에서 원천 배제한다. 값 변형·정규화·복호화를 수행하지 않는다(SEC-002·DATA-001). 전달 대상 주소는 구성의 서비스 B 주소로만 한정한다(구성 외 주소 금지).
- 타임아웃·재시도 정책(최대 2회)은 기본안이며 확정 시 BIZ-003 을 리비전한다. 외부 호출은 반드시 BE 를 경유한다(HTTP 클라이언트 라이브러리 강제 없음).
- 전달 실패여도 처리 상태 1건은 반드시 남긴다. 전달은 멱등하지 않으므로 요청 키값 단위 1회 실행(컨텍스트 폐기로 재실행 차단)을 보장한다.
