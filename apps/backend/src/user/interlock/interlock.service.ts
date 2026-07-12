import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppException } from '../../common/envelope/app.exception';
import { ConsentService } from '../consent/consent.service';
import { DeliveryConfig, DeliveryService } from '../delivery/delivery.service';
import { InterlockHistoryService } from '../history/interlock-history.service';
import { ApproveDto } from './dto/approve.dto';
import { HubDecryptService } from './hub-decrypt.service';

/**
 * 사용자 연동 승인 오케스트레이션 서비스 — PROC-202(동의/거부·승인 게이팅) B3 → PROC-203(연동 실행) /
 * SVC-004·SVC-005 / USR-01·USR-02.
 *
 * `#214` 로 전면 재정의된 사용자 연동 실행 흐름의 단일 진입이다. 한 인터랙션(승인/거부 제출) = 1 PROC
 * (PROC-202)이며, 승인(AGREE·필수 충족) 시에만 내부적으로 PROC-203(복호화→이력→전달→상태)을 이어간다.
 * 접근 컨텍스트(encX·encY·birthDate)는 요청 본문으로만 수신하고 서버에 저장하지 않는다(무상태, DATA-001-04)
 * — 함수 인자·지역 변수는 요청 처리 종료와 함께 스코프에서 자연 해제된다(구 EntryContextStore 는 폐기).
 *
 * 계층 분리: 동의 게이팅(FN-008)은 ConsentService, 복호화(FN-020)는 HubDecryptService, 이력 생성(FN-016)은
 * InterlockHistoryService, 전달·상태 저장(FN-012→FN-009)은 DeliveryService 에 위임한다. 본 서비스는 PROC-202
 * B3~PROC-203 의 오케스트레이션(호출 순서·트랜잭션 경계 없음·예외 전파)만 담당한다.
 */

// PROC-202 B3b 재조회 — 승인 게이팅 통과 후 연동 실행에 필요한 활성 구성(수신처 B 주소·메서드).
interface ActiveDeliveryConfigRow {
  id: string;
  service_b_delivery_url: string;
  service_b_http_method: string;
}

// ENT-004/007 tracking_key varchar(255) — DB CHECK 500 을 사전 차단하는 애플리케이션 가드 상한.
const TRACKING_KEY_MAX_LEN = 255;

// POST /api/interlock/approve 응답 — 결과 유형만(상태 값·추적 키·복호화 원문 미노출, SEC-007-02).
export interface ApproveResponse {
  result: 'COMPLETED' | 'REJECTED';
}

@Injectable()
export class InterlockService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly consentService: ConsentService,
    private readonly hubDecryptService: HubDecryptService,
    private readonly interlockHistoryService: InterlockHistoryService,
    private readonly deliveryService: DeliveryService,
  ) {}

  /**
   * POST /api/interlock/approve — PROC-202 B2~B3. 승인 게이팅(FN-008) 후 승인 시 연동 실행(PROC-203)을
   * 이어간다. 거부·필수 미충족은 복호화를 수행하지 않고 200 REJECTED 로 정상 종료한다(BIZ-002-07).
   */
  async approve(dto: ApproveDto): Promise<ApproveResponse> {
    const now = new Date();

    // B2. FN-008 승인 게이팅 — 구성 매칭 근거 재검증·필수 동의 서버 재검증(BIZ-002-06, 화면 값 단독 신뢰 금지).
    const outcome = await this.consentService.processDecision(
      {
        accessAddressId: dto.accessAddressId,
        decision: dto.decision,
        requiredConsentMet: dto.requiredConsentMet,
      },
      now,
    );

    // B3a. 거부·필수 미충족 — 복호화 미수행, 처리상태·연동이력 미생성(EXC-BIZ-11). 감사는 FN-008 내부 기록.
    // encX·encY·birthDate(수신했더라도)는 아래로 전달하지 않고 여기서 함수 스코프 종료로 폐기된다(DATA-001-04).
    if (!outcome.approved) {
      return { result: 'REJECTED' }; // 200 정상 종료(EXC-BIZ-03)
    }

    // B3b. 승인 경로 — birthDate 존재 확인(AGREE 시 ApproveDto 가 NotBlank 보장, 방어적 가드).
    // encX·encY 는 부재·빈값·형식오류를 FN-020 이 EX-SEC-007 로 판정하므로(#238) 여기서 선차단하지 않고
    // 그대로 넘긴다 — DTO 가 부재를 EX-SEC-004 로 막지 않도록 완화한 것과 정합(단일 판정 지점 = FN-020).
    if (dto.birthDate == null) {
      throw new AppException('EX-SEC-004');
    }

    // 연동 실행에 필요한 활성 구성(수신처 B 주소·메서드) 재조회(PROC-202 B3b) — 게이팅 시점과 별도 조회.
    const configRows: ActiveDeliveryConfigRow[] = await this.dataSource.query(
      `SELECT id, service_b_delivery_url, service_b_http_method FROM "TBL_INTERLOCK_CONFIG"
       WHERE config_code = $1 AND is_active = true AND deleted_at IS NULL`, // UQ_CONFIG_CODE
      [dto.accessAddressId],
    );
    const configRow = configRows[0];
    if (!configRow) {
      throw new AppException('EX-SEC-004'); // 유효하지 않은 접근 주소 참조
    }
    const config: DeliveryConfig = {
      id: configRow.id,
      serviceBDeliveryUrl: configRow.service_b_delivery_url,
      serviceBHttpMethod: configRow.service_b_http_method,
    };

    await this.executeInterlock(config, dto.encX, dto.encY, dto.birthDate, dto.accessAddressId, now);

    return { result: 'COMPLETED' }; // 200 완료(복호화 원문·회원 키·추적 키 미포함, SEC-007-02)
  }

  /**
   * PROC-203 연동 실행 — 허브 복호화(FN-020) → 연동이력 생성(FN-016, 전달에 앞서) → 수신처 B 전달·상태
   * 저장(FN-012→FN-009). 승인 게이팅(FN-008 approved=true) 통과 후에만 도달하는 내부 호출 경로다(독립
   * 엔드포인트 아님) — trackingKey 자체가 복호화 성공 시에만 존재해 미승인 상태에서는 구조적으로 도달할
   * 수 없으므로 BIZ-003-06/07(미승인 전달 차단·역전이 금지) 런타임 assert 를 별도로 두지 않는다.
   */
  private async executeInterlock(
    config: DeliveryConfig,
    encX: string | undefined,
    encY: string | undefined,
    birthDate: string,
    accessAddressId: string,
    now: Date,
  ): Promise<void> {
    // FN-020 허브 복호화·연동 추적 키 추출 — 실패 시 EX-SEC-006/007·EX-BIZ-008 그대로 전파(이력·상태 미생성).
    const { X, trackingKey } = await this.hubDecryptService.decryptInterlock(
      encX,
      encY,
      birthDate,
      accessAddressId,
    );

    // 추적 키 길이 가드(ENT-004/007 tracking_key varchar(255)) — INSERT 이전에 확정해 DB CHECK 위반으로
    // 인한 500 을 사전에 차단한다(DATA-002-07 스키마 상한의 애플리케이션 측 반영, P2 리뷰 S-2 갭 해소).
    if (trackingKey.length > TRACKING_KEY_MAX_LEN) {
      throw new AppException('EX-BIZ-008'); // 발송처 데이터 오류(연동에 필요한 값이 없습니다) — 재입력 불가
    }

    // FN-016 연동이력 생성(복호화 후·전달에 앞서, BIZ-004-07).
    await this.interlockHistoryService.createInterlockHistory(trackingKey, config.id, now);

    // FN-012 수신처 B 서버-서버 전달(내부 FN-009 상태 저장 포함). 실패 시 EX-BIZ-004(502) 전파
    // (상태·이력은 이미 저장됨 — EXC-BIZ-06·EXC-BIZ-11).
    await this.deliveryService.deliverToServiceB(X, trackingKey, config, now);

    // 접근 컨텍스트·복호화 원문 폐기(DATA-001-04·SEC-005-06) — encX·encY·birthDate·X·trackingKey 는
    // 별도 저장소가 없어 본 메서드 반환과 함께 스코프에서 자연 해제된다(어떤 로그·응답에도 남기지 않음).
  }
}
