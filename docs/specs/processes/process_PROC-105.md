# 연동 구성 활성 전환 기능 정의

## 개요

- **정의 대상**: 연동 관리자가 등록된 발송처 접근 주소 구성의 활성/비활성 상태를 전환하는 프로세스. 단일 책임·트리거 원칙에 따라 조회(PROC-102)와 분리 채번하며, 선행 도메인(SVC-002·SCR-002/004)이 활성 전환을 본 PROC-105 로 인용한다(정합 완료). 활성 상태는 성과 지표 "활성 연동 구성(발송처 접근 주소) 수"의 근거다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §성과 지표 "활성 연동 구성 수" / §수행 범위 "관리자 — 연동 구성 관리".

---

## PROC-105 연동 구성 활성 전환

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 구성 활성 전환 |
| 분류 | RR |
| 그룹 | 관리자 / 연동 구성 관리 |
| 트리거 유형 | 사용자 액션(SCR-002·004 활성 Toggle) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | ADM-02 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-002 | 활성/삭제(BR-103) |
| 정책(policy) | SEC-001·AUTH-001/002·OPS-002 | IP·세션·활성 전환 감사 |
| 공통 기능(FN) | FN-003(세션)·FN-013(감사)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-101(연동 구성) | 도메인 참조 |
| DB 엔터티(ENT) | ENT-001·ENT-006 | 변경·감사 대상 |
| 화면(SCR) | SCR-002·SCR-004 | 활성 Toggle 트리거 |

### 진입점 및 진입 조건

- **진입점**: `PATCH /api/admin/configs/:id/active`. SCR-002·004 활성 `Toggle` 클릭.
- **진입 조건**: PROC-104 IP 게이트 통과 + FN-003 유효 세션.
- **사전 검증**: id UUID 형식, isActive boolean, 대상 구성 존재·미삭제(deleted_at IS NULL).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | id | string(UUID) | Y | 대상 구성 |
| 입력 | isActive | boolean | Y | 전환 목표 상태 |
| 출력 | result | { id, isActive } | - | 전환 결과 |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음.
- **데이터 조회 대상**: ENT-001(대상 존재 확인).
- **데이터 변경 대상(CRUD)**: ENT-001 UPDATE(is_active·updated_at/by), ENT-006 INSERT(감사).

### 실행 제약사항

- **트랜잭션 경계**: 단건 UPDATE 트랜잭션.
- **동시성 제어**: id 행 단위 UPDATE. 멱등(동일 상태 재요청 시 결과 동일). 대상 부재는 "대상 없음" 처리.
- **성능 요구**: 관리자 저빈도 단건. 별도 임계치 없음.
- **보안 요구**: IP+세션, 활성 전환 감사(OPS-002). 회원 키·처리 상태 무관(설정 데이터).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 활성 Toggle 트리거 → 요청   (SCR-002/004)
  진입 트리거: SCR-002 행 활성 Toggle / SCR-004 활성 Toggle 클릭
  사용 상태/폼: config = { id, isActive }, next = !config.isActive
  요청 DTO 변환: payload = { isActive: next }
  호출 수단: mutation → PATCH /api/admin/configs/:id/active (payload)
  진행 중 UI: 낙관적 업데이트(Badge 즉시 next) 또는 응답 확정 후 반영(택1, build)

F2. 응답 수신 → 캐시 갱신 → UI 전이
  onSuccess(res→{ data:{ id, isActive } }):
    캐시 무효화(["admin","configs","list"]) · ["admin","configs",id] 갱신
    성공 Toast("상태를 변경했습니다.") + Badge/Toggle 갱신
  onError(err):
    낙관 업데이트였다면 롤백(이전 isActive 복원)
    if (err.code=='EX-AUTH-002') → redirect SCR-001(?expired=1)
    else → 실패 Toast("상태 변경에 실패했습니다.")
  정책 적용 지점: 활성 상태는 성과 지표 근거(표시), 세션 만료 재인증 유도
```

#### BE 측 처리 (의사코드)

```
B1. 진입 가드 → 인증 → 입력 검증   [BR-103]
  엔드포인트: PATCH /api/admin/configs/:id/active
  인증·인가: (선행) PROC-104 IP 게이트 → FN-003_verifySession(cookie.sessionId, now)
             실패 → 401 EX-AUTH-001 / 유휴 만료 401 EX-AUTH-002
  입력 검증: id UUID 형식·isActive boolean (위반 → 400 EX-SEC-004)

B2. 대상 존재 확인·전환 (단건 트랜잭션)
  BEGIN;
    UPDATE TBL_INTERLOCK_CONFIG
      SET is_active = :isActive, updated_at = now(), updated_by = :session.username
    WHERE id = :id AND deleted_at IS NULL;
    affected = ROW_COUNT;
  COMMIT;
  if (affected == 0) → 200 { data: null } (대상 없음/이미 삭제, 오류 아님)

B3. 커밋 후 감사 → 응답
  FN-013_writeAudit({ eventType: :isActive?'CONFIG_ACTIVATE':'CONFIG_DEACTIVATE',
                      actorType:'ADMIN', actorId:session.username,
                      target: :id, result:'SUCCESS' })   // OPS-002-01
  응답: FN-015_ok({ id, isActive })
  정책 적용 지점: OPS-002(활성 전환 감사), SEC-004(바인딩 전용 쿼리)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | Toggle 상태 | { isActive } | boolean 반전값 |
| 도메인→ENT | BE 리포지토리 | 전환 명령 | ENT-001 UPDATE | is_active·updated_at/by 갱신 |
| 도메인→응답 | BE 컨트롤러 | 전환 결과 | { id, isActive } | 최소 결과 반환 |
| 응답→FE | FE 어댑터 | 결과 DTO | Badge/Toggle 상태 | 상태 갱신·Toast |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | Toggle 트리거 | (사용자 클릭) | 반전값 요청 DTO 변환 | { isActive } |
| 2 | BE | 게이트·인증·검증 | 요청 DTO | PROC-104 + FN-003 + 형식 검증 | 검증된 명령 |
| 3 | BE | 존재 확인·전환 | 검증된 명령 | ENT-001 UPDATE(deleted_at IS NULL) | 전환 결과 |
| 4 | BE | 감사·응답 | 전환 결과 | FN-013 감사 + FN-015 응답 | 결과 DTO |
| 5 | FE | 응답 처리 | 결과 DTO | Badge 갱신·Toast·캐시 무효화 | (UI 갱신) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| BR-103 | 활성 / 비활성 전환 | isActive 값으로 UPDATE·감사 이벤트 구분 | 활성 또는 비활성 상태 |
| (분기) 대상 없음 | id 부재·이미 삭제됨 | 오류 아닌 "대상 없음" | 200 data:null |
| EX-AUTH-001 | 미인증 세션 | 진입 차단, 로그인 유도 | 401 로그인이 필요합니다. |
| EX-AUTH-002 | 세션 유휴 30분 초과 | 세션 만료, 재인증 유도 | 401 다시 로그인해주세요. |
| EX-SEC-004 | id·isActive 형식 위반 | 요청 거부 | 400 입력 형식이 올바르지 않습니다. |
| EX-FN-999 | UPDATE·DB 오류 | 롤백, 감사 | 500 잠시 후 다시 시도해주세요. |

> IP 차단(EX-SEC-001)은 선행 PROC-104 게이트에서 처리된다.

### 실행 결과

- **정상 결과**: ENT-001 is_active 갱신, CONFIG_ACTIVATE/DEACTIVATE 감사 1건, { id, isActive } 응답. 활성 구성만 PROC-201·203 소비 대상.
- **실패 결과**: EX-AUTH-001/002·EX-SEC-004·EX-FN-999 엔벨로프. 대상 없음은 200 data:null.
- **후속 트리거**: 없음. 비활성 전환 시 이후 PROC-201 진입에서 해당 구성 조회 제외(is_active=true 조건).

### 의존 프로세스

- **호출 관계**: 없음.
- **선행 관계**: PROC-104·PROC-103(세션)·PROC-101(대상 구성 존재).
- **이벤트 관계**: 없음.

### 구현 가이드

- 활성 전환은 낙관적 업데이트 후 실패 시 롤백하거나 응답 확정 후 반영한다(택1, build 결정). 존재하지 않는 구성은 오류가 아닌 "대상 없음"으로 처리한다.
- 활성 전환은 감사 로그 대상(OPS-002)이다. DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02).
- **참조 정합(완료)**: SCR-002/004 의 활성 `Toggle` 인터랙션과 SVC-002 BR-103 은 본 PROC-105 를 인용한다(선행 도메인 정합 확인).
