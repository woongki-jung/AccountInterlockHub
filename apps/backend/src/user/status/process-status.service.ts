import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * 처리 상태 저장 서비스 — FN-009_saveStatus(저장 부분) / 내부 PROC-401(PROC-203·FN-012 호출) /
 * ENT-004(TBL_INTERLOCK_PROCESS_STATUS).
 *
 * 복호화 성공 후 연동 실행 결과가 확정되는 시점(수신처 B 전달 성공·실패 모두)에 처리 상태 1건을 INSERT 하는
 * 종착(persistence) 유닛이다. 저장 항목은 연동 추적 키·구성 참조·상태 4항목(is_success·is_result_confirmed·
 * processed_at·result_confirmed_at)으로 한정하며 회원 키·개인식별 컬럼을 원천 배제한다(DATA-001-05·
 * DATA-003-04). 결과 확인 갱신(is_result_confirmed→true)은 조회 API(PROC-301, 후속 P7~9 phase) 소관이라
 * 본 서비스는 저장만 수행한다 — 생성 시 미확인(false)·확인 일시 NULL 로 고정한다.
 *
 * `#214` 로 조회·저장 키가 구 요청 키값(request_key PK)에서 연동 추적 키(tracking_key, 비유니크 조회
 * 인덱스) + 내부 surrogate uuid `id`(PK)로 전환됐다(ENT-004 §키 설계).
 *
 * DB 접근은 파라미터 바인딩만 사용한다(SEC-004-02). 단건 INSERT(자체 트랜잭션). created_at 은 DB 기본값
 * now() 가 채운다. ENT-004 CHECK(is_result_confirmed=false ⇒ result_confirmed_at NULL) 정합을 만족시키기
 * 위해 result_confirmed_at 을 명시 NULL 로 삽입한다.
 */

// FN-009 저장 입력(MDL-301 부분집합, 개인정보 미포함).
export interface SaveStatusInput {
  trackingKey: string; // 연동 추적 키(X 에서 추출한 불투명 원문, 조회 인덱스 — PK 아님)
  configId: string; // 연동 구성 참조(ENT-001.id)
  isSuccess: boolean; // 처리 성공 여부(true=전달 성공, false=전달 실패)
  processedAt: Date; // 처리 일시(연동 실행 결과 확정 시각)
}

@Injectable()
export class ProcessStatusService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * 처리 상태 1건 저장(FN-009_saveStatus, PROC-203→FN-012 경유). 전달 성공·실패 모두 1건 생성한다
   * (EXC-DATA-03·EXC-BIZ-06). INSERT 오류는 상위로 전파되어 전역 필터에서 EX-FN-999(500)로 종결된다.
   */
  async saveStatus(input: SaveStatusInput): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO "TBL_INTERLOCK_PROCESS_STATUS"
         (id, tracking_key, config_id, is_success, is_result_confirmed, processed_at, result_confirmed_at)
       VALUES (gen_random_uuid(), $1, $2, $3, false, $4, null)`, // surrogate PK — is_result_confirmed=false·result_confirmed_at=null(CHECK 정합)
      [input.trackingKey, input.configId, input.isSuccess, input.processedAt],
    );
  }
}
