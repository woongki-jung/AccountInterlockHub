/*
 * SCR-004 연동 구성 상세 — 스텁(플레이스홀더).
 * SCR-003 저장 성공 시 이동 대상(/admin/configs/:id)을 확보하기 위한 최소 화면이다.
 * 실제 상세 표시·활성 전환·삭제·편집 이동은 후속 Phase(ADM-P7)에서 GET 상세(PROC-102)와 함께 구현한다.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { AdminShell, Banner, Button, Card } from '../components';

export function ConfigDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  return (
    <AdminShell>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 24px' }}>연동 구성 상세</h1>
      <Card>
        <Banner variant="info">
          저장이 완료되었습니다. 연동 구성 상세 화면(SCR-004)은 후속 단계(ADM-P7)에서 구현됩니다.
        </Banner>
        <p style={{ color: 'var(--color-text-muted)', marginTop: 16 }}>대상 구성 ID: {id}</p>
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <Button variant="secondary" onClick={() => navigate('/admin/configs')}>
            목록으로
          </Button>
          <Button variant="ghost" onClick={() => navigate(`/admin/configs/${id}/edit`)}>
            편집
          </Button>
        </div>
      </Card>
    </AdminShell>
  );
}

export default ConfigDetailPage;
