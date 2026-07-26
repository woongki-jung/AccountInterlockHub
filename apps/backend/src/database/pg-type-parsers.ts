import { types } from 'pg';

/**
 * pg 기본 타입 파서 보정. 이 파일을 import 하는 시점(모듈 로드 부수효과)에 프로세스 전역으로 적용된다.
 *
 * OID 1082(DATE) — pg 기본 파서는 `new Date(year, month - 1, day)` 로 JS Date 를 생성한다. 이는
 * UTC 자정이 아니라 프로세스 로컬 자정 기준이라, 로컬 시간대가 UTC 보다 빠른 환경(예: 이 서버의
 * Asia/Seoul, UTC+9)에서 그 값을 ISO(UTC) 로 직렬화하면 하루가 밀려 표시된다(실측: 입력
 * '2026-07-25' → new Date(2026, 6, 25) 생성 → toISOString() 이 '2026-07-24T15:00:00.000Z' 를
 * 반환). ENT-003.metric_date 는 Asia/Seoul 고정 경계로 이미 확정된 'YYYY-MM-DD' 문자열이므로
 * (data_ENT-003.md §일자 경계 기준) 원문 문자열을 그대로 반환하도록 재정의해
 * MDL-003.metricDate(string(date)) 형태와 정확히 일치시킨다.
 */
const PG_TYPE_OID_DATE = 1082;
types.setTypeParser(PG_TYPE_OID_DATE, (value: string) => value);

// OID 20(BIGINT/INT8) — pg 기본 파서는 문자열로 반환한다(Number 안전 정수 범위 초과를 막기 위한
// pg 의 기본 정책이며 재정의하지 않는다). request_count 등 카운터 컬럼은 도메인 모델 변환 지점
// (entities/interlock-metric-daily.model.ts)에서 Number() 로 바꾼다 — 삭제 없는 누적이라도
// 실무 규모에서 안전 정수 범위(2^53)를 벗어나지 않는다.
