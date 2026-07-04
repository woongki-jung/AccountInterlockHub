# React·JSX 안티패턴 검출 세부 지침

본 문서는 [code-reviewer](../../code-reviewer.md) 에이전트가 React·JSX 기반 코드 (Vite·Next.js 등 포함)를 검토할 때 사용하는 세부 지침이다.
무한 리렌더·메모리 누수·StrictMode 비호환·Concurrent rendering 비호환을 유발하는 안티패턴이 발견되면 **반드시 Critical 또는 Important 로 분류하여 보완을 지시**한다.

# 검출 대상 안티패턴

## 1. useEffect 를 통한 lifting state up

자식의 derived state 를 부모 setter 로 useEffect 동기화하는 패턴이다.

- **패턴**: `useEffect(() => { onChange?.(state); }, [state, onChange])`.
- **문제**: 부모 setter 호출 → 부모 리렌더 → 자식 리렌더 → 의존성 참조 변동 → useEffect 재발화 → 무한 루프.
- **권장 대안**:
  - controlled component 패턴 (setter 호출 시점에 부모 콜백 즉시 호출 — 예: 자식의 `onChange` 를 setter 핸들러에서 직접 호출).
  - `useImperativeHandle` + 부모 ref 로 제출·확정 시점에 명시 조회 (예: 자식이 `getValue()` 를 ref 로 노출).
  - 부모가 자식 state 를 직접 소유 (callback handlers 를 통한 lifting state up).
- **공식 가이드**: [Avoid: passing data up to the parent in an Effect](https://react.dev/learn/you-might-not-need-an-effect#avoid-passing-data-up-to-the-parent-in-an-effect).

## 2. 매 렌더 새 참조 생성 (모듈 상수 미추출)

함수가 매 호출마다 새 배열·객체 참조를 반환하는 패턴이다.

- **패턴**: 컴포넌트 함수 또는 일반 함수 안에서 `return [];` `return {};` `return [...src];` 등.
- **문제**: 반환값이 useMemo·useEffect·useCallback 의존성에 들어가면 매 렌더 의존성 비교가 false → Hook 무효화 캐스케이드.
- **권장 대안**: 모듈 레벨 상수로 추출(`const EMPTY_X: readonly T[] = []`) 또는 `useMemo` 로 안정 참조 보장.

## 3. useEffect 의존성에 useMemo·useCallback 결과(참조형) 포함 + 부수효과 호출

- **패턴**: `useEffect(() => { sideEffect(memoizedValue); }, [memoizedValue, ...])` — memoizedValue 의존성 중 하나만 흔들려도 useEffect 가 발화.
- **문제**: 의존성 안정성에 의존한 동작은 한 가지 trigger 만 흔들려도 무한 루프 진입.
- **권장 대안**: 부수효과를 useEffect 밖 이벤트 핸들러로 이동 / `useImperativeHandle` 로 명시 조회 / 부수효과 자체를 제거 (파생 계산은 useMemo 결과만 사용).

## 4. useEffect 안에서 부모 setter·props 콜백 직접 호출

§1 과 유사하나 derived state 가 아닌 단순 lifting 까지 포함한다.

- **검출 범위**: 의존성과 무관하게 **useEffect 콜백 본문 안의 `onSomething?.(...)` `setParent(...)` 호출은 모두 의심 대상**.
- **안전 예외**: 의존성이 **원시값(number·string·boolean)** 이고 단발성 알림 용도일 때만 허용.
  - 예: `onCountChange?.(count)` with `[count]` deps.

## 5. setState updater 함수 안에서 부수효과 호출

- **패턴**: `setState((prev) => { onChange?.(next); return next; })`.
- **문제**: React StrictMode 에서 updater 가 2 회 실행될 수 있어 부수효과도 2 회 발생.
- **추가 위험**: Concurrent rendering 비호환.
- **권장 대안**: 부수효과를 setState 호출 외부로 분리.
  - `const next = compute(prev); setState(next); onChange?.(next);`

## 6. useCallback·useMemo 의존성 누락 또는 불안정 참조 의존

- 의존성 lint 경고(`react-hooks/exhaustive-deps`)를 `eslint-disable` 로 묵인하는 경우 **반드시 사유 주석을 동반**해야 한다.
- 사유가 없으면 보완을 지시한다.
- 의도적 disable 시 한 줄 주석으로 "왜 의존성에서 빼는지" 명시한다.
  - 예: stale closure 방지, 호출처 안정 보장 등.

# 검토 절차

- ⬜ 변경된 `.tsx`·`.ts`·`.jsx`·`.js` 파일에서 `useEffect\(` 정규식 grep → 모든 useEffect 본문 안 콜백 호출·setter 호출 확인.
- ⬜ 컴포넌트 함수 안 `return \[\]` `return \{\}` 정규식 grep → 모듈 상수 추출 권고.
- ⬜ `forwardRef` `useImperativeHandle` 도입이 lifting useEffect 를 대체할 수 있는 위치인지 검토.
- ⬜ 발견된 안티패턴은 **Critical**(무한 루프 가능 시) 또는 **Important**(잠재 위험 시)로 분류하여 명확한 수정 가이드(코드 예시 포함)를 제시.

# 자동화 가드와의 관계

- 정적 정책 가드 스크립트(프로젝트에 있는 경우 — 예: useEffect 안 `.mutate()` 검출)는 본 문서 §1·§4 의 **부분집합만 자동 검출**한다.
- 매 렌더 새 참조(§2)·setState updater 부수효과(§5)·의존성 사유 주석(§6) 등은 **수동 코드 리뷰가 보완 책임**을 진다.

# 참조

- 본 검토 항목은 실제 React 화면에서 발생한 무한 리렌더링 결함 대응으로 정리한 안티패턴 모음이다.
- 적용 대상 스택: React 18+·React 19·Next.js·Vite·React Native 등 React 컴포넌트 모델을 사용하는 모든 프로젝트.
