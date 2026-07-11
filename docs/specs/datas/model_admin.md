# 관리자 도메인 데이터 모델 정의

## 개요

- **모델 목적**: 관리자 도메인(발송처 접근 주소 구성 관리·접근/로그인)이 다루는 입력/출력/도메인 모델을 정의한다. 발송처 접근 주소 구성(MDL-101)·구성 목록(MDL-102)·관리자 계정(MDL-103)·관리자 세션(MDL-104). `#214` 로 구성에서 **전달 파라미터 정의·사용자 키값 exactly-one 지정·서비스 A 진입 주소를 폐기**했다.
- **관련 서비스**: SVC-001, SVC-002, SVC-003.

> 변환 지점은 6 지점(FE→요청 / 요청→도메인 / 도메인→ENT / ENT→도메인 / 도메인→응답 / 응답→FE) 중 해당을 명시하며, PROC 데이터 변환 흐름과 1:1 정합한다.

---

## MDL-101 발송처 접근 주소 구성

### 기본 정보

| 항목 | 내용 |
|------|------|
| 모델명 | 발송처 접근 주소 구성(InterlockConfig) |
| 분류 | 공통(COM) |
| 사용 서비스 | SVC-001, SVC-002 |
| 매핑 엔터티 | ENT-001, ENT-002(consentItems) |
| 사용 PROC | PROC-101(등록·편집), PROC-102(조회), PROC-201·PROC-203(참조 소비) |
| 용도 | 도메인 모델 / 요청·응답 겸용(관리자) |
| 관련 IA 항목 | ADM-01, ADM-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 필수 | 기본값 | 유효성 규칙 | 마스킹 규칙 | 설명 |
|--------|-----------|------|--------|-------------|-------------|------|
| id | string(UUID) | N | - | UUID 형식 | - | 구성 내부 식별자(응답 시 포함) |
| configCode | string | Y | - | NotBlank, MaxLength(64), 고유(BIZ-001-10)·불변(BIZ-001-11) | - | **접근 주소 고유 ID = 발송처 식별자** |
| configName | string | Y | - | NotBlank, MaxLength(100) | - | 구성명 |
| serviceBDeliveryUrl | string | Y | - | http/https 절대 URL, MaxLength(2048) | 마스킹 제외(EXC-SEC-05) | 수신처 B 전달 주소(서버-서버 POST 대상) |
| serviceBHttpMethod | enum('GET','POST','PUT','PATCH') | Y | 'POST' | 허용값 | - | 전달 방식 |
| isActive | boolean | Y | true | - | - | 활성 여부 |
| consentItems | ConsentItem[] | Y | - | 1개 이상(BIZ-001-04) | - | 동의 항목(label·description·termsContent·required·order) |

> 중첩 ConsentItem = {label, description?, termsContent?, required, order}. termsContent(전체 약관 본문)는 선택(BIZ-001-06) — 동의 화면은 값이 있는 항목에만 [상세] 모달을 노출한다(BIZ-002-05).
> **폐기(`#214`)**: 구 serviceAEntryUrl(서비스 A 진입 주소)·parameters[](전달 파라미터 정의)·isUserKey(사용자 키값 exactly-one 지정)를 제거했다 — 입력이 단일 암호화 JSON(encX·encY)으로 바뀌어 회원 키·연동 추적 키는 발송처가 전달 데이터 X 안에 담고, 허브는 저장하지 않는다(EXC-BIZ-14·DATA-001). 발송처키·암호값·서명 검증 키도 본 모델에 두지 않는다. 서버 대면 API 인증 자격은 운영 구성값으로 관리한다(SEC-003).

### 엔터티 매핑 (PROC 데이터 변환 흐름과 정합)

| 모델 속성 | 엔터티(ENT) | 엔터티 속성 | 변환 지점 | 변환 규칙 |
|-----------|-------------|-------------|-----------|-----------|
| configCode | ENT-001 | config_code | 요청→도메인 / 도메인→ENT | 직접 매핑(고유성 사전 조회·1회 부여 후 불변) |
| configName | ENT-001 | config_name | 도메인→ENT | 직접 매핑 |
| serviceBDeliveryUrl | ENT-001 | service_b_delivery_url | 도메인→ENT | URL 검증 후 저장 |
| serviceBHttpMethod | ENT-001 | service_b_http_method | 도메인→ENT | 허용값 매핑 |
| isActive | ENT-001 | is_active | 도메인→ENT / ENT→도메인 | 직접 매핑 |
| consentItems | ENT-002 | (행 N) | 도메인→ENT / ENT→도메인 | 부모 config_id 로 자식 교체·조회 |

### 사용처

| SVC 코드 | 기능 | 용도 | 사용 PROC | 비고 |
|----------|------|------|----------|------|
| SVC-001 | 등록·편집 | 요청·도메인 | PROC-101 | 서버 재검증 후 영속화 |
| SVC-002 | 상세 조회 | 응답 | PROC-102 | 설정 데이터, 회원 키·상태 미포함 |
| SVC-004/005 | 동의·복호화·전달 | 도메인(참조) | PROC-201·203 | 활성 구성만 소비(진입 판별·전달 대상) |

### 구현 가이드

- 요청 DTO·응답 DTO·도메인 모델을 분리하되 속성 명명을 통일(camelCase)한다. 자식(consentItems)은 부모와 동일 트랜잭션에서 영속화한다.
- 회원 키·처리 상태·암호값·전달 파라미터 필드를 본 모델에 두지 않는다(설정 데이터 전용). 접근 주소 고유 ID(configCode)는 등록 시 1회 부여하고 편집 시 읽기 전용(불변, BIZ-001-11)이다.
- `#214` 로 순환 FK(구 user_key_param_id)가 제거돼 편집 시 자식(consentItems) 전량 교체의 별도 지정 참조 정합 순서가 불필요해졌다([`data_ENT-001.md`](data_ENT-001.md) §구현 가이드).

---

## MDL-102 발송처 접근 주소 구성 목록/요약

### 기본 정보

| 항목 | 내용 |
|------|------|
| 모델명 | 접근 주소 구성 목록 요약(InterlockConfigSummary) |
| 분류 | 서비스(SVC) |
| 사용 서비스 | SVC-002 |
| 매핑 엔터티 | ENT-001 |
| 사용 PROC | PROC-102 |
| 용도 | 응답 모델(목록) |
| 관련 IA 항목 | ADM-02 |

### 속성 정의

| 속성명 | 데이터 타입 | 필수 | 기본값 | 유효성 규칙 | 마스킹 규칙 | 설명 |
|--------|-----------|------|--------|-------------|-------------|------|
| id | string(UUID) | Y | - | UUID 형식 | - | 구성 식별자 |
| configCode | string | Y | - | - | - | 접근 주소 고유 ID(발송처 식별자) |
| configName | string | Y | - | - | - | 구성명 |
| isActive | boolean | Y | - | - | - | 활성 여부(성과 지표 근거) |
| consentItemCount | number | N | 0 | >= 0 | - | 동의 항목 수(요약) |
| createdAt | string(ISO8601) | Y | - | - | - | 생성 일시(정렬 기준) |

### 엔터티 매핑

| 모델 속성 | 엔터티(ENT) | 엔터티 속성 | 변환 지점 | 변환 규칙 |
|-----------|-------------|-------------|-----------|-----------|
| configCode | ENT-001 | config_code | ENT→도메인 / 도메인→응답 | 직접 매핑 |
| isActive | ENT-001 | is_active | ENT→도메인 / 도메인→응답 | 직접 매핑 |
| consentItemCount | ENT-002 | COUNT(*) | ENT→도메인 | 자식 카운트 집계 |
| createdAt | ENT-001 | created_at | ENT→응답 | ISO8601 직렬화 |

### 사용처

| SVC 코드 | 기능 | 용도 | 사용 PROC | 비고 |
|----------|------|------|----------|------|
| SVC-002 | 목록 조회 | 응답 | PROC-102 | 필터(활성)·정렬(생성일) |

### 구현 가이드

- 목록 응답은 요약 필드만 담고 URL·자식 상세는 상세 조회(MDL-101)에서 제공한다. deleted_at IS NULL 필터를 적용한다.

---

## MDL-103 관리자 계정

### 기본 정보

| 항목 | 내용 |
|------|------|
| 모델명 | 관리자 계정(AdminAccount) |
| 분류 | 서비스(SVC) |
| 사용 서비스 | SVC-003 |
| 매핑 엔터티 | ENT-005 |
| 사용 PROC | PROC-103 |
| 용도 | 도메인 모델(인증) |
| 관련 IA 항목 | ADM-03 |

### 속성 정의

| 속성명 | 데이터 타입 | 필수 | 기본값 | 유효성 규칙 | 마스킹 규칙 | 설명 |
|--------|-----------|------|--------|-------------|-------------|------|
| id | string(UUID) | N | - | UUID 형식 | - | 계정 식별자 |
| username | string | Y | - | NotBlank, MaxLength(64) | - | 로그인 계정 ID |
| passwordHash | string | Y | - | 단방향 해시 | 응답·로그 전면 배제(비노출) | 해시 자격(AUTH-001-03) |
| isActive | boolean | Y | true | - | - | 활성 여부 |
| failedLoginCount | number | Y | 0 | >= 0 | - | 연속 실패 횟수(AUTH-003) |
| lockedUntil | string(ISO8601) \| null | N | null | - | - | 잠금 해제 시각 |
| lastLoginAt | string(ISO8601) \| null | N | null | - | - | 마지막 로그인 |

### 엔터티 매핑

| 모델 속성 | 엔터티(ENT) | 엔터티 속성 | 변환 지점 | 변환 규칙 |
|-----------|-------------|-------------|-----------|-----------|
| username | ENT-005 | username | 요청→도메인 / ENT→도메인 | 직접 매핑 |
| passwordHash | ENT-005 | password_hash | 도메인→ENT | 평문 비밀번호→해시 변환 후 저장(응답 미포함) |
| failedLoginCount | ENT-005 | failed_login_count | ENT→도메인 / 도메인→ENT | 실패 누적·성공 리셋 |
| lockedUntil | ENT-005 | locked_until | 도메인→ENT | 임계 초과 시 설정 |

### 사용처

| SVC 코드 | 기능 | 용도 | 사용 PROC | 비고 |
|----------|------|------|----------|------|
| SVC-003 | 로그인·잠금 | 도메인 | PROC-103 | passwordHash 응답 배제 |

### 구현 가이드

- passwordHash 는 어떤 응답·로그에도 노출하지 않는다(마스킹 이전에 필드 자체 배제). 평문 비밀번호는 검증 직후 해시로만 변환하고 보관하지 않는다.

---

## MDL-104 관리자 세션

### 기본 정보

| 항목 | 내용 |
|------|------|
| 모델명 | 관리자 세션(AdminSession) |
| 분류 | 서비스(SVC) |
| 사용 서비스 | SVC-003 |
| 매핑 엔터티 | 없음(애플리케이션 세션 — DB 엔터티 아님, AUTH-002) |
| 사용 PROC | PROC-103 |
| 용도 | 도메인/인프라 모델(세션) |
| 관련 IA 항목 | ADM-03 |

### 속성 정의

| 속성명 | 데이터 타입 | 필수 | 기본값 | 유효성 규칙 | 마스킹 규칙 | 설명 |
|--------|-----------|------|--------|-------------|-------------|------|
| sessionId | string | Y | - | 추측 불가 난수 | 로그 배제 | 세션 식별자(AUTH-002-02) |
| username | string | Y | - | - | - | 세션 소유 계정 |
| issuedAt | string(ISO8601) | Y | - | - | - | 발급 시각 |
| lastActivityAt | string(ISO8601) | Y | - | - | - | 마지막 활동 시각(유휴 판정 기준) |
| expiresAt | string(ISO8601) | Y | - | 유휴 30분(AUTH-002-01) | - | 만료 시각 |
| httpOnly | boolean | Y | true | - | - | 쿠키 HttpOnly 속성 |
| secure | boolean | Y | true | - | - | 쿠키 Secure 속성 |

### 엔터티 매핑

| 모델 속성 | 엔터티(ENT) | 엔터티 속성 | 변환 지점 | 변환 규칙 |
|-----------|-------------|-------------|-----------|-----------|
| (전체) | 없음 | - | 도메인(앱 세션) | DB 영속 아님 — 애플리케이션 세션 저장소 관리(build 확정) |

### 사용처

| SVC 코드 | 기능 | 용도 | 사용 PROC | 비고 |
|----------|------|------|----------|------|
| SVC-003 | 세션 발급·검증 | 도메인 | PROC-103 | 유휴 30분 만료, 로그아웃 즉시 파기 |

### 구현 가이드

- 세션은 DB 엔터티가 아닌 애플리케이션 세션으로 관리한다(단일 App Service 기준, 스케일아웃 시 공유 저장소 전환 여지). sessionId 는 로그에 남기지 않는다.
