# 이용 동의 진입·표시 기능 정의

## 개요

- **정의 대상**: 발송처 링크(`/interlock/entry/:accessAddressId?encX=…&encY=…`)로 진입한 사용자에게 **접근 주소 고유 ID(=발송처 판별값)**에 설정된 동의 항목만 노출하고, **본인확인용 생년월일 입력 필드**를 함께 표시하는 프로세스. encX·encY 는 불투명 URL 파라미터로 FE 메모리에만 실려 승인 제출(PROC-202) 본문으로 전달된다. 연동 추적 키는 복호화 성공 이후(PROC-203)에 확보되므로 본 진입 단계(복호화 이전)에서는 처리 상태(ENT-004)·연동이력(ENT-007)을 생성하지 않는다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §수행 범위 3 "사용자 — 접근·동의·승인 페이지: 발송처 링크로 진입, 생년월일 입력, 구성된 동의 항목 노출·동의 체크 후 연동 승인" · §데이터 원칙(무저장).

> **2026-07-11 `#214` 개정**: 입력이 단일 암호화 JSON 으로 바뀌어 **허브 발급 요청 키값(UUID) 발급·진입 컨텍스트 일시 저장(구 FN-007)·진입 시 연동이력 생성(구 내부 PROC-403)·지정 파라미터 값 검증(구 EX-BIZ-007)을 폐기**했다. 진입은 접근 주소 고유 ID 로 발송처를 판별하고, 본 단계는 접근·생년월일 입력·동의 항목 표시에 집중한다. 조회 키는 접근 주소 고유 ID(config_code)다.

---

## PROC-201 이용 동의 진입·표시

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 이용 동의 진입·표시(생년월일 입력·동의 항목 조회) |
| 분류 | RR |
| 그룹 | 사용자 연동 |
| 트리거 유형 | 외부 진입(발송처 링크) + 화면 이벤트(SCR-005 mount) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | USR-01 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-004 | 접근·생년월일·동의 화면 구성 |
| 정책(policy) | OPS-001·SEC-004·AUTH-004·BIZ-002·DATA-001 | 요청 제한·입력 검증·생년월일 성격·동의 항목 노출·무저장 |
| 공통 기능(FN) | FN-014(요청 제한)·FN-005(입력 검증)·FN-008(동의 화면 구성)·FN-015(엔벨로프) | 호출 단위 로직(읽기 전용 — 직접 감사 이벤트 없음, 요청 제한 초과 감사는 FN-014 내부) |
| 데이터 모델(MDL) | MDL-201(접근 컨텍스트·무저장) | 인바운드 컨텍스트 |
| DB 엔터티(ENT) | ENT-001(활성 구성 조회)·ENT-002(동의 항목). ENT-004·ENT-007 미생성 | 조회 대상 |
| 화면(SCR) | SCR-005 | 이용 동의 화면 |

### 진입점 및 진입 조건

- **진입점**: `/interlock/entry/:accessAddressId?encX=…&encY=…`(발송처 링크 — SPA 진입) · `GET /api/consent/:accessAddressId`(SCR-005 mount — 동의 항목 조회).
- **진입 조건**: Public(발송처 링크 진입 흐름). 관리자 인증 경로와 분리. 접근 주소 고유 ID 로 활성 구성 특정.
- **사전 검증**: 요청 제한(FN-014 분당 60회, 출발지 IP 기준), 파라미터 크기·형식·주입(FN-005), 접근 주소 고유 ID 로 유효 활성 구성 참조. `#214` 로 지정 파라미터 값 검증(구 EX-BIZ-007)은 폐기됐다(복호화 이전이라 추적 키 없음).

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | accessAddressId | string | Y | 접근 주소 고유 ID(=발송처 식별자, config_code) |
| 입력 | encX, encY | string | Y | 이중 암호값(불투명 URL 파라미터·FE 메모리·무저장) |
| 출력 | consentItems | ConsentItem[] | - | 구성 소속 동의 항목(label·description·termsContent·required·order, display_order 오름차순) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음(조회만).
- **데이터 조회 대상**: ENT-001(활성 구성, config_code·is_active=true·deleted_at IS NULL), ENT-002(동의 항목, config_id).
- **데이터 변경 대상(CRUD)**: 없음. 처리 상태(ENT-004)·연동이력(ENT-007)은 본 PROC 에서 생성하지 않는다(복호화 성공 후 PROC-203/403·401 단계로 지연). encX·encY·생년월일은 비영속(FE 메모리 경유, 서버 저장 없음, DATA-001-04).

### 실행 제약사항

- **트랜잭션 경계**: 없음(동의 항목 조회는 SELECT 만, 자동 커밋). 진입 응답에 DB 영속화 없음.
- **동시성 제어**: 조회 전용으로 경합 없음. 접근 주소 고유 ID 로 활성 구성을 특정하고 진입 상태를 서버에 저장하지 않는다(무상태 진입).
- **성능 요구**: 요청 제한 분당 60회 초과 시 429(FN-014, EXC-OPS-01 기본안). 진입점 미들웨어 카운터(출발지 IP 기준).
- **보안 요구**: encX·encY·생년월일 무저장(FE 메모리 경유만, DATA-001-04), 화면 렌더·로깅 금지(SEC-005-06·SEC-006-06). 동의 화면은 진입한 접근 주소 구성 소속 항목만 노출(BIZ-002-01). 회원 키·연동 추적 키는 이 단계에 존재하지 않는다(복호화 이전).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 동의 화면 mount → 접근 컨텍스트 수집 → 항목 조회   (SCR-005)
  진입 트리거: 발송처 링크로 SCR-005 페이지 mount (/interlock/entry/:accessAddressId?encX=…&encY=…)
  사용 상태/폼:
    accessAddressId = route.param('accessAddressId')       // 발송처 판별값(별도 발송처 선택 UI 없음)
    encX = query('encX'); encY = query('encY')             // 불투명 값, 메모리 보유·화면 미렌더
    form = { birthDate: '' }                                // 생년월일 입력(6자리)
    consentQuery(캐시 키 ["consent", accessAddressId])
  호출 수단: query → GET /api/consent/:accessAddressId
  진행 중 UI: Initial/Loading — 카드 Skeleton

F2. 항목 응답 → 렌더
  onSuccess(res→{ data: ConsentItem[] }):
    본인확인 섹션 렌더: 생년월일 TextField(birthdate, 6자리 numeric)
    Checkbox 목록 렌더(각 항목 label·description·required 표시, order 정렬)
    항목별: if (item.termsContent 존재) → 라벨 우측에 [상세] 버튼 렌더(BIZ-002-05)
    승인 버튼 활성 조건 계산: birthDate 형식 유효(yyMMdd) AND requiredItems.every(checked)   // AUTH-004-01·BIZ-002-06
  onDetailClick(item):     // 클라이언트 전용, 서버 호출 없음
    약관 상세 Modal 열기(제목=item.label, 본문=item.termsContent, [동의]/[닫기])
    [동의] → checked[item.order]=true; 모달 닫기; 승인 버튼 활성 재계산   // EXC-BIZ-08
    [닫기] → 모달 닫기(체크 불변)
  onError(err):
    if (err.code=='EX-SEC-004') → Banner "연동 링크가 올바르지 않습니다. 발송처에 문의해주세요."(무효 접근 주소)
    else if (err.code=='EX-OPS-001') → Banner "잠시 후 다시 시도해주세요."
    else → Banner(error)
  정책 적용 지점: 구성 소속 항목만 노출(BIZ-002-01), encX·encY·생년월일 화면 미표시·미로깅(SEC-005-06), 회원 키·추적 키 부재(복호화 이전, DATA-001)
```

#### BE 측 처리 (의사코드)

```
B1. 동의 화면 데이터 구성   (GET /api/consent/:accessAddressId, SCR-005 mount)
  인증: Public(발송처 링크 진입 흐름). 관리자 인증 경로와 분리
  요청 제한: FN-014_checkRateLimit(sourceIp, 'consent', now, 60)   (OPS-001)
        초과 → 429 EX-OPS-001
  입력 검증: FN-005_validateInput({ accessAddressId }, schema, rawSize)
        크기>1MB → 413 EX-SEC-005 / 형식 위반 → 400 EX-SEC-004
  FN-008_buildConsentView(accessAddressId):
    config = SELECT id FROM TBL_INTERLOCK_CONFIG
             WHERE config_code = :accessAddressId AND is_active = true AND deleted_at IS NULL;   -- UQ_CONFIG_CODE
    if (config is null) → 400 EX-SEC-004 (유효하지 않은 접근 주소 참조 — 발송처 링크 오류)
    items = SELECT item_label, item_description, terms_content, is_required, display_order
            FROM TBL_INTERLOCK_CONSENT_ITEM
            WHERE config_id = :config.id ORDER BY display_order;   -- IX_CONSENT_CONFIG, 구성 외 노출 금지, 약관 컨텐츠 포함
  응답: FN-015_ok(items)   -- ConsentItem[] = {label, description?, termsContent?, required, order}
  정책 적용 지점: OPS-001(요청 제한), SEC-004(입력 검증), DATA-001(무저장·무상태 진입), BIZ-002-01(구성 소속 항목), BIZ-002-05(약관 컨텐츠 포함)

  // #214: 요청 키값(UUID) 발급·진입 컨텍스트 저장·연동이력 생성(구 내부 PROC-403)·지정 파라미터 값 검증(구 EX-BIZ-007)은 폐기.
  //        진입 상태를 서버에 저장하지 않으며(무상태), 승인 제출(PROC-202)이 접근 컨텍스트(encX·encY·생년월일)를 본문으로 전달한다.
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | URL(accessAddressId·encX·encY) | 조회 요청(accessAddressId) | 경로 파라미터 추출, encX·encY 는 메모리 보유(요청 미포함) |
| 요청→도메인 | BE 컨트롤러 | accessAddressId | 활성 구성 참조 | FN-005 검증, config_code→활성 구성 조회 |
| ENT→도메인 | BE 리포지토리 | ENT-002 행 | ConsentItem[] | display_order 정렬·NULL(description·termsContent) 처리 |
| 응답→FE | FE 어댑터 | 동의 항목 DTO | Checkbox 모델 | 라벨·필수 표식 매핑, 약관 컨텐츠 있으면 [상세]→약관 모달 바인딩 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | 발송처 링크 진입·mount | (발송처 링크) | accessAddressId·encX·encY 수집(메모리) | 조회 요청 |
| 2 | BE | 요청 제한·입력 검증 | 조회 요청 | FN-014 + FN-005 | 검증된 accessAddressId |
| 3 | BE | 동의 항목 구성 | 검증된 accessAddressId | FN-008 활성 구성·소속 동의 항목 조회(무효 시 400 EX-SEC-004) | ConsentItem[] |
| 4 | FE | 항목 렌더 | ConsentItem[] | 생년월일 필드 + Checkbox 렌더·승인 버튼 조건 계산·약관 있으면 [상세]→약관 모달 | (UI 갱신) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| EX-OPS-001 | 진입·조회 분당 60회 초과 | 요청 거부, 감사 | 429 잠시 후 다시 시도해주세요. |
| EX-SEC-004 | 접근 주소 형식 위반·유효하지 않은 접근 주소 참조 | 진입 거부 | 400 요청이 올바르지 않습니다.(발송처 문의) |
| EX-SEC-005 | 본문 1MB 초과 | 요청 거부 | 413 요청이 너무 큽니다. |
| EX-FN-999 | 조회 오류 | 오류 응답, 감사 | 500 잠시 후 다시 시도해주세요. |

> 처리 상태(ENT-004)·연동이력(ENT-007) 저장은 본 PROC 에서 발생하지 않는다 — 복호화 성공 후 PROC-203 이 연동이력을 생성(내부 PROC-403)하고, 전달 결과 확정 시 PROC-401 이 처리 상태를 저장한다. `#214` 로 지정/미지정 구성 분기(구 BR-203)·지정 파라미터 값 누락(구 EX-BIZ-007)·요청 키값 컨텍스트 조회(구 EX-DATA-002)는 결번이다.

### 실행 결과

- **정상 결과**: 접근 주소 고유 ID 로 특정한 활성 구성의 동의 항목 목록 응답. 진입 상태 무저장(무상태 진입), 처리 상태·연동이력 영속화 없음.
- **실패 결과**: EX-OPS-001·EX-SEC-004(무효 접근 주소)·EX-SEC-005 엔벨로프. 무효 접근 주소는 발송처 링크 오류로 안내.
- **후속 트리거**: 없음(진입은 조회 완결). 사용자 생년월일 입력·동의/거부 제출 → PROC-202.

### 의존 프로세스

- **호출 관계**: 없음(FN 단위 로직만 호출). `#214` 로 진입 시 연동이력 생성(구 PROC-403 호출)은 폐기됐다.
- **선행 관계**: PROC-101(활성 접근 주소 구성 존재).
- **이벤트 관계**: 없음. 진입 후 사용자 승인 제출이 PROC-202 를 트리거하고, 승인 시 PROC-202 내부 PROC-203 이 복호화·연동이력 생성을 개시한다.

### 구현 가이드

- 진입은 접근 주소 고유 ID(config_code)로 활성 구성을 특정하고 별도 발송처 선택 UI 를 두지 않는다(BIZ-001-11, 접근 주소=발송처 판별). 진입 상태를 서버에 저장하지 않으며(무상태), encX·encY 는 FE 메모리에만 두고 화면·로그·URL 재기록을 금지한다(SEC-005-06·SEC-006-06).
- 동의 화면은 해당 구성에 설정된 동의 항목만 노출한다(구성 외 노출 금지). 동의 항목 조회 응답에 약관 컨텐츠(terms_content)를 포함하며, [상세] 버튼·약관 모달의 [동의]/[닫기]는 클라이언트(SCR-005) 전용으로 서버 호출을 추가하지 않는다(BIZ-002-05·EXC-BIZ-08).
- 생년월일은 FE 형식(6자리·월/일 범위)만 검증하고 값의 정오는 승인 후 서버 복호화 성공/실패로 귀결한다(AUTH-004-01). 생년월일·encX·encY 는 승인 제출 시 요청 **본문**으로 전달하며(PROC-202) URL 재노출을 금지한다.
- 요청 제한은 사용자 진입을 출발지 IP 기준으로 카운트한다. 접근 URL 의 정확한 파라미터 배치(경로/쿼리, encX·encY 쿼리 vs 본문, GET 파라미터 길이 한계 대응)는 build 확정 대상이다(EXC-SEC-08).
