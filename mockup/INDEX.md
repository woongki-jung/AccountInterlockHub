# 목업 인덱스 — AccountInterlockHub

확정 화면 사양([`../docs/specs/screens/`](../docs/specs/screens/))을 반영한 **UI 중심 경량 목업**(버려지는 static HTML)이다. 실코드·비즈니스 로직·실 API 없음. 화면 외형·흐름·상태(정상/Loading/Empty/Error)만 시각화한다. 데이터는 모두 명백한 더미값이다.

## 열람 방법

- 각 `SCR-00X.html` 파일을 브라우저로 직접 연다(로컬 파일, 서버 불필요). 진입점은 관리자 흐름 `SCR-001.html`, 사용자 흐름 `SCR-005.html` 권장.
- 각 화면 상단의 **검은색 "상태 시연" 바**는 목업 전용 도구다(제품 UI 아님). 버튼으로 정상/Loading/Empty/Error 등 상태를 전환해 확인한다.
- 화면 전환은 실제 링크(`<a href>`)로 연결되어 목록→상세→편집, 동의→결과 흐름을 클릭으로 따라갈 수 있다.

## 화면 목록

| 파일 | 화면명 | SCR 코드 | 경로 | 관련 IA | 레이아웃 |
|------|--------|----------|------|---------|----------|
| [SCR-001.html](SCR-001.html) | 관리자 로그인 | SCR-001 | `/admin/login` | ADM-03 | 중앙 카드(480px) |
| [SCR-002.html](SCR-002.html) | 연동 구성 목록 | SCR-002 | `/admin/configs` | ADM-02 | 관리자 셸(1120px) |
| [SCR-003.html](SCR-003.html) | 연동 구성 등록·편집 폼 | SCR-003 | `/admin/configs/new`·`/:id/edit` | ADM-01 | 관리자 셸(1120px) |
| [SCR-004.html](SCR-004.html) | 연동 구성 상세 | SCR-004 | `/admin/configs/:id` | ADM-02 | 관리자 셸(1120px) |
| [SCR-005.html](SCR-005.html) | 사용자 이용 동의 | SCR-005 | `/consent/:requestKey` | USR-01 | 중앙 카드(480px) |
| [SCR-006.html](SCR-006.html) | 동의 결과 | SCR-006 | `/consent/:requestKey/result` | USR-02 | 중앙 카드(480px) |

> API-01(처리상태 확인 API)·BAT-01·BAT-02(배치)는 화면이 없어 목업 대상이 아니다.

## 화면 흐름 요약

**관리자 흐름**

1. SCR-001 로그인 성공 → SCR-002 목록.
2. SCR-002 목록 "연동 구성 등록" → SCR-003(신규), 행(구성명) 클릭 → SCR-004 상세.
3. SCR-004 상세 "편집" → SCR-003(편집), 저장 성공 → SCR-004 복귀.
4. SCR-004 상세 "삭제" 확정 → SCR-002 목록 복귀.
5. 모든 관리자 화면에서 세션 만료 → SCR-001(`?expired=1`) 재인증 유도(SCR-001 "세션만료 안내" 상태로 시연).

**사용자 흐름**

1. 서비스 A 진입(`/interlock/entry`) → 요청 키값 발급 → SCR-005 이용 동의 유입(선행 화면은 목업 범위 밖).
2. SCR-005 동의/거부 제출 → SCR-006 동의 결과(`?result=success|reject`로 상태 전달 시연).
3. SCR-006 은 동의 완료/거부 종료/전달 실패/Fallback 결과를 표시하고 강제 이동을 하지 않는다.

## 화면 ↔ SCR ↔ 상태 매핑

| SCR | 화면 | 시연한 상태(상태 시연 바) | 주요 컴포넌트 |
|-----|------|--------------------------|---------------|
| SCR-001 | 관리자 로그인 | Initial · Loading · 세션만료 안내 · 인증실패(401) · 계정잠금(423) · IP차단(403) | Card · TextField · Banner · Button(primary) |
| SCR-002 | 연동 구성 목록 | Initial(Skeleton) · Loaded · Empty · Error | AdminNav · Table · Badge · Toggle · Modal(삭제) · Toast · EmptyState |
| SCR-003 | 등록·편집 폼 | 폼 · 편집 로드(Skeleton) · Submitting / 오류: 검증(422)·중복(409)·형식(400·413) · 모드: 등록/편집 | TextField · Select · Toggle · RepeatableRows(파라미터·동의) · Banner(개인정보 경고) · Toast |
| SCR-004 | 연동 구성 상세 | Initial(Skeleton) · Loaded · 대상 없음 · Error | Card · Badge · Toggle · Table(파라미터·동의) · Modal(삭제) · Toast |
| SCR-005 | 사용자 이용 동의 | Initial(Skeleton) · Loaded · Submitting · 키/컨텍스트 오류(400) · 요청제한(429) | Card · Checkbox 목록 · Button(primary/secondary) · Banner |
| SCR-006 | 동의 결과 | 동의완료(success) · 거부종료(info) · 전달실패(502) · Fallback(직접 진입) | Card · Badge · Banner |

## 반영한 디자인

[`../docs/specs/screens/design-system.md`](../docs/specs/screens/design-system.md) 토큰을 하드코딩 반영: primary #2563EB / danger #DC2626 / success #16A34A / text #111827, 간격 4·8·12·16·24·32·48px, 라운딩 4·8·12px, 타이포 display28/h1 22/h2 18/body15/label14/caption13. 관리자 셸=헤더(AdminNav)+1120px 컨테이너, 사용자 셸=중앙 카드 480px.
