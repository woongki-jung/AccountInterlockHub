import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 처리 상태 저장 서비스 — PROC-401 / FN-009_saveStatus / ENT-004(TBL_INTERLOCK_PROCESS_STATUS).
 *
 * 연동 실행 결과 확정 시(전달 성공·실패·거부 미전달 모두) 처리 상태 1건을 INSERT 하는 종착(persistence) 유닛이다.
 * 저장 항목은 요청 키값·구성 참조·상태 4항목(is_success·is_result_confirmed·processed_at·result_confirmed_at)으로
 * 한정하며 회원 키·개인식별 컬럼을 원천 배제한다(DATA-001-02·DATA-003-01). 결과 확인 갱신(is_result_confirmed→true)은
 * 조회 API Phase(PROC-301) 소관이라 본 Phase 는 저장만 수행한다 — 생성 시 미확인(false)·확인 일시 NULL 로 고정한다.
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 단건 INSERT(자체 트랜잭션). PK(request_key) 유니크로 중복 방지.
 * created_at 은 DB 기본값 now() 가 채운다. ENT-004 CHECK(is_result_confirmed=false ⇒ result_confirmed_at NULL) 정합을
 * 만족시키기 위해 result_confirmed_at 을 명시 NULL 로 삽입한다.
 */

// FN-009 저장 입력(MDL-301 부분집합, 개인정보 미포함).
export interface SaveStatusInput {
  requestKey: string; // 요청 키값(PK, 허브 발급 UUID v4)
  configId: string; // 연동 구성 참조(ENT-001.id)
  isSuccess: boolean; // 처리 성공 여부(true=전달 성공, false=실패·거부 미전달)
  processedAt: Date; // 처리 일시(연동 실행 결과 확정 시각)
}

@Injectable()
export class ProcessStatusService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * 처리 상태 1건 저장(PROC-401 B1). 성공·실패·거부 모두 1건 생성(EXC-DATA-03·EXC-BIZ-06).
   * INSERT 오류(PK 중복 포함)는 상위로 전파되어 전역 필터에서 EX-FN-999(500)로 종결된다.
   */
  async saveStatus(input: SaveStatusInput): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "TBL_INTERLOCK_PROCESS_STATUS"
         (request_key, config_id, is_success, is_result_confirmed, processed_at, result_confirmed_at)
       VALUES ($1, $2, $3, false, $4, null)`, // is_result_confirmed=false·result_confirmed_at=null(CHECK 정합). created_at=DB now()
      [input.requestKey, input.configId, input.isSuccess, input.processedAt],
    );
  }
}
