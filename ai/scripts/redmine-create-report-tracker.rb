# report 트래커 생성 (Redmine admin 1회 작업)
#
# 용도 : ai/strategies/work-tracking.md §작업 보고 가 요구하는 `report` 트래커를 생성한다.
#        트래커는 admin 전용이라 REST 로 만들 수 없어 서비스 호스트에서 rails runner 로 실행한다
#        (ai/strategies/work-tracking-redmine.md §트래커 구성).
#
# 실행 : Redmine 서비스 호스트(Docker) 에서
#          docker cp redmine-create-report-tracker.rb redmine:/tmp/
#          docker exec -e SECRET_KEY_BASE_DUMMY=1 redmine bin/rails runner /tmp/redmine-create-report-tracker.rb
#        Git Bash 는 /tmp 인자를 Windows 경로로 바꾸므로 MSYS_NO_PATHCONV=1 을 앞에 붙인다.
#
# 성질 : 멱등하다. 이미 있으면 만들지 않고 누락분(프로젝트 활성·워크플로 전이)만 채운다.

TRACKER_NAME   = 'report'
SOURCE_TRACKER = '작업세션'  # 워크플로 전이 복사 원본 (없으면 첫 번째 트래커로 폴백)
NEW_STATUS     = 1            # 신규
CLOSED_STATUS  = 5            # 완료(닫힘)

log = ->(msg) { puts "[report-tracker] #{msg}" }

# --- 1. 트래커 생성 --------------------------------------------------------
tracker = Tracker.find_by(name: TRACKER_NAME)
if tracker
  log.("이미 존재 — id=#{tracker.id} (생성 생략, 누락분만 보정)")
else
  tracker = Tracker.new(
    name:              TRACKER_NAME,
    default_status_id: NEW_STATUS,
    is_in_roadmap:     false,   # 보고는 로드맵 대상이 아니다
    description:       '작업 수행 이력 요약 보고 (산출물이 아니라 기록)'
  )
  # 표준 필드만 노출한다. core_fields 가 없는 구버전은 건너뛴다.
  if tracker.respond_to?(:core_fields=)
    tracker.core_fields = %w[project_id tracker_id subject description status_id parent_issue_id category_id]
  end
  tracker.save!
  log.("생성 완료 — id=#{tracker.id}")
end

# --- 2. 전 프로젝트 활성 ---------------------------------------------------
added = 0
Project.all.each do |project|
  next if project.trackers.include?(tracker)
  project.trackers << tracker
  added += 1
end
log.("프로젝트 활성 — 신규 #{added}개 / 전체 #{Project.count}개")

# --- 3. 워크플로 전이 복사 -------------------------------------------------
# 전이가 없으면 어떤 상태로도 못 바꾼다. 기존 트래커에서 통째로 복사한다.
if WorkflowTransition.where(tracker_id: tracker.id).empty?
  source = Tracker.find_by(name: SOURCE_TRACKER) || Tracker.where.not(id: tracker.id).order(:position).first
  if source
    WorkflowRule.copy(source, nil, tracker, nil)
    log.("워크플로 복사 — 원본 '#{source.name}'(id=#{source.id}), 전이 #{WorkflowTransition.where(tracker_id: tracker.id).count}건")
  else
    log.('경고 — 복사할 원본 트래커가 없다. 4단계에서 최소 전이만 생성한다')
  end
else
  log.("워크플로 전이 이미 존재 — #{WorkflowTransition.where(tracker_id: tracker.id).count}건 (복사 생략)")
end

# --- 4. 신규 → 완료 전이 보장 (이 스크립트의 핵심) -------------------------
# report 일감은 "등록과 동시에 완료" 로 만든다. 이 전이가 없으면 REST 로 status_id=5 를
# 보내도 Redmine 이 조용히 기본 상태(신규)로 떨어뜨리고, 열린 하위 일감이 남아
# 부모(작업세션 이슈·루프 그룹 일감)를 닫을 수 없게 된다.
# → work-tracking.md §등록 규칙(순서), work-tracking-redmine.md §도구 함정
unless IssueStatus.exists?(id: NEW_STATUS) && IssueStatus.exists?(id: CLOSED_STATUS)
  abort "[report-tracker] 중단 — 상태 id #{NEW_STATUS}(신규)·#{CLOSED_STATUS}(완료) 가 이 인스턴스에 없다. 상단 상수를 실제 id 로 고쳐 다시 실행할 것"
end

created = 0
Role.all.each do |role|
  next if WorkflowTransition.exists?(
    tracker_id: tracker.id, role_id: role.id,
    old_status_id: NEW_STATUS, new_status_id: CLOSED_STATUS
  )
  WorkflowTransition.create!(
    tracker_id: tracker.id, role_id: role.id,
    old_status_id: NEW_STATUS, new_status_id: CLOSED_STATUS,
    author: false, assignee: false
  )
  created += 1
end
log.("신규→완료 전이 — 신규 생성 #{created}건 / 역할 #{Role.count}개")

# --- 5. 검증·후속 안내 -----------------------------------------------------
ok = Role.all.all? do |role|
  WorkflowTransition.exists?(
    tracker_id: tracker.id, role_id: role.id,
    old_status_id: NEW_STATUS, new_status_id: CLOSED_STATUS
  )
end

puts ''
puts '=' * 68
log.("결과: 트래커 '#{TRACKER_NAME}' id=#{tracker.id}")
log.("      전 프로젝트 활성 #{Project.count}개 · 전이 #{WorkflowTransition.where(tracker_id: tracker.id).count}건")
log.("      신규→완료 전이 전 역할 보장: #{ok ? 'OK' : '실패 — 확인 필요'}")
puts ''
log.('후속 (워크스페이스 문서 기입 — 담당자):')
log.("  1) ai/strategies/work-tracking-redmine.md §요소 식별자 → `report=#{tracker.id}`")
log.("  2) 같은 문서 §프로젝트 생성 표준 절차 2번 tracker_ids 배열에 #{tracker.id} 추가")
log.('  3) 같은 문서 §트래커 구성 의 "미완 — `report` 트래커" 항목 제거')
log.('  4) 기존 프로젝트는 위 2단계에서 이미 활성화됐다 (PUT 재실행 불요)')
puts '=' * 68
