# 연동 구성 조회·목록·상세 기능 정의

## 개요

- **정의 대상**: 연동 관리자가 등록된 연동 구성을 목록(MDL-102 요약)·상세(MDL-101 전체)로 조회하는 read-only 프로세스. 활성 전환·삭제는 단일 책임 분리로 PROC-105·PROC-106 이 담당한다.
- **관련 PRD 요구사항**: [`../../prd/PRD.md`](../../prd/PRD.md) §성과 지표 "활성 연동 구성 수" / §수행 범위 "관리자 — 연동 구성 관리".

---

## PROC-102 연동 구성 조회·목록·상세

### 기본 정보

| 항목 | 내용 |
|------|------|
| 프로세스명 | 연동 구성 조회·목록·상세 |
| 분류 | RR |
| 그룹 | 관리자 / 연동 구성 관리 |
| 트리거 유형 | 화면 이벤트(SCR-002·004 mount, SCR-003 편집 mount) |
| 처리 방식 | 동기 |
| 우선순위 | 높음 |
| 관련 IA 항목 | ADM-02 |

### 관련 사양 코드

| 구분 | 코드 | 관계 설명 |
|------|------|----------|
| 서비스(SVC) | SVC-002 | 조회·목록·상세(read-only) |
| 정책(policy) | SEC-001·AUTH-001/002·SEC-004·SEC-005 | IP·세션·조회 조건 검증·설정 데이터 노출 |
| 공통 기능(FN) | FN-003(세션)·FN-005(조회 조건 검증)·FN-010(응답 선별)·FN-015(엔벨로프) | 호출 단위 로직 |
| 데이터 모델(MDL) | MDL-102(목록 요약)·MDL-101(상세) | 응답 모델 |
| DB 엔터티(ENT) | ENT-001·ENT-002·ENT-003 | 조회 대상 |
| 화면(SCR) | SCR-002·SCR-004·SCR-003(편집 프리필) | 트리거 화면 |

### 진입점 및 진입 조건

- **진입점**: `GET /api/admin/configs`(목록) · `GET /api/admin/configs/:id`(상세). SCR-002·004 mount, SCR-003 편집 진입 mount.
- **진입 조건**: PROC-104 IP 게이트 통과 + FN-003 유효 세션.
- **사전 검증**: 조회 조건(검색어·활성 필터) 허용 문자·길이 재검증(FN-005). 상세는 id UUID 형식.

### 입력/출력 정의

| 구분 | 항목명 | 데이터 타입 | 필수 | 설명 |
|------|--------|------------|------|------|
| 입력 | filter | { keyword?, active? } | N | 목록 조회 조건(활성 필터·검색) |
| 입력 | id | string(UUID) | N | 상세 조회 대상 |
| 출력 | list | MDL-102[] | - | 목록 요약(활성·생성일 정렬) |
| 출력 | detail | MDL-101 | - | 상세(자식 포함) |

### 연관 데이터 및 외부 호출

- **호출 API**: 외부 호출 없음.
- **데이터 조회 대상**: ENT-001(목록·상세), ENT-002·ENT-003(상세 자식), ENT-002 COUNT(목록 요약).
- **데이터 변경 대상(CRUD)**: 없음(read-only). 감사 미기록(조회는 OPS-002 대상 아님).

### 실행 제약사항

- **트랜잭션 경계**: 없음(단순 SELECT, 자동 커밋). 락 미사용.
- **동시성 제어**: 조회 전용으로 경합 없음. 삭제된 구성(deleted_at)은 목록·상세 모두 제외.
- **성능 요구**: IX_CONFIG_LIST(is_active, created_at DESC) 부분 인덱스 활용. 페이지네이션 규약은 build 확정(MVP 활성 필터·생성일 정렬 기본).
- **보안 요구**: IP+세션. 응답은 설정 데이터만(회원 키·처리 상태 배제). 서비스 A/B URL 은 마스킹 예외(EXC-SEC-05).

### 로직 실행 순서

#### FE 측 처리 (의사코드)

```
F1. 목록 mount → 조회 조건 → 요청   (SCR-002)
  진입 트리거: SCR-002 페이지 mount / 검색·활성 필터 변경
  사용 상태/폼: filter = { keyword:'', active:'ALL' }, listQuery(캐시 키 ["admin","configs","list",filter])
  검증 로직: if (len(keyword) > 100) → "검색어가 너무 깁니다." (서버 재검증 전제)
  요청 DTO 변환: query = { keyword: trim(filter.keyword)||undefined,
                          active: filter.active=='ALL'?undefined:(filter.active=='ACTIVE') }
  호출 수단: query → GET /api/admin/configs?keyword=&active=
  진행 중 UI: Initial/Loading — Skeleton 행 3개

F2. 목록 응답 → 렌더
  onSuccess(res→{ data: MDL-102[] }):
    if (data.length==0) → EmptyState("등록된 연동 구성이 없습니다" + 등록 CTA)
    else → Table 렌더(구성 코드·구성명·활성 Badge·동의 항목 수·생성 일시)
           createdAt: ISO8601 → 지역 일시 포맷
  onError(err):
    if (err.code=='EX-AUTH-002') → redirect SCR-001(?expired=1)
    else → Banner(error) + 재시도 버튼

F3. 상세 mount → 요청 → 렌더   (SCR-004 / SCR-003 편집)
  진입 트리거: SCR-004 mount(/admin/configs/:id) 또는 SCR-003 편집 mount(:id/edit)
  호출 수단: query → GET /api/admin/configs/:id (캐시 키 ["admin","configs",id])
  onSuccess(res→{ data: MDL-101 }):
    SCR-004 → Card 렌더(기본 정보·A/B 주소·파라미터·동의 항목 테이블)
    SCR-003 편집 → 폼 프리필(consentItems·parameters 반복 행 매핑)
  onError: 대상 없음(빈 결과) → "대상 구성을 찾을 수 없습니다" + 목록 이동 / 4xx·5xx → Banner
  정책 적용 지점: 서비스 A/B URL 마스킹 없음(EXC-SEC-05), 회원 키·상태 미표시
```

#### BE 측 처리 (의사코드)

```
B1. 진입 가드 → 인증 → 조회 조건 검증
  엔드포인트: GET /api/admin/configs | GET /api/admin/configs/:id
  인증·인가: (선행) PROC-104 IP 게이트 → FN-003_verifySession(cookie.sessionId, now)
             실패 → 401 EX-AUTH-001 / 유휴 만료 401 EX-AUTH-002
  입력 검증: FN-005_validateInput(query|params, schema, rawSize)
             허용 문자·길이 위반 → 400 EX-SEC-004

B2. 목록 조회 (GET /api/admin/configs)
  SELECT c.id, c.config_code, c.config_name, c.is_active, c.created_at,
         (SELECT COUNT(*) FROM TBL_INTERLOCK_CONSENT_ITEM ci WHERE ci.config_id = c.id)
             AS consent_item_count
  FROM TBL_INTERLOCK_CONFIG c
  WHERE c.deleted_at IS NULL
    AND (:active IS NULL OR c.is_active = :active)
    AND (:keyword IS NULL OR c.config_code LIKE :kw OR c.config_name LIKE :kw)  -- :kw='%'+keyword+'%'
  ORDER BY c.created_at DESC;                                     -- IX_CONFIG_LIST
  -- 페이지네이션(LIMIT/OFFSET) 규약은 build 확정
  → rows → MDL-102[]

B3. 상세 조회 (GET /api/admin/configs/:id)
  SELECT id, config_code, config_name, service_a_entry_url, service_b_delivery_url,
         service_b_http_method, is_active, created_at
  FROM TBL_INTERLOCK_CONFIG WHERE id = :id AND deleted_at IS NULL;
  if (row is null) → 200 { data: null } (대상 없음, 오류 아님)
  items = SELECT item_label, item_description, is_required, display_order
          FROM TBL_INTERLOCK_CONSENT_ITEM WHERE config_id=:id ORDER BY display_order;   -- IX_CONSENT_CONFIG
  params = SELECT param_name, source_key_a, deliver_to_b, is_required, display_order
           FROM TBL_INTERLOCK_PARAMETER WHERE config_id=:id ORDER BY display_order;      -- IX_PARAM_CONFIG
  → MDL-101 (자식 포함)

B4. 응답 변환
  응답 DTO: FN-015_ok(list | detail)
  FN-010_selectStatusResponse 미적용(설정 데이터). 서비스 A/B URL 마스킹 제외(EXC-SEC-05)
  정책 적용 지점: SEC-005(설정 데이터 노출·개인정보 미포함)
```

#### 데이터 변환 흐름

| 변환 지점 | 변환 위치 | 입력 형태 | 출력 형태 | 변환 규칙 |
|----------|----------|----------|----------|-----------|
| FE→요청 | FE 어댑터 | filter state | query string | 트림·enum→boolean·undefined 생략 |
| ENT→도메인 | BE 리포지토리 | ENT-001(+COUNT) 행 | 도메인/요약 | 자식 카운트 집계·NULL 처리 |
| 도메인→응답 | BE 컨트롤러 | 도메인 모델 | MDL-102 / MDL-101 | 필드 선별(목록=요약), createdAt ISO8601 |
| 응답→FE | FE 어댑터 | MDL-102/101 DTO | Table/Card 모델 | 날짜 지역 포맷·관계 평탄화 |

#### 단계 통합 흐름

| # | 레이어 | 단계명 | 직전 단계 출력 | 본 단계 처리 요지 | 다음 단계 입력 |
|---|--------|--------|--------------|----------------|---------------|
| 1 | FE | mount·조회 조건 | (화면 진입) | 조건 정규화·query 요청 | query string |
| 2 | BE | 게이트·인증·검증 | query | PROC-104 + FN-003 + FN-005 | 검증된 조건 |
| 3 | BE | 목록/상세 조회 | 검증된 조건 | ENT-001(+자식) SELECT(deleted_at IS NULL) | 조회 결과 |
| 4 | BE | 응답 변환 | 조회 결과 | MDL-102/101 직렬화(설정 데이터) | 응답 DTO |
| 5 | FE | 응답 처리 | 응답 DTO | Table/Card 렌더·Empty/Error 분기 | (UI 갱신) |

### 분기 및 예외 흐름

| 코드 | 발생 조건 | 처리 방향 | 결과 |
|------|----------|----------|------|
| (분기) 목록 0건 | 조회 결과 없음 | EmptyState 표시 | 200 빈 배열 |
| (분기) 상세 대상 없음 | id 부재·이미 삭제됨 | 오류 아닌 "대상 없음" | 200 data:null |
| EX-AUTH-001 | 미인증 세션 | 진입 차단, 로그인 유도 | 401 로그인이 필요합니다. |
| EX-AUTH-002 | 세션 유휴 30분 초과 | 세션 만료, 재인증 유도 | 401 다시 로그인해주세요. |
| EX-SEC-004 | 조회 조건 허용 문자 위반·주입 | 조회 거부 | 400 입력 형식이 올바르지 않습니다. |
| EX-FN-999 | 조회 오류 | 감사 없이 오류 응답 | 500 잠시 후 다시 시도해주세요. |

> IP 차단(EX-SEC-001)은 선행 PROC-104 게이트에서 처리된다. 활성 전환·삭제는 본 PROC 범위가 아니다(PROC-105·PROC-106).

### 실행 결과

- **정상 결과**: MDL-102[] 목록 또는 MDL-101 상세 응답. 데이터 변경·감사 없음.
- **실패 결과**: EX-AUTH-001/002·EX-SEC-004·EX-FN-999 엔벨로프. 대상 없음은 200 data:null.
- **후속 트리거**: 없음. SCR-004 에서 활성 전환(PROC-105)·삭제(PROC-106)·편집(PROC-101) 로 이어질 수 있음(별도 트리거).

### 의존 프로세스

- **호출 관계**: 없음.
- **선행 관계**: PROC-104·PROC-103(세션)·PROC-101(조회 대상 데이터 존재).
- **이벤트 관계**: 없음.

### 구현 가이드

- 조회 응답 DTO 에는 설정 데이터만 담고 회원 키·처리 상태 필드를 두지 않는다. 목록은 요약(MDL-102), 상세는 전체(MDL-101)로 분리한다.
- deleted_at IS NULL 필터를 목록·상세 모두 강제한다. 상세 대상 없음은 오류가 아닌 "대상 없음"으로 처리한다.
- 페이지네이션·정렬·필터 파라미터 규약은 FN-015 엔벨로프 확정과 함께 build 에서 확정한다.
