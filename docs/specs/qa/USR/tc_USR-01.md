# 이용 동의 테스트 케이스 정의 (USR-01)

## 개요

- **검증 목적**: 서비스 A 진입 시 불투명 요청 키값(UUID v4) 발급·회원 키 무저장, 구성 소속 동의 항목만 노출, 동의(AGREE)→서비스 B 전달·거부(REJECT)→미전달 상태 저장이 정책대로 처리되는지 검증한다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 "사용자 — 이용 동의 페이지" · §데이터 원칙(무저장·요청 키값). 검증 대상 PROC-201·202(SVC-004).
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md). 엔드포인트 `GET /interlock/entry`·`GET/POST /api/consent/:requestKey`.
- **전 TC 공통 전제**: 시드 = 연동 구성(활성·동의항목·파라미터)·서비스 A 진입 목·서비스 B 목 [SQL·API]. 요청 키값 발급은 PROC-201.

---

### USR-01_001 서비스 A 진입·요청 키값 발급
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-201 (GET /interlock/entry)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /interlock/entry | MDL-201(configCode·memberKey·parameters) | 활성 구성 확인 | B1a |
| 2 | 요청 키값 발급 | — | 200 {requestKey: UUID v4}, 컨텍스트 메모리 저장 | B1a(FN-007) |

- **데이터 검증**: requestKey 는 UUID v4·역추적 불가(DATA-002-02). 어떤 테이블에도 회원 키·requestKey 영속 저장 없음(무저장). ENT-004 미생성.

### USR-01_002 동의 항목 조회(구성 소속만)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-201 (GET /api/consent/:requestKey)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 mount | requestKey | GET 요청 | F1 |
| 2 | GET /api/consent/:requestKey | — | 200 ConsentItem[](구성 소속만, display_order 정렬, 각 항목 termsContent 포함) | B1b(FN-008) |

- **데이터 검증**: 해당 config_id 동의 항목만 노출(BIZ-002-01), 타 구성 항목 미포함. 약관 컨텐츠가 있는 항목은 응답 termsContent 에 본문 포함, 없는 항목은 null(BIZ-002-05).

### USR-01_003 유효하지 않은 구성 참조 진입
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-201 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /interlock/entry | 비활성·삭제·미존재 config_code | 400 EX-SEC-004(유효하지 않은 구성 참조) | B1a |

### USR-01_004 요청 키값 미존재·컨텍스트 만료
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-201 / EX-DATA-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/consent/:requestKey | 만료·미발급 requestKey | 400 EX-DATA-002, Banner "요청이 올바르지 않습니다." | B1b |

### USR-01_005 진입 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-201 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /interlock/entry | 출발지 IP 기준 분당 60회 이내 | 통과(경계 내) | B1a(FN-014) |
| 2 | GET /interlock/entry | 61회째(60회 초과) | 429 EX-OPS-001, 감사 | B1a |

- **비고**: 임계치 60/분 기본안(BLK-06).

### USR-01_006 진입 본문 1MB 초과
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-201 / EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /interlock/entry | 본문 1MB 초과 | 413 EX-SEC-005 | B1a |

### USR-01_007 진입 파라미터 형식·주입 위반(전송 검증 유지)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-201 / EX-SEC-004
- **정책 근거**: 신뢰 위임(SEC-002)이어도 전송 계층 검증은 면제하지 않는다(EXC-SEC-02).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /interlock/entry | 파라미터 주입 패턴·형식 위반 | 400 EX-SEC-004 | B1a(FN-005) |

### USR-01_008 동의(AGREE) 제출·전달·저장
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-202 / BR-201(AGREE)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 동의 제출 | 필수 항목 체크·decision=AGREE·configCode | 컨텍스트·구성 매칭 검증 | F1·B2 |
| 2 | POST /api/consent/:requestKey | — | 내부 PROC-203 전달 성공 → 200 {success:true} | B3b |
| 3 | 결과 전이 | — | SCR-006 "연동이 완료되었습니다." | F2 |

- **데이터 검증**: ENT-004 상태 1건(is_success=1) 저장(PROC-401), 컨텍스트 폐기(회원 키 무저장). 서비스 B 목 수신 확인.

### USR-01_009 거부(REJECT) 제출·정상 종료
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-202 / BR-201(REJECT)·EXC-BIZ-03

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 거부 제출 | decision=REJECT·configCode | 컨텍스트 검증 통과 | B2 |
| 2 | POST /api/consent/:requestKey | — | 200 정상 종료(EX 아님), CONSENT_REJECT 감사 | B3a |
| 3 | 결과 전이 | — | SCR-006 "연동이 취소되었습니다." | F2 |

- **데이터 검증**: ENT-004 상태 1건(is_success=0·미전달) 저장, 서비스 B 미전달, 컨텍스트 폐기.

### USR-01_010 구성 매칭 불일치
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-202 / EX-DATA-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/consent/:requestKey | configCode ≠ ctx.configCode | 400 EX-DATA-002 | B2 (매칭 근거 검증) |

### USR-01_011 컨텍스트 폐기 후 재제출
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-202 / EX-DATA-002

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/consent/:requestKey | 처리 완료된 requestKey 재제출 | 400 EX-DATA-002(재제출 방지) | B2 |

### USR-01_012 동의 후 서비스 B 전달 실패(502)
- **유형/우선순위/자동화**: 시스템예외 · 높음 · 자동 | **PROC/분기**: PROC-202 / EX-BIZ-004(전파)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/consent/:requestKey | AGREE, 서비스 B 목 실패 | 502 EX-BIZ-004(상태 1건 저장됨) | B3b(PROC-203 전파) |
| 2 | 결과 전이 | — | SCR-006 전달실패 안내 | F2 |

- **데이터 검증**: ENT-004 상태 1건(is_success=0) 저장(EXC-BIZ-06). 상세는 [tc_USR-02](tc_USR-02.md).

### USR-01_013 동의 제출 본문 1MB 초과
- **유형/우선순위/자동화**: Boundary · 낮음 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/consent/:requestKey | 본문 1MB 초과 | 413 EX-SEC-005 | B1 |

### USR-01_014 동의 제출 형식 위반·주입
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/consent/:requestKey | decision 비enum·requestKey 비UUID·주입 | 400 EX-SEC-004 | B1 |

### USR-01_015 필수 항목 미체크 서버 재검증
- **유형/우선순위/자동화**: Negative · 보통 · 반자동 | **PROC/분기**: PROC-202 / BIZ-002-02

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 | 필수 동의 항목 미체크 | 동의 버튼 비활성(FE 1차 방어) | F1 |
| 2 | POST(우회 시도) | 필수 미충족 제출 | 서버 검증으로 진행 차단 | B2·B3(BIZ-002-02) |

### USR-01_016 컨텍스트 저장·UUID 생성 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-201·202 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /interlock/entry·POST consent (오류 주입) | — | 500 EX-FN-999 | B단계 전반 |

### USR-01_017 SCR-005 동의 화면(무노출·무저장)
- **유형/우선순위/자동화**: Positive(UI) · 높음 · 수동 | **PROC/분기**: PROC-201 / DATA-001·BIZ-002-01

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| 항목 노출 | SCR-005 | 구성 소속 동의 항목 | 라벨·설명·필수 표식(*)만, 구성 외 미노출 |
| 무노출 | SCR-005 | 회원 키·요청 키값 | 화면 미표시(경로 컨텍스트만) |
| 레이아웃 | SCR-005 | 중앙 Card 최대 480px | mobile 좌우 16px·버튼 세로 스택 |
| 버튼 활성 | SCR-005 | 필수 항목 전체 체크 시 | 동의 버튼 활성(BIZ-002-02) |
| [상세] 노출 | SCR-005 | 약관 컨텐츠가 있는 항목 | 라벨 우측 [상세] 버튼 노출(BIZ-002-05) |
| 접근성 | SCR-005 | Banner role=alert·aria-live·약관 모달 포커스 트랩·ESC | 오류·모달 스크린리더 대응 |

### USR-01_018 약관 [상세] 모달 노출·본문 표시
- **유형/우선순위/자동화**: Positive(UI) · 높음 · 수동 | **PROC/분기**: PROC-201 / BIZ-002-05

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| [상세] 클릭 | SCR-005 | 약관 컨텐츠 있는 항목의 [상세] 클릭 | 약관 상세 Modal 열림(제목=항목 라벨, 본문=약관 컨텐츠, 본문 스크롤) |
| 모달 구성 | SCR-005 | 모달 하단 액션 | [동의](primary)·[닫기](secondary) 노출, 배경 스크림·ESC·배경 클릭 닫기 |

### USR-01_019 약관 모달 [동의]→항목 동의 처리
- **유형/우선순위/자동화**: Positive(UI) · 높음 · 수동 | **PROC/분기**: PROC-201 / EXC-BIZ-08

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| 모달 [동의] | SCR-005 | 약관 모달에서 [동의] 클릭 | 해당 항목 체크(동의)됨 + 모달 닫힘, 서버 호출 없음 |
| 버튼 재계산 | SCR-005 | 필수 항목을 모달 [동의]로 충족 | 동의 버튼 활성 재계산(BIZ-002-02) |

### USR-01_020 약관 미설정 [상세] 미노출 · 모달 [닫기] 체크 불변
- **유형/우선순위/자동화**: Negative(UI) · 보통 · 수동 | **PROC/분기**: PROC-201 / BIZ-002-05·EXC-BIZ-08

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| [상세] 미노출 | SCR-005 | 약관 컨텐츠 없는(null) 항목 | [상세] 버튼 미렌더(BIZ-002-05) |
| 모달 [닫기] | SCR-005 | 약관 모달에서 [닫기] 클릭 | 모달만 닫힘, 항목 체크 상태 불변(EXC-BIZ-08) |
