# 구현 인벤토리

현재 `apps/` 소스에서 직접 도출한 **구현 표면 목록**이다. qa 단계가 "구현됐으나 검증 케이스가 없는 지점"을 찾는 대조표로 쓴다 — 검증 케이스 목록과 이 표를 맞대어 빈칸을 식별한다.

> 이 문서는 **무엇이 구현돼 있는가**만 적는다. 무엇을 어떻게 만들었는지(작업 경위)는 [`../history/`](../history/) 와 Redmine 일감이, 무엇이어야 하는가(사양)는 [`../docs/`](../docs/) 가 담당한다. 기준 시점·기준 commit 은 이 문서를 담은 commit 이다.

## 1. 백엔드 — 외부 표면(HTTP 접점)

접점은 **7개**다. 전역 경로 접두는 두지 않으므로 아래가 실제 최종 경로다. 모든 제출 접점은 성공 시 200 을 낸다.

| # | 방식 | 경로 | 정의 위치 | 하는 일 |
|---|---|---|---|---|
| 1 | GET | `<INTERLOCK_ENTRY_PATH>` | `backend/src/interlock-entry/entry.controller.ts` | 연동 링크 진입. 생년월일 없이 판정 가능한 것(주소 길이·파라미터 중복·암호값 구조)만 보고, 실패해도 항상 화면 문서로 응답한다(오류 상태 코드를 내지 않는다) |
| 2 | POST | `<INTERLOCK_ENTRY_PATH>/verify` | `backend/src/interlock-verify/verify.controller.ts` | 본인확인 제출. 입력 `encX`·`encY`·`birthDate`. 결과는 동의 단계로 진행 또는 결과 확정 |
| 3 | POST | `<INTERLOCK_ENTRY_PATH>/approve` | `backend/src/interlock-approve/approve.controller.ts` | 동의·승인 제출과 연동 실행. 입력에 동의 항목 코드 목록이 더 붙는다 |
| 4 | POST | `<SELFCHECK_PATH>` | `backend/src/interlock-selfcheck/selfcheck.controller.ts` | 연동 규약 자가진단(발송처 라이브러리 점검용). **데이터베이스를 쓰지 않는다.** 부적합 판정도 200 |
| 5 | POST | `/api/interlock/status` | `backend/src/interlock-server-api/server-api.controller.ts` | 처리 상태 확인. 결과가 확정돼 있으면 최초 1회 결과 확인 표시를 남긴다 |
| 6 | POST | `/api/interlock/completion` | 〃 | 연동 완료 확인. 읽기 전용 |
| 7 | POST | `/api/interlock/callback` | 〃 | 완료 콜백 기록. 최초 수신만 기록한다(여러 번 받아도 결과가 같다) |

- 1~4 의 경로는 **설정 값으로 정해진다**(`INTERLOCK_ENTRY_PATH`·`SELFCHECK_PATH`). 5~7 은 코드에 고정된 경로다.
- 인증·요청 제한을 두는 접점은 하나도 없다([`../docs/prd/devspec/infra.md`](../docs/prd/devspec/infra.md) §접근 제어).
- `PUT`·`DELETE`·`PATCH` 접점은 없다.

### 요청이 접점에 닿기 전 거치는 처리

`backend/src/main.ts` 가 아래 순서로 건다. 순서가 판정 결과를 좌우하므로 검증 시 이 순서를 전제로 읽는다.

1. **캐시 금지 헤더** — 모든 응답에 붙인다(`backend/src/common/http/cache-control.ts`).
2. **경로·방식 감시** — 위 표의 6개 경로(**자가진단 경로는 의도적으로 제외**)에 대해 방식이 어긋나면 본문 없는 405 로 즉시 끝낸다(`backend/src/common/http/route-guard.middleware.ts`).
3. **정적 자원 서빙** — 프런트엔드 빌드 폴더를 서빙한다. 진입 경로·자가진단 경로·`/api/**` 는 정적 탐색조차 하지 않고 넘긴다. **못 찾은 경로를 화면 문서로 대신 응답하는 처리를 두지 않는다**(`backend/src/common/http/static-assets.ts`).
4. 위 어디에도 걸리지 않으면 접점 매칭으로 가고, 매칭 실패는 **본문 없는 404** 로 끝난다(`backend/src/common/filters/global-exception.filter.ts`).
5. 경로는 **대소문자를 구분**한다 — 대문자로 바꿔 보낸 요청은 매칭되지 않는다.

## 2. 백엔드 — 내부 구성 단위

구성 단위는 **13개**다. 아래 셋은 화면·API 표면을 갖지 않는 하부 계층이다.

| 구성 단위 | 위치 | 역할 |
|---|---|---|
| 루트 | `backend/src/app.module.ts` | 검증된 설정 값을 하위 전체에 배선한다 |
| 연동 구성 상수 | `backend/src/config/` | 검증 통과한 상수를 전역 제공 |
| 데이터베이스 | `backend/src/database/` | 접속 풀 보유·트랜잭션 경계 제공 |
| 기록 계층 | `backend/src/records/` | 추적 레코드·동의 증적·집계 기록 |
| 횡단 처리 | `backend/src/common/` | 오류 응답 구성·응답 민감값 제거 |
| 진입 | `backend/src/interlock-entry/` | 접점 1 |
| 본인확인 | `backend/src/interlock-verify/` | 접점 2 |
| 동의·승인 | `backend/src/interlock-approve/` | 접점 3 · 수신처 전달 |
| 자가진단 | `backend/src/interlock-selfcheck/` | 접점 4 (데이터베이스 미사용) |
| 서버 대면 API | `backend/src/interlock-server-api/` | 접점 5~7 |
| 보관 정책 | `backend/src/retention/` | 삭제 실행 본체 + 일 단위 스케줄 |
| 보관 정책 CLI | `backend/src/cli/` | 수동 실행 전용 최소 구동 |
| 암복호 | `backend/src/crypto/` | 복호화 판정 (연동 라이브러리와 짝을 이룬다) |

## 3. 백엔드 — 실행 진입점(화면 밖)

| 진입점 | 실행 방법 | 하는 일 |
|---|---|---|
| 보관 배치(수동) | `npm --prefix apps/backend run retention:run` | HTTP 표면 없이 구동해 보관 정책 삭제를 1회 수행한다. 표준 출력 마지막 줄에 요약 한 줄, 종료 코드 0/1 |
| 보관 배치(자동) | 애플리케이션 상시 기동 중 자동 | 매일 00:10(한국 시간)에 **수동 실행과 똑같은 함수**를 부른다 |
| 스키마 적용 | `npm run migration:run` / `…:revert` | `backend/migrations/` 를 파일명 순으로 적용·되돌림. 파일마다 개별 트랜잭션 |

## 4. 백엔드 — 저장 구조

테이블은 정확히 **3개**다(`backend/migrations/0001_create_storage_tables.up.sql`). 물리적 외래키·논리 삭제 표시 컬럼을 두지 않는다.

| 테이블 | 키 | 담는 것 |
|---|---|---|
| `tbl_interlock_tracking` | 추적 키 | 연동 1건의 결과 코드·결과 시각·결과 확인 시각·콜백 수신 시각 |
| `tbl_consent_proof` | 자동 생성 식별자 | 동의 시점의 항목 내용 사본·동의한 항목 코드·동의 항목 버전 |
| `tbl_interlock_metric_daily` | 날짜 | 일자별 요청/성공/복호화실패/전달실패 건수 |

- 결과 코드는 `SUCCESS`·`DECRYPT_FAILED`·`DELIVERY_FAILED` 셋으로 제한된다.
- 결과 코드와 결과 시각은 **둘 다 있거나 둘 다 없어야** 한다(제약으로 강제).

## 5. 백엔드 — 기동 시 검증

두 검증이 있고 **실패 경로가 서로 다르다**. 자세한 동작은 [`README.md`](README.md) §설정 미충족 시의 동작.

1. **연동 구성 상수** (`backend/src/config/interlock-config.loader.ts`) — 애플리케이션을 만들기 **전에** 검사한다. 필수 8종은 `INTERLOCK_ENTRY_PATH`·`SELFCHECK_PATH`·`RECEIVER_DELIVERY_URL`·`CONSENT_ITEMS`·`RETENTION_MONTHS`·`RETENTION_MAX_MONTHS`·`CONSENT_PROOF_RETENTION_MONTHS`·`COMPLETION_REDIRECT_URL` 이며, `CONSENT_NOTICE` 는 선택이라 검사 대상이 아니다. 미충족 항목을 **모아서 한 번에** 알린다.
2. **데이터베이스 접속 값** (`backend/src/database/database.config.ts`) — 위 검사에 포함되지 않는 **별도 경로**다. 애플리케이션 구성 요소를 만드는 중에 검사되며, 필수 5종은 `DB_HOST`·`DB_PORT`·`DB_NAME`·`DB_USER`·`DB_PASSWORD` 다.
3. 검증을 통과하면 동의 항목 내용으로 **동의 항목 버전 식별자**를 계산해 고정한다(`backend/src/config/consent-version.ts`).

## 6. 프런트엔드 — 화면

주소는 **하나**(`<INTERLOCK_ENTRY_PATH>`)뿐이고, 화면 전환은 주소 이동이 아니라 **상태 전환**으로 일어난다(주소 라우팅 라이브러리를 쓰지 않는다). 전환 규칙은 `frontend/src/stage/transitions.ts` 에 순수 함수로 모여 있고, 조립은 `frontend/src/flow/InterlockJourney.tsx` 가 한다.

| 화면 | 구현 위치 | 역할 |
|---|---|---|
| 본인확인 | `frontend/src/flow/IdentityScreen.tsx` | 생년월일 6자리 입력. 형식 오류·불일치·재시도 안내 3종 |
| 동의·승인 | `frontend/src/flow/ConsentScreen.tsx` | 동의 항목 목록과 승인 버튼. 필수 미충족·서버 재검증 차단·재시도 안내 3종 |
| 진행 중 | `frontend/src/components/ProgressPanel.tsx` | 승인 발신 직후 표시. 응답을 못 받은 상태를 따로 표시한다 |
| 결과 | `frontend/src/components/ResultPanel.tsx` | 결과 3경로(완료·오류·전달실패) 표시와 복귀 주소 이동 |

## 7. 프런트엔드 — 사용자 흐름

1. **진입** — 백엔드가 화면 문서에 심어 보낸 초기 상태를 읽어 첫 화면을 정한다(`frontend/src/api/hydration.ts`). 초기 상태가 없거나 읽을 수 없으면 결과 화면(오류)으로 간다.
2. **본인확인** — 형식(숫자 6자리)을 화면에서 먼저 걸러 서버 호출을 아낀다. 서버 응답에 따라 동의 화면·결과 화면으로 가거나, 형식·불일치·재시도 안내를 띄우고 제자리에 남는다.
3. **동의·승인** — 필수 항목 미충족이면 서버를 부르지 않고 화면에서 막는다. 충족이면 **응답을 기다리지 않고 진행 중 화면으로 먼저 넘어간 뒤** 승인을 보낸다.
4. **승인 응답 처리** — 성공은 결과 화면, 본인확인 관련 오류는 본인확인 화면으로 되돌아가며(동의 선택은 비운다), 재시도 가능한 오류는 동의 화면으로 되돌아간다. **분류되지 않은 오류는 진행 중 화면에 머문다** — 결과가 이미 확정됐을 수 있어 재시도를 권하지 않는다.
5. **결과** — 연동 완료이고 복귀 주소가 유효할 때만 잠시 뒤 자동 이동하고, 수동 이동 링크도 함께 둔다. 이 화면에서 앞 화면으로 돌아가는 경로는 없다.

## 8. 프런트엔드 — 서버 호출 지점

호출은 **2곳뿐**이며 모두 `frontend/src/api/client.ts` 를 거친다.

| 호출 | 대상 접점 | 트리거 |
|---|---|---|
| 본인확인 제출 | 접점 2 | 본인확인 화면의 확인 |
| 승인 제출 | 접점 3 | 동의·승인 화면의 승인 |

- 서버 대면 API 3종과 자가진단 접점은 프런트엔드가 부르지 않는다(발송처·수신처가 직접 부르는 접점이다).
- ⚠️ **교차 확인 지점** — 진입 경로 값이 프런트엔드 번들에는 `frontend/src/api/constants.ts` 에 **고정된 문자열**로 들어가고, 백엔드에는 설정 값으로 들어간다. 두 출처가 다르므로 배포 시 값이 어긋나면 화면이 서버를 못 부른다.

## 9. 연동 라이브러리 — 공개 표면

공개 표면을 갖는 어셈블리는 `AccountInterlockHub.SenderSdk` 하나다. 함께 있는 콘솔 도구 2종은 내부용이라 공개 표면이 없다.

| 공개 요소 | 형태 | 하는 일 |
|---|---|---|
| `InterlockRequestBuilder` | 정적 클래스 | 라이브러리 진입점. 상태를 공유하지 않는다 |
| `InterlockRequestBuilder.ProtocolVersion` | 상수 | 구현한 연동 규약 버전. 허브 쪽 값과 같아야 한다 |
| `InterlockRequestBuilder.Encrypt` | 정적 메서드 | 전달 데이터를 암호화해 암호값 쌍을 만든다. 생년월일 형식·데이터 형태·크기 상한 위반은 규약 예외로 알린다 |
| `InterlockRequestBuilder.BuildRequestUrl` | 정적 메서드 | 허브 기준 주소와 암호값 쌍으로 연동 요청 주소를 조립한다. 주소 길이 상한 위반은 규약 예외로 알린다 |
| `EncryptedPair` | 값 객체 | 암호화 결과(`EncX`·`EncY`). 발송처가 직접 만들 수 없고 `Encrypt` 반환으로만 얻는다 |
| `InterlockProtocolException` | 예외 | 규약 위반 전용. `ReasonCode` 로 사유 코드를 노출한다 |

정의 위치는 `<LIB_SRC_DIR>AccountInterlockHub.SenderSdk/` 다.

## 10. 연동 라이브러리 — 부속 도구

| 도구 | 위치 | 하는 일 |
|---|---|---|
| 검증 하네스 | `<LIB_SRC_DIR>AccountInterlockHub.SenderSdk.Harness/` | 규약 테스트 벡터를 읽어 라이브러리 실제 출력과 대조한다. 요약(전체·통과·실패)과 종료 코드로 결과를 낸다. 발송처 전달 패키지에는 **호출 샘플** 형태로 동봉된다 |
| 벡터 생성기 | `<LIB_SRC_DIR>AccountInterlockHub.SenderSdk.VectorGen/` | 규약 테스트 벡터를 만든다. 기대값을 손으로 적지 않고 **실제 라이브러리를 불러 그 결과를 기록**한다. 저장소 내부 도구이며 배포 패키지에 넣지 않는다 |
| 대칭 확인 스크립트 | `<LIB_SRC_DIR>verify-roundtrip.js` | 라이브러리가 만든 암호값을 **허브 쪽 복호화 판정**에 넣어 원래 값으로 돌아오는지 확인한다. 백엔드가 먼저 빌드돼 있어야 한다 |

## 11. 규약 테스트 벡터

`<LIB_SRC_DIR>protocol-test-vectors.json` — 경계 **6종**을 1건씩 담는다. 같은 소스에서 다시 만들어도 같은 바이트가 나온다.

1. 키 원문이 32바이트 미만 (오른쪽 채움 경계)
2. 키 원문이 정확히 32바이트 (자르기·채움이 없는 경계)
3. 키 원문이 32바이트 초과 (앞 32바이트 자르기 경계)
4. 암호값에 주소 안전 치환 문자가 실제로 등장하는 경계
5. 평문이 크기 상한(1,024바이트) 바로 아래인 경계
6. 평문에 한글·이모지가 섞인 다중 바이트 경계

## 12. qa 가 유의할 대조 지점

구현 표면 중 **검증 케이스가 특히 누락되기 쉬운 자리**를 적는다.

1. **자가진단 접점은 경로 감시 대상에서 빠져 있다** — 방식이 어긋나도 405 가 아니라 본문 없는 404 로 끝난다(경로 존재를 숨기려는 의도된 설계). 다른 접점과 판정이 다르므로 케이스를 따로 둔다.
2. **진입 접점은 실패해도 오류 상태 코드를 내지 않는다** — 항상 화면 문서로 응답한다. 상태 코드로 실패를 판정하는 케이스는 이 접점에 적용되지 않는다.
3. **승인 접점의 분류되지 않은 오류는 진행 중 화면에 머문다** — 다른 오류와 달리 결과 화면으로 가지 않는다.
4. **보관 배치는 실행 경로가 둘(수동·자동)인데 본체 함수가 같다** — 성공·실패를 구분하는 수단만 경로별로 다르다(수동은 종료 코드, 자동은 요약 안의 실패 사유).
5. **진입 경로 값이 프런트엔드·백엔드에서 서로 다른 출처로 들어간다**(§8 교차 확인 지점).
6. **콜백 접점은 여러 번 받아도 결과가 같아야 한다**(최초 수신만 기록).
7. **결과 확인 표시는 최초 1회만 남는다** — 상태 확인을 두 번 부르면 두 번째부터 표시가 갱신되지 않아야 한다.
