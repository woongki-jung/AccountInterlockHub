import { types } from 'pg';

/**
 * pg 기본 타입 파서 보정. 이 파일을 import 하는 시점(모듈 로드 부수효과)에 프로세스 전역으로 적용된다.
 *
 * OID 1082(DATE) — pg 기본 파서는 UTC 자정 기준 JS Date 로 변환해, 로컬 시간대 재해석에 따라
 * 표시 일자가 하루 밀리는 사고가 흔하다. ENT-003.metric_date 는 Asia/Seoul 고정 경계로 이미 확정된
 * 'YYYY-MM-DD' 문자열이므로(data_ENT-003.md §일자 경계 기준) 원문 문자열을 그대로 반환하도록 재정의해
 * MDL-003.metricDate(string(date)) 형태와 정확히 일치시킨다.
 */
const PG_TYPE_OID_DATE = 1082;
types.setTypeParser(PG_TYPE_OID_DATE, (value: string) => value);

// OID 20(BIGINT/INT8) — pg 기본 파서는 문자열로 반환한다(Number 안전 정수 범위 초과를 막기 위한
// pg 의 기본 정책이며 재정의하지 않는다). request_count 등 카운터 컬럼은 도메인 모델 변환 지점
// (entities/interlock-metric-daily.model.ts)에서 Number() 로 바꾼다 — 삭제 없는 누적이라도
// 실무 규모에서 안전 정수 범위(2^53)를 벗어나지 않는다.
