-- 0001_create_storage_tables.down.sql
-- 0001_create_storage_tables.up.sql 을 되돌린다. 물리 FK 가 없어 순서 의존은 없으나
-- 생성 역순으로 정리한다. IF EXISTS 로 재실행해도 안전(멱등)하다.

DROP TABLE IF EXISTS tbl_interlock_metric_daily;
DROP TABLE IF EXISTS tbl_consent_proof;
DROP TABLE IF EXISTS tbl_interlock_tracking;
