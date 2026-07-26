# 연동 추적 레코드 데이터 모델 정의

정본 목록은 [`spec-models.md`](spec-models.md). 용어는 [`../../../wiki/WIKI.md`](../../../wiki/WIKI.md).

## 개요

- **모델 목적**: 연동 1건의 진행과 결과를 응용 계층에서 다루는 도메인 모델이다. 화면 경로 선택·발송처 조회 응답·수신처 통지 기록이 모두 이 모델을 거쳐 같은 사실을 말한다.
- **관련 서비스**: `SVC-014`(기록 주체) · `SVC-002`·`SVC-003`·`SVC-004`·`SVC-005`(계기·소비) · `SVC-010`·`SVC-011`·`SVC-012`(조회·이어쓰기) · `SVC-017`(삭제 대상)

---

## MDL-001 연동 추적 레코드

### 기본 정보

| 항목 | 내용 |
|------|------|
| 모델명 | 연동 추적 레코드 |
| 분류 | 공통(COM) |
| 사용 서비스 | SVC-002 · SVC-003 · SVC-004 · SVC-005 · SVC-010 · SVC-011 · SVC-012 · SVC-014 · SVC-017 |
| 매핑 엔터티 | [`ENT-001`](data_ENT-001.md) |
| 사용 PROC | PROC-102 · PROC-105 · PROC-201 · PROC-202 · PROC-203 · PROC-301 · PROC-304 |
| 용도 | 도메인 모델 |
| 관련 IA 항목 | `BAT-04` |

### 속성 정의

| 속성명 | 데이터 타입 | 필수 | 기본값 | 유효성 규칙 | 마스킹 규칙 | 설명 |
|--------|-----------|------|--------|-------------|-------------|------|
| trackingKey | string | Y | - | 1자 이상 255자 이하, 공백만 불가(`DATA-004-03`) | - | 연동 추적 키. 불투명 문자열이며 파싱·변형하지 않는다 |
| resultCode | string \| null | N | null | `SUCCESS`·`DECRYPT_FAILED`·`DELIVERY_FAILED` **3종 중 하나**(`BIZ-001-01` — 네 번째 값을 만들지 않으며 거부 값이 없다). null = 결과 미확정 | - | 결과 구분. 한 번 확정되면 바뀌지 않는다(`BIZ-001-04`) |
| resultAt | datetime \| null | N | null | `resultCode` 와 항상 함께 채워진다 | - | 처리 일시 — 결과가 확정된 시각 |
| resultConfirmedAt | datetime \| null | N | null | 최초 1회만 채운다(BR-010) | - | 결과 확인 일시. 이 값이 채워진 시점이 보관 기간 기산점이다 |
| callbackReceivedAt | datetime \| null | N | null | 최초 수신 시에만 채운다(BR-012) | - | 수신처 완료 콜백 수신 일시 |
| createdAt | datetime | Y | 생성 시각 | - | - | 생성 일시. 생성 기산 절대 상한의 기준 |
| isResultFixed | boolean | Y | - | **파생** — `resultCode !== null` | - | 결과 확정 여부. `BIZ-002-03` 3분기 판정의 기준이다 |
| isSuccess | boolean \| null | N | null | **파생** — 결과 미확정이면 null, 확정이면 `resultCode === 'SUCCESS'` | - | 처리 성공 여부 |
| isResultConfirmed | boolean | Y | - | **파생** — `resultConfirmedAt !== null` | - | 결과 확인 여부 |
| isCallbackReceived | boolean | Y | - | **파생** — `callbackReceivedAt !== null` | - | 수신처 완료 콜백 수신 여부 |

- **파생 4종은 저장되지 않는다** — 엔터티에 대응 컬럼이 없고 `ENT→도메인` 지점에서 산출된다. 두 값이 어긋날 여지를 구조적으로 없앤 결과다.
- **`resultCode = null` 은 정상 상태다** — 동의하지 않고 창을 닫은 연동은 결과가 확정되지 않은 채 이 모델로 읽힌다(`BIZ-003-03`·EXC-BIZ-05). `isResultFixed = false`·`isSuccess = null` 이 되며, 레코드 부재와는 다르다(`BIZ-002-05`).
- **사용자 정보·암호값·복호화 원문을 담지 않는다**(`DATA-001-02`·`SVC-014` F-007). 담을 속성이 모델에 없는 것이 1차 방어다.

### 엔터티 매핑 (PROC 데이터 변환 흐름과 정합)

| 모델 속성 | 엔터티(ENT) | 엔터티 속성 | 변환 지점 | 변환 규칙 |
|-----------|-------------|-------------|-----------|-----------|
| trackingKey | ENT-001 | tracking_key | 도메인→ENT / ENT→도메인 | 직접 매핑(무변형 — `DATA-004-01`) |
| resultCode | ENT-001 | result_code | 도메인→ENT / ENT→도메인 | 직접 매핑. 미확정은 NULL |
| resultAt | ENT-001 | result_at | 도메인→ENT / ENT→도메인 | 직접 매핑. `resultCode` 와 같은 갱신에서 함께 기록 |
| resultConfirmedAt | ENT-001 | result_confirmed_at | 도메인→ENT / ENT→도메인 | 직접 매핑. 비어 있을 때만 기록 |
| callbackReceivedAt | ENT-001 | callback_received_at | 도메인→ENT / ENT→도메인 | 직접 매핑. 비어 있을 때만 기록 |
| createdAt | ENT-001 | created_at | ENT→도메인 | 직접 매핑(INSERT 시 데이터베이스 기본값) |
| isResultFixed | ENT-001 | result_code | ENT→도메인 | `result_code IS NOT NULL` 로 산출 |
| isSuccess | ENT-001 | result_code | ENT→도메인 | `result_code = 'SUCCESS'` 로 산출. NULL 이면 null |
| isResultConfirmed | ENT-001 | result_confirmed_at | ENT→도메인 | `result_confirmed_at IS NOT NULL` 로 산출 |
| isCallbackReceived | ENT-001 | callback_received_at | ENT→도메인 | `callback_received_at IS NOT NULL` 로 산출 |

### 사용처

| SVC 코드 | 기능 | 용도 (요청/응답/도메인) | 사용 PROC | 비고 |
|----------|------|------------------------|----------|------|
| SVC-014 | 연동 추적 기록 | 도메인 | PROC-301 | 생성·이어쓰기·결과 확정의 대상 |
| SVC-002 | 본인확인 | 도메인 | PROC-102 · PROC-301 | 추적 키 사전 조회로 3분기 판정(BR-002) |
| SVC-003 | 동의·승인 | 도메인 | PROC-103 · PROC-301 | 승인 확정 흐름에서 이어 쓴다. **미동의 이탈은 결과를 확정하지 않는다**(`BIZ-003-03`) |
| SVC-004 | 연동 실행 | 도메인 | PROC-104 · PROC-301 | 전달 결과로 `SUCCESS`·`DELIVERY_FAILED` 확정 |
| SVC-005 | 연동 결과 안내 | 도메인 | PROC-105 | 확정 결과에서 [`MDL-009`](model_MDL-007-010.md) 를 만든다 |
| SVC-010 | 처리상태 확인 | 도메인 | PROC-201 | [`MDL-012`](model_MDL-011-015.md) 응답의 근거 · 결과 확인 표시 |
| SVC-011 | 연동 완료 확인 | 도메인 | PROC-202 | [`MDL-013`](model_MDL-011-015.md) 응답의 근거. 갱신하지 않는다 |
| SVC-012 | 완료 콜백 수신 | 도메인 | PROC-203 · PROC-301 | 콜백 일시만 이어 쓴다(BR-021) |
| SVC-017 | 보관정책 배치 | 도메인 | PROC-304 | 삭제 대상 산정·삭제 수행 |

### 구현 가이드

- **결과 구분은 문자열 상수 3개를 한 곳에 정의하고 화면·API·집계가 그 정의를 가져다 쓴다.** 모델 계층에서 별칭·대소문자 변형을 만들지 않으며, 값 체계에서 제거된 거부 값을 되살리지 않는다(`BIZ-001-01`·`BIZ-001-03`).
- **파생 속성은 읽기 전용으로 노출한다** — 쓰기 가능하게 두면 저장 값과 어긋난 상태를 만들 수 있다.
- 결과 확정·결과 확인·콜백 기록은 각각 "아직 비어 있을 때만" 채우는 조건부 갱신으로 구현한다([`data_ENT-001.md`](data_ENT-001.md) §구현 가이드).
- 확정 결과 재안내 흐름에서는 이 모델을 **읽기만** 한다 — 어떤 속성도 갱신하지 않아야 보관 기산점이 밀리지 않는다(`BIZ-002-04`).
- 타입 정의 시 일시 속성은 시간대 정보를 유지하는 타입으로 둔다. 지표 집계의 일자 산출이 이 값을 기준으로 하므로 시간대가 사라지면 경계가 흔들린다([`data_ENT-003.md`](data_ENT-003.md) §일자 경계 기준).
