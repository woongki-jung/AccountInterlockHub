# 서비스 데이터 모델 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 의 서비스 데이터 모델(MDL) 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 3순위)이며, 선행 서비스 정의 [`../services/spec-services.md`](../services/spec-services.md) 의 MDL 후보를 확정한 결과다. DB 엔터티(ENT)는 [`spec-datas.md`](spec-datas.md) 가 관리한다.

## 데이터 모델 설계 원칙

- **ENT/MDL 책임 분리**: ENT 는 DB 영속 구조, MDL 은 응용 계층 모델(요청·응답·도메인·외부 DTO). 회원 키 등 무저장 값은 MDL(EXT)에만 존재하고 ENT 매핑이 없다.
- **분류 체계(COM/SVC/EXT)**: 공통(2+ 서비스 공유) / 서비스(단일 서비스) / 외부 연동(외부 시스템 I/O). EXT 는 외부 I/O 성격을 우선 분류한다.
- **명명**: MDL 속성은 camelCase, ENT 컬럼은 snake_case. 엔터티 매핑 표가 변환 지점(6 지점)과 함께 양자를 잇는다.
- **마스킹 필수**: 회원 키·인증 자격을 담는 모델은 마스킹 규칙(SEC-005)을 명시한다.

## 모델 코드 체계·대역

- 코드: `MDL-nnn`. 대역: 1xx 관리자 · 2xx 사용자 연동 · 3xx API/상태 · 4xx 배치/공통.
- 변환 지점 6 지점: FE→요청 / 요청→도메인 / 도메인→ENT / ENT→도메인 / 도메인→응답 / 응답→FE(PROC 데이터 변환 흐름과 1:1 정합).

## 모델 분류·목록 (하위 문서와 1:1)

| MDL 코드 | 모델명 | 분류 | 매핑 ENT | 사용 SVC | 용도 | 하위 문서 |
|----------|--------|------|----------|----------|------|-----------|
| MDL-101 | 연동 구성 | COM | ENT-001·002·003 | SVC-001, SVC-002 | 도메인/요청·응답 | [model_admin.md](model_admin.md) |
| MDL-102 | 연동 구성 목록/요약 | SVC | ENT-001 | SVC-002 | 응답(목록) | [model_admin.md](model_admin.md) |
| MDL-103 | 관리자 계정 | SVC | ENT-005 | SVC-003 | 도메인(인증) | [model_admin.md](model_admin.md) |
| MDL-104 | 관리자 세션 | SVC | 없음(앱 세션) | SVC-003 | 도메인/인프라 | [model_admin.md](model_admin.md) |
| MDL-201 | 진입 요청 | EXT | 없음(전송 전용) | SVC-004, SVC-005 | 인바운드 DTO | [model_user.md](model_user.md) |
| MDL-202 | 요청 키값 | COM | ENT-004(request_key) | SVC-004, SVC-006 | 식별자/요청·응답 | [model_user.md](model_user.md) |
| MDL-203 | 동의 결과 | SVC | 없음(증빙 미저장) | SVC-004 | 요청 | [model_user.md](model_user.md) |
| MDL-204 | 서비스 B 전달 페이로드 | EXT | 없음(전송 전용) | SVC-005, SVC-009(회신 값 출처) | 아웃바운드 DTO | [model_user.md](model_user.md) |
| MDL-301 | 처리 상태 | COM | ENT-004 | SVC-005, SVC-006, SVC-007 | 도메인 | [model_api.md](model_api.md) |
| MDL-302 | 처리상태 조회 응답 | SVC | ENT-004(4항목) | SVC-006 | 응답 | [model_api.md](model_api.md) |
| MDL-303 | 연동이력 | COM | ENT-007 | SVC-004, SVC-007, SVC-008, SVC-009 | 도메인 | [model_api.md](model_api.md) |
| MDL-304 | 완료 확인 응답 | SVC | ENT-007(판정 항목) | SVC-008 | 응답 | [model_api.md](model_api.md) |
| MDL-305 | 완료 콜백 요청 | EXT | ENT-001·ENT-007(조건 참조) | SVC-009 | 인바운드 DTO | [model_api.md](model_api.md) |
| MDL-401 | 감사 로그 항목 | COM | ENT-006 | 전 SVC | 도메인(기록) | [model_common.md](model_common.md) |
| MDL-402 | 배치 실행 결과 | SVC | 없음(감사 요약) | SVC-007 | 결과 | [model_api.md](model_api.md) |

- **공통 모델(COM)**: MDL-101(구성)·MDL-202(요청 키값)·MDL-301(처리 상태)·MDL-303(연동이력)·MDL-401(감사 로그) — 2개 이상 서비스 공유.
- **외부 연동(EXT)**: MDL-201(인바운드)·MDL-204(아웃바운드)·MDL-305(인바운드 콜백) — 외부 I/O 성격 우선. MDL-201·204 는 회원 키 전송 전용(ENT 매핑 없음), MDL-305 의 키값은 조회 조건 전용(신규 저장 없음).
- **파일 그룹화**: 영역별(admin/user/api·batch/common) 4파일. 분류(COM/SVC/EXT)는 모델별 속성이며 파일 배치와 독립이다.

## MDL 후보 대비 확정/변경 사항

서비스 정의서 §MDL 후보 목록 대비 확정 결과다.

| MDL | 후보 대비 | 확정/변경 내용 |
|-----|-----------|----------------|
| **MDL-101** | **변경** | 중첩 Parameter 에 **isUserKey(사용자 키값 파라미터 지정, 선택)** 추가 — true 구성당 최대 1개(BIZ-001-07), 영속화는 ENT-001.user_key_param_id 참조 저장. MDL-102~104 는 유지 |
| MDL-201 | 확정 | 진입 요청. EXT·무저장, memberKey ENT 매핑 없음 명시. 지정 구성은 지정 파라미터 값 필수 검증(BIZ-004-02) 추가 |
| MDL-202 | 확정 | 요청 키값 UUID v4. ENT-004.request_key 매핑 |
| MDL-203 | 확정 | 동의 결과. 증빙 원장 미저장(Q3), is_success 로만 반영 |
| **MDL-204** | **변경** | 전달 페이로드. EXT·무저장·무변형 유지 + **configCode·requestKey 동봉**(완료 콜백 회신 계약 — SVC-005 F-003, 지정·미지정 공통) |
| **MDL-301** | **변경** | 후보 5항목에 **configId(구성 참조)** 속성 추가 — ENT-004 config_id 정합(§담당자 확정 대기). 조회 응답(MDL-302)에서는 configId 제외 |
| MDL-302 | 확정 | 조회 응답. 상태 4항목 + 요청 키값 에코, 회원 키·configId 미포함(SEC-005-02) |
| **MDL-303** | **확정(신설)** | 연동이력 도메인 모델 — ENT-007 매핑, 항목 6종 상한(DATA-005-01), userKey 로그 마스킹·응답 배제 |
| **MDL-304** | **확정(신설)** | 완료 확인 응답 — 완료 판정 항목 3개만(isCompleted·callbackReceivedAt·requestedAt, SEC-005-03) |
| **MDL-305** | **확정(신설)** | 완료 콜백 요청 — configCode·userKey 2항목(요청 키값은 계약 필수 아님, BIZ-004-03 스코프 단일화) |
| MDL-401 | 확정 | 감사 로그. 개인정보 배제·마스킹 |
| **MDL-402** | **변경** | 배치 결과. 대상·삭제 건수를 **처리상태·연동이력 각각 집계**(SVC-007 F-005·OPS-003). 별도 저장 없이 감사 로그 detail 로 기록 유지 |

## ENT ↔ MDL 매핑 정합 요약

| ENT | MDL(도메인) | MDL(응답/DTO) | 무매핑 MDL 관계 |
|-----|-------------|----------------|------------------|
| ENT-001 | MDL-101 | MDL-102 | MDL-204.targetUrl·httpMethod·configCode 참조, MDL-305.configCode 조건 참조 |
| ENT-002·003 | MDL-101(중첩 — isUserKey 지정 포함) | - | MDL-201·204 파라미터 정의 참조 |
| ENT-004 | MDL-301 | MDL-302 | MDL-202·203 이 request_key·is_success 로 유입 |
| ENT-005 | MDL-103 | - | MDL-104 는 앱 세션(무매핑) |
| ENT-006 | MDL-401 | - | MDL-402 요약(처리상태·연동이력 각각 집계)이 detail 로 유입 |
| ENT-007 | MDL-303 | MDL-304(판정 항목만) | MDL-201 지정 파라미터 값이 user_key 로 유입, MDL-305.userKey 는 조건 참조(저장 유입 없음) |
| (없음) | MDL-201·204 | - | 회원 키 전송 전용(무저장) |

- 깨진 참조 0건 — 모든 MDL 이 ENT 매핑 또는 명시적 무매핑(전송 전용·앱 세션·조건 참조)으로 정의됨. 사용 PROC 는 예약 채번(교차검증 시 실재 확인 — 신규 PROC-302·303·403 포함).

## 담당자 확정 대기·보류

- **MDL-301 configId 추가**: ENT-004 정합을 위해 도메인 모델에 configId 를 포함했다. 정책과의 정합은 [`policy_DATA.md`](../policies/policy_DATA.md) **EXC-DATA-06**(비개인 운영 컬럼 config_id·created_at 저장 명시 허용)으로 반영 완료 — 추가 리비전 대기 없음.
- **MDL-203 동의 증빙(Q3)**: 증빙 원장 미저장은 확정 기본안. 증빙 요건 확정 시 DATA 정책·MDL-203·ENT 를 함께 리비전.
- **MDL-104 세션 저장소**: 애플리케이션 세션 저장 수단(단일/공유)은 build 단계 확정.
- **MDL-201/204 회원 키 마스킹 규칙**: 앞2·뒤2 노출(SEC-005-01)은 기본안. 로그 정책 세부는 build 단계 확정.
- **MDL-303/305 userKey 원문(Q5, `accountinterlockhub#33`)**: 원문 저장·조회 조건 사용(DATA-005-03·EXC-DATA-09)과 MaxLength(512) 상한은 확정 기본안 — 담당자 회신 시 ENT-007 과 함께 리비전. 통계 목적 장기 보관이 확정되면 MDL-402 집계 항목도 재검토.
