# 서비스 데이터 모델 정의서 — AccountInterlockHub

본 문서는 AccountInterlockHub 의 서비스 데이터 모델(MDL) 개요와 하위 문서 목록을 정의한다. spec 단계 산출물(도메인 3순위)이며, 선행 서비스 정의 [`../services/spec-services.md`](../services/spec-services.md) 의 MDL 후보를 확정한 결과다. DB 엔터티(ENT)는 [`spec-datas.md`](spec-datas.md) 가 관리한다.

> **2026-07-11 `#214` 개정**: 단일 암호화 JSON(encX/encY)·허브 복호화·서버-서버 전달·**연동 추적 키** 기반 추적으로 재정의했다. **비영속(무저장) 모델**로 접근 컨텍스트(MDL-201: encX·encY·생년월일)와 복호화 원문 X(MDL-204: 회원 키·추적 키 등)를 표현하고, 구 요청 키값(UUID·MDL-202)을 **연동 추적 키**로 재정의, 구 전달 파라미터·사용자 키값 exactly-one 지정·지정 사용자 키값 저장을 폐기했다. MDL 코드는 유지하되 의미를 갱신했다. 후행 도메인(functions/screens/processes/qa)은 v0.1.0 상태이며 PROC 등 후행 코드는 예약 채번(실재 확인은 교차검증 시점).

## 데이터 모델 설계 원칙

- **ENT/MDL 책임 분리**: ENT 는 DB 영속 구조, MDL 은 응용 계층 모델(요청·응답·도메인·외부 DTO). **무저장 값(encX·encY·생년월일·복호화 원문 X·회원 키)은 비영속 MDL(MDL-201·204)에만 존재하고 ENT 매핑이 없다**(DATA-001-04). 저장·조회로 넘어가는 유일한 X 파생값은 연동 추적 키(MDL-202)다.
- **분류 체계(COM/SVC/EXT)**: 공통(2+ 서비스 공유) / 서비스(단일 서비스) / 외부 연동(외부 시스템 I/O). EXT 는 외부 I/O 성격을 우선 분류한다(MDL-201 인바운드 컨텍스트·MDL-204 아웃바운드·MDL-305 인바운드 콜백).
- **명명**: MDL 속성은 camelCase, ENT 컬럼은 snake_case. 엔터티 매핑 표가 변환 지점(6 지점)과 함께 양자를 잇는다.
- **미기록·마스킹**: 암호값·생년월일·복호화 원문·회원 키는 로그·응답 전량 미기록(SEC-005-06). 연동 추적 키·인증 자격은 앞2·뒤2 마스킹(SEC-005-04). 처리상태/완료 확인 응답은 항목 한정(SEC-005-02/05).

## 모델 코드 체계·대역

- 코드: `MDL-nnn`. 대역: 1xx 관리자 · 2xx 사용자 연동 · 3xx API/상태 · 4xx 배치/공통.
- 변환 지점 6 지점: FE→요청 / 요청→도메인 / 도메인→ENT / ENT→도메인 / 도메인→응답 / 응답→FE(PROC 데이터 변환 흐름과 1:1 정합).

## 모델 분류·목록 (하위 문서와 1:1)

| MDL 코드 | 모델명 | 분류 | 매핑 ENT | 사용 SVC | 용도 | 하위 문서 |
|----------|--------|------|----------|----------|------|-----------|
| MDL-101 | 발송처 접근 주소 구성 | COM | ENT-001·002 | SVC-001, SVC-002 | 도메인/요청·응답 | [model_admin.md](model_admin.md) |
| MDL-102 | 접근 주소 구성 목록/요약 | SVC | ENT-001 | SVC-002 | 응답(목록) | [model_admin.md](model_admin.md) |
| MDL-103 | 관리자 계정 | SVC | ENT-005 | SVC-003 | 도메인(인증) | [model_admin.md](model_admin.md) |
| MDL-104 | 관리자 세션 | SVC | 없음(앱 세션) | SVC-003 | 도메인/인프라 | [model_admin.md](model_admin.md) |
| MDL-201 | 접근 컨텍스트(무저장) | EXT | 없음(비영속) | SVC-004, SVC-005 | 인바운드 컨텍스트 | [model_user.md](model_user.md) |
| MDL-202 | 연동 추적 키 | COM | ENT-004·007(tracking_key) | SVC-005, SVC-006, SVC-008, SVC-009 | 조회·통지 키 | [model_user.md](model_user.md) |
| MDL-203 | 동의 결과 | SVC | 없음(증빙 미저장) | SVC-004 | 요청 | [model_user.md](model_user.md) |
| MDL-204 | 수신처 B 전달 페이로드(복호화 원문 X) | EXT | 없음(전송 전용·무저장) | SVC-005 | 아웃바운드 DTO | [model_user.md](model_user.md) |
| MDL-301 | 처리 상태 | COM | ENT-004 | SVC-005, SVC-006, SVC-007 | 도메인 | [model_api.md](model_api.md) |
| MDL-302 | 처리상태 조회 응답 | SVC | ENT-004(4항목) | SVC-006 | 응답 | [model_api.md](model_api.md) |
| MDL-303 | 연동이력 | COM | ENT-007 | SVC-005, SVC-007, SVC-008, SVC-009 | 도메인 | [model_api.md](model_api.md) |
| MDL-304 | 완료 확인 응답 | SVC | ENT-007(판정 항목) | SVC-008 | 응답 | [model_api.md](model_api.md) |
| MDL-305 | 완료 콜백 요청 | EXT | ENT-007(조건 참조) | SVC-009 | 인바운드 DTO | [model_api.md](model_api.md) |
| MDL-401 | 감사 로그 항목 | COM | ENT-006 | 전 SVC | 도메인(기록) | [model_common.md](model_common.md) |
| MDL-402 | 배치 실행 결과 | SVC | 없음(감사 요약) | SVC-007 | 결과 | [model_api.md](model_api.md) |

- **공통 모델(COM)**: MDL-101(접근 주소 구성)·MDL-202(연동 추적 키)·MDL-301(처리 상태)·MDL-303(연동이력)·MDL-401(감사 로그) — 2개 이상 서비스 공유.
- **외부 연동(EXT)**: MDL-201(인바운드 컨텍스트·무저장)·MDL-204(아웃바운드=복호화 원문 X·무저장)·MDL-305(인바운드 콜백) — 외부 I/O 성격 우선. MDL-201·204 는 암호값·생년월일·복호화 원문·회원 키 무저장(ENT 매핑 없음), MDL-305 의 추적 키는 조회 조건 전용(신규 저장 없음).
- **파일 그룹화**: 영역별(admin/user/api·batch/common) 4파일. 분류(COM/SVC/EXT)는 모델별 속성이며 파일 배치와 독립이다.

## MDL 후보 대비 확정/변경 사항 (`#214`)

서비스 정의서 §MDL 후보 목록 대비 확정 결과다.

| MDL | 후보 대비 | 확정/변경 내용 |
|-----|-----------|----------------|
| **MDL-101** | **변경** | 발송처 접근 주소 구성. **serviceAEntryUrl·parameters[]·isUserKey(사용자 키값 exactly-one 지정) 폐기** — configCode(접근 주소 고유 ID·발송처 식별자·관리자 직접 입력·불변)·serviceBDeliveryUrl·serviceBHttpMethod·isActive·consentNotice(`#215` 동의 대상 설명 문구·선택)·consentItems 로 한정. 매핑 ENT 에서 ENT-003 제거 |
| **MDL-201** | **변경** | 진입 요청→**접근 컨텍스트(무저장)**. accessAddressId(고유 ID)·encX·encY·birthDate — 전량 비영속·미저장·미기록(SEC-005-06). 구 memberKey·parameters 필드 폐기(회원 키는 X 안에) |
| **MDL-202** | **변경** | 요청 키값(UUID)→**연동 추적 키**. X 내부 지정 필드 원문(불투명·허브 미발급·미해석), ENT-004·007 의 tracking_key 매핑, NotBlank·MaxLength(255)·앞2뒤2 마스킹 |
| **MDL-203** | **변경** | 동의 결과. 구 requestKey 폐기(복호화 이전 단계라 추적 키 없음) — decision·accessAddressId·requiredConsentMet. 증빙 미저장(Q3) 유지 |
| **MDL-204** | **변경** | 전달 페이로드→**복호화 원문 X**. targetUrl·httpMethod(구성)·payload(=X: 회원 키·추적 키 등 무변형·무저장·미기록). 서버-서버 POST(SEC-007). 구 configCode·requestKey 동봉 폐기(콜백이 추적 키 단독) |
| **MDL-301** | **변경** | 처리 상태. requestKey→trackingKey(ENT-004.tracking_key). configId·상태 4항목 유지. 내부 surrogate id 는 도메인 모델 미노출 |
| **MDL-302** | **변경** | 조회 응답. requestKey 에코→trackingKey 에코. 상태 4항목, 회원 키·configId 미포함(SEC-005-02) |
| **MDL-303** | **변경** | 연동이력. **userKey·requestKey 폐기** — trackingKey(ENT-007.tracking_key)·configId·requestedAt·callbackReceived·callbackReceivedAt 5항목(DATA-005-05). 회원 키·복호화 원문 미저장 |
| **MDL-304** | 확정 | 완료 확인 응답 — 완료 판정 항목 3개(isCompleted·callbackReceivedAt·requestedAt, SEC-005-05). 추적 키 원문·X 내용 미포함 |
| **MDL-305** | **변경** | 완료 콜백 요청. 구 configCode·userKey 2항목 폐기→**trackingKey 단독**(대상 특정 스코프 키, BIZ-004-09) |
| MDL-401 | 변경 | 감사 로그. 이벤트에 복호화 시도·전달 결과·완료 콜백 추가, 암호값·생년월일·원문·회원 키 미기록(SEC-005-06)·추적 키 마스킹(SEC-005-04) |
| MDL-402 | 확정 | 배치 결과. 처리상태·연동이력 각각 집계(SVC-007 F-005·OPS-003). 감사 로그 detail 로 기록 |

## ENT ↔ MDL 매핑 정합 요약

| ENT | MDL(도메인) | MDL(응답/DTO) | 무매핑 MDL 관계 |
|-----|-------------|----------------|------------------|
| ENT-001 | MDL-101 | MDL-102 | MDL-204.targetUrl·httpMethod 참조, MDL-201.accessAddressId·MDL-203.accessAddressId 조건 참조 |
| ENT-002 | MDL-101(중첩 consentItems) | - | - |
| ENT-004 | MDL-301 | MDL-302 | MDL-202.trackingKey 가 tracking_key 로 유입 |
| ENT-005 | MDL-103 | - | MDL-104 는 앱 세션(무매핑) |
| ENT-006 | MDL-401 | - | MDL-402 요약(처리상태·연동이력 각각 집계)이 detail 로 유입 |
| ENT-007 | MDL-303 | MDL-304(판정 항목만) | MDL-202.trackingKey 가 tracking_key 로 유입, MDL-305.trackingKey 는 조건 참조(저장 유입 없음) |
| (없음) | MDL-201·204 | - | 암호값·생년월일·복호화 원문·회원 키 무저장(비영속) |

- 깨진 참조 0건 — 모든 MDL 이 ENT 매핑 또는 명시적 무매핑(비영속·앱 세션·조건 참조)으로 정의됨. 사용 PROC 는 프로세스 도메인에 실재한다(예약 채번 PROC-201·203·301·302·303·401·402·403 포함, 실재 확인은 교차검증 시점).
- **연동 추적 키(MDL-202) 유입 경로**: SVC-005(PROC-203)가 복호화된 X 에서 추출 → ENT-004.tracking_key(처리상태)·ENT-007.tracking_key(연동이력)로 저장 → SVC-006/008/009 가 조회 키로 사용.

## 담당자 확정 대기·보류

- **MDL-202 추적 키 길이(255)**: NotBlank·MaxLength(255)는 ENT-004·007 의 tracking_key varchar(255)와 정합한 확정 기본안이며 담당자 조정 가능하다(DATA-002-07 스키마 상한 위임).
- **MDL-203 동의 증빙(Q3)**: 증빙 원장 미저장은 확정 기본안. 증빙 요건 확정 시 DATA 정책·MDL-203·ENT 를 함께 리비전.
- **MDL-104 세션 저장소**: 애플리케이션 세션 저장 수단(단일/공유)은 build 단계 확정.
- **MDL-201/204 마스킹·미기록**: encX·encY·생년월일·복호화 원문 X·회원 키의 전량 미기록(SEC-005-06)은 확정. 로그 정책 세부는 build 단계 확정.
- **MDL-303 장기 보관(EXC-DATA-09, `accountinterlockhub#33`)**: 연동이력 보관 90/180일 fallback 은 확정 기본안 — 통계 목적 장기 보관 확정 시 MDL-402 집계 항목·보존 정책을 재검토.
- **서비스 대면 API 인증 자격**: API Key/HMAC 시크릿은 운영 구성값(비 ENT·비 MDL 영속)으로 관리하며 build 확정(SEC-003, [`spec-datas.md`](spec-datas.md) §엔터티 아님 목록).
