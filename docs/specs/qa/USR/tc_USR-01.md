# 접근·동의·승인 테스트 케이스 정의 (USR-01)

## 개요

- **검증 목적**: 발송처 링크로 진입한 사용자가 접근 주소 고유 ID(=발송처 판별)로 특정된 활성 구성의 동의 항목만 보고, 본인확인용 생년월일을 입력하고 동의/거부·승인 게이팅이 정책대로 처리되는지 검증한다. `#214` 로 요청 키값(UUID) 발급·진입 컨텍스트 저장·진입 시 연동이력 생성이 폐기됐다 — 진입은 무상태이며, 승인 제출(`POST /api/interlock/approve`)이 접근 컨텍스트(encX·encY·생년월일)를 본문으로 전달한다. 복호화·수신처 전달 내부는 [tc_USR-02](tc_USR-02.md)(PROC-203)에서 다룬다.
- **관련 PRD 요구사항**: [`../../../prd/PRD.md`](../../../prd/PRD.md) §수행 범위 3 "사용자 — 접근·동의·승인 페이지: 발송처 링크로 진입, 생년월일 입력, 구성된 동의 항목 노출·동의 체크 후 연동 승인". 검증 대상 PROC-201·202(SVC-004).
- **공통 판정 기준**: [spec-qa.md §7](../spec-qa.md). 엔드포인트 진입 `/interlock/entry/:accessAddressId?encX=…&encY=…`·`GET /api/consent/:accessAddressId`(PROC-201)·`POST /api/interlock/approve`(PROC-202).
- **전 TC 공통 전제**: 시드 = 접근 주소 구성(활성·동의항목·약관 유/무)·encX/encY 생성 헬퍼(유효/무효 쌍)·mock 수신처 B(200/실패/타임아웃) [SQL·API]. 진입은 무상태(무저장).

---

### USR-01_001 발송처 링크 진입·동의 항목·생년월일 필드 표시
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-201 (GET /api/consent/:accessAddressId)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | 발송처 링크로 SCR-005 mount | `/interlock/entry/:accessAddressId?encX=…&encY=…` | accessAddressId·encX·encY 메모리 수집(화면 미표시) | F1 |
| 2 | GET /api/consent/:accessAddressId | accessAddressId(=config_code) | 200 `{ consentNotice(설정 시), items: ConsentItem[] }`(구성 소속만, display_order 정렬, termsContent 포함) — 동의 대상 설명 문구는 카드 상단(제목 아래) 노출·생년월일 입력 필드 렌더 | B1(FN-008) |

- **데이터 검증**: 해당 config_id 동의 항목만 노출(BIZ-002-01), 타 구성 항목 미포함. consentNotice 는 구성 consent_notice 값(설정 시 노출·미설정 NULL·미렌더, BIZ-002-08). 진입 상태 서버 무저장(무상태), 처리 상태(ENT-004)·연동이력(ENT-007) 미생성(복호화 이전). encX·encY·생년월일 화면 미렌더·미로깅(SEC-005-06·SEC-006-06).

### USR-01_002 유효하지 않은 접근 주소 진입
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-201 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/consent/:accessAddressId | 비활성·삭제·미존재 config_code | 400 EX-SEC-004(유효하지 않은 접근 주소 참조), Banner "연동 링크가 올바르지 않습니다. 발송처에 문의해주세요." | B1 |

- **비고**: 활성 구성만 특정(is_active=true·deleted_at IS NULL). 비활성 전환 연계는 ADM-02_007.

### USR-01_003 진입 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-201 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/consent/:accessAddressId | 출발지 IP 기준 분당 60회 이내 | 통과(경계 내) | B1(FN-014) |
| 2 | GET /api/consent/:accessAddressId | 61회째(60회 초과) | 429 EX-OPS-001, 감사 | B1 |

- **비고**: 임계치 60/분 기본안(BLK-06). 반복 재시도 남용의 1차 억제(SEC-008·EXC-AUTH-05).

### USR-01_004 진입 본문 1MB 초과
- **유형/우선순위/자동화**: Boundary · 보통 · 자동 | **PROC/분기**: PROC-201 / EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/consent/:accessAddressId | 요청 크기 1MB 초과 | 413 EX-SEC-005 | B1 |

### USR-01_005 진입 파라미터 형식 위반·주입 안전 처리
- **유형/우선순위/자동화**: Positive/Negative(보안) · 높음 · 자동 | **PROC/분기**: PROC-201 / SEC-004-01(b)·SEC-004-02
- **정책 근거**: SEC-004-01 (b) 파라미터 바인딩 단독 방어 확정(2026-07-09 담당자 결정, qa #54). 접근 주소 조회 키의 주입 문자는 바인딩으로 무실행하며(활성 구성 없으면 400), 전송 계층 형식·크기 검증은 유지한다.

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET /api/consent/:accessAddressId | accessAddressId 에 주입/스크립트 문자(형식·길이 정상) | 400 EX-SEC-004(일치 활성 구성 없음, 바인딩으로 원시 쿼리 미결합·테이블 무손상) | B1(SEC-004-02) |
| 2 | GET /api/consent/:accessAddressId | accessAddressId 형식 위반·길이 초과(전송 형식·크기) | 400 EX-SEC-004(형식·크기 검증 유지) | B1(FN-005) |

### USR-01_006 승인(AGREE)·복호화·전달 성공
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-202 / BR-201(AGREE)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 승인 제출 | 필수 항목 체크·생년월일·decision=AGREE·accessAddressId·encX·encY | FE 검증(생년월일 형식·필수 충족) 통과 | F1 |
| 2 | POST /api/interlock/approve | MDL-203+MDL-201 | 내부 PROC-203 복호화·전달 성공 → 200 `{result:'COMPLETED'}` | B3b |
| 3 | 결과 전이 | — | SCR-006 "연동이 완료되었습니다." | F2 |

- **데이터 검증**: 복호화 성공→연동이력 1건(ENT-007)·처리 상태 1건(ENT-004 is_success=true) 저장, 접근 컨텍스트 메모리 폐기. mock 수신처 B 가 복호화 원문 X 수신. 복호화·전달 내부 상세는 [tc_USR-02](tc_USR-02.md).

### USR-01_007 거부(REJECT)·정상 종료(레코드 미생성)
- **유형/우선순위/자동화**: Positive · 높음 · 자동 | **PROC/분기**: PROC-202 / BR-201(REJECT)·EXC-BIZ-03

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 거부 제출 | decision=REJECT·accessAddressId(복호화 요소 미포함) | 구성 매칭 검증 통과 | B2 |
| 2 | POST /api/interlock/approve | — | 200 `{result:'REJECTED'}`(EX 아님), CONSENT_REJECT 감사 | B3a |
| 3 | 결과 전이 | — | SCR-006 "연동이 취소되었습니다." | F2 |

- **데이터 검증**: 복호화 미수행 — 추적 키 없어 처리 상태(ENT-004)·연동이력(ENT-007) **미생성**(감사만, EXC-DATA-03·EXC-BIZ-11·BIZ-002-07). mock 수신처 B 미수신. 접근 컨텍스트 폐기.

### USR-01_008 필수 동의 미충족 승인 차단(집계 신뢰 서버 게이팅)
- **유형/우선순위/자동화**: Negative · 보통 · 반자동 | **PROC/분기**: PROC-202 / BIZ-002-06·BIZ-002-04
- **정책 근거**: 서버는 활성 구성·필수 항목 실재를 독립 재확인하고, 그 위에서 요청 집계값(requiredConsentMet)을 게이팅 조건으로 신뢰한다 — 동의 증빙 원장 미저장(BIZ-002-04)이라 항목별 체크 배열이 와이어 모델(MDL-203)에 없어 항목별 서버 재계산은 불가(`#239` 사양 긴장 = 집계 신뢰로 확정).

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | SCR-005 | 필수 동의 항목 미체크 | 승인 버튼 비활성(FE 1차 방어)·집계값 requiredConsentMet=false 파생 | F1 |
| 2 | POST /api/interlock/approve | decision=AGREE·requiredConsentMet=false(필수 미충족) | FN-008 서버 게이팅(집계 false) → approved:false → 200 `{result:'REJECTED'}`(복호화 미수행) | B2·B3a(BIZ-002-06) |

- **데이터 검증**: 서버가 accessAddressId 로 활성 구성·필수 항목 실재를 독립 재확인하고, 필수 항목이 실재하면 집계값(requiredConsentMet)을 신뢰해 게이팅한다(항목별 재계산 없음). requiredConsentMet=true 우회 제출 시 서버는 집계값을 신뢰해 승인 진행하므로(항목별 재검증 불가), 필수 미충족의 정탐은 집계값 false 로 표현된다. 미충족(집계 false)은 거부 처리(복호화·전달 미수행, 상태·이력 미생성).

### USR-01_009 유효하지 않은 접근 주소로 승인
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | AGREE, 비활성·미존재 accessAddressId | 400 EX-SEC-004(유효하지 않은 접근 주소 참조) | B3b |

### USR-01_010 승인 제출 형식 위반·주입
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-004

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | decision 비enum·accessAddressId 공란·주입 패턴 | 400 EX-SEC-004 | B1 |

- **비고**: encX·encY·birthDate 의 형식 정오(Base64URL·복호화 가능성)는 복호화 단계(EX-SEC-007/006)가 판정하고 본 단계는 NotBlank 만 검증.

### USR-01_011 승인 제출 본문 1MB 초과
- **유형/우선순위/자동화**: Boundary · 낮음 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-005

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | 본문 1MB 초과 | 413 EX-SEC-005 | B1 |

### USR-01_012 승인·재입력 요청 제한 초과
- **유형/우선순위/자동화**: Negative · 보통 · 자동 | **PROC/분기**: PROC-202 / EX-OPS-001

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | 인증 없는 진입 흐름, 분당 60회 초과 | 429 EX-OPS-001, 감사 | B1(FN-014) |

- **비고**: 복호화 실패 재입력의 반복도 요청 제한이 1차 억제(계정 잠금 아님, EXC-AUTH-05).

### USR-01_013 복호화 실패 재입력(생년월일 불일치)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-006(전파)·BR-204

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | AGREE, 유효 encX·encY + 틀린 생년월일 | 400 EX-SEC-006(내부 PROC-203 복호화 실패 전파) | B3b(PROC-203 BR-204) |
| 2 | 결과 전이 | — | **SCR-005 유지** + 생년월일 인라인 에러("사용자 정보가 일치하지 않습니다.", FE 형식 안내와 구분), 재입력·재제출 허용(하드 잠금 없음) | F2 |

- **데이터 검증**: 복호화 이전 실패 — 추적 키 없어 처리 상태·연동이력 미생성(감사만). 재제출은 동일 encX·encY 에 생년월일만 갱신(암호값 재수신 불요). 복호화 내부 상세는 [tc_USR-02_003](tc_USR-02.md).

### USR-01_014 링크 오류(암호 파라미터 형식)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-202 / EX-SEC-007(전파)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | AGREE, encX·encY **부재(필드 완전 누락)**·빈값 또는 Base64URL 형식 오류 | 400 EX-SEC-007(내부 PROC-203 전파) | B3b |
| 2 | 결과 전이 | — | SCR-006 링크 오류 안내(발송처 문의, **재입력 불가**) | F2 |

- **데이터 검증**: 복호화 미수행 — 처리 상태·연동이력 미생성(감사만). 복호화 실패(재입력 가능)와 구별(EXC-BIZ-13). **완전 누락도 EX-SEC-004 가 아닌 EX-SEC-007**(FN-020 단일 판정, 승인 DTO 선차단 없음 — `#238`).

### USR-01_015 링크 오류(추적 키 필드 누락·X 파싱 실패)
- **유형/우선순위/자동화**: Negative · 높음 · 자동 | **PROC/분기**: PROC-202 / EX-BIZ-008(전파)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | AGREE, 복호화된 X 파싱 실패 또는 연동 추적 키 필드 누락·공백 | 400 EX-BIZ-008(내부 PROC-203 전파) | B3b |
| 2 | 결과 전이 | — | SCR-006 링크 오류 안내(발송처 문의, 재입력 불가) | F2 |

- **데이터 검증**: 추적 키 확보 실패 — 처리 상태·연동이력 미생성(감사만). 복호화 내부 상세는 [tc_USR-02_005](tc_USR-02.md).

### USR-01_016 동의 후 수신처 B 전달 실패(502)
- **유형/우선순위/자동화**: 시스템예외 · 높음 · 자동 | **PROC/분기**: PROC-202 / EX-BIZ-004(전파)

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | POST /api/interlock/approve | AGREE, mock 수신처 B 실패(재시도 2회 후) | 502 EX-BIZ-004(내부 PROC-203 전파) | B3b |
| 2 | 결과 전이 | — | **SCR-005 유지** + 전달 실패 Banner("동의 처리에 실패했습니다. 다시 시도해주세요.") + 승인 재제출(재승인) 허용(SCR-006 이동 없음, `#215`) | F2 |

- **데이터 검증**: 복호화 성공 이후라 처리 상태 1건(is_success=false)·연동이력 1건이 **반드시 저장**됨(EXC-BIZ-06·EXC-BIZ-11). 상세는 [tc_USR-02_008](tc_USR-02.md).

### USR-01_017 진입·승인 처리 오류
- **유형/우선순위/자동화**: 시스템예외 · 보통 · 반자동 | **PROC/분기**: PROC-201·202 / EX-FN-999

| 단계 | 실행 | 입력 | 기대 결과 | 매핑 PROC |
|--|--|--|--|--|
| 1 | GET consent·POST approve (오류 주입) | — | 500 EX-FN-999 | B단계 전반 |

### USR-01_018 SCR-005 이용 동의 화면(생년월일·무노출·승인 게이팅)
- **유형/우선순위/자동화**: Positive(UI) · 높음 · 수동 | **PROC/분기**: PROC-201 / AUTH-004-01·BIZ-002-01·06

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| 동의 대상 설명 문구 | SCR-005 | 구성 consentNotice 설정/미설정 | 설정 시 제목 아래 상단 안내 문구 노출, 미설정 시 생략(BIZ-002-08) |
| 본인확인 필드 | SCR-005 | 생년월일 TextField(6자리 numeric·YYMMDD) | 형식(월/일 범위) 검증·값 미에코·미로깅(AUTH-004-03) |
| 항목 노출 | SCR-005 | 구성 소속 동의 항목 | 라벨·설명·필수 표식(*)만, 구성 외 미노출(BIZ-002-01) |
| 무노출 | SCR-005 | encX·encY·생년월일·회원 키·추적 키 | 화면 미표시(경로/메모리만, 복호화 이전 추적 키 부재) |
| 승인 버튼 활성 | SCR-005 | 생년월일 형식 유효 AND 필수 항목 전체 체크 | 승인 버튼 활성(AUTH-004-01·BIZ-002-06) |
| 레이아웃 | SCR-005 | 중앙 Card 최대 480px | mobile 좌우 16px·버튼 세로 스택 |
| 접근성 | SCR-005 | Banner role=alert·aria-live·약관 모달 포커스 트랩·ESC | 오류·모달 스크린리더 대응 |

### USR-01_019 약관 [상세] 모달 노출·[동의]/[닫기] 동작
- **유형/우선순위/자동화**: Positive(UI) · 높음 · 수동 | **PROC/분기**: PROC-201 / BIZ-002-05·EXC-BIZ-08

| 검증 항목 | 화면(SCR) | 검증 내용 | 기대 결과 |
|--|--|--|--|
| [상세] 노출 | SCR-005 | 약관 컨텐츠 있는 항목 | 라벨 우측 [상세] 버튼 노출·클릭 시 약관 상세 Modal(제목=라벨, 본문 스크롤) |
| [상세] 미노출 | SCR-005 | 약관 컨텐츠 없는(null) 항목 | [상세] 버튼 미렌더(BIZ-002-05, tc_ADM-01_015 정합) |
| 모달 [동의] | SCR-005 | 약관 모달에서 [동의] 클릭 | 해당 항목 체크(동의)·모달 닫힘·서버 호출 없음·승인 버튼 활성 재계산(EXC-BIZ-08) |
| 모달 [닫기] | SCR-005 | 약관 모달에서 [닫기] 클릭 | 모달만 닫힘, 항목 체크 상태 불변(EXC-BIZ-08) |
