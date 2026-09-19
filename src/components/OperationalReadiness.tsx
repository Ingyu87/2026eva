"use client";
import { useEffect, useState } from 'react';

type Check = { name: string; configured: boolean; next: string };
export function OperationalReadiness() {
  const [checks, setChecks] = useState<Check[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function refresh() {
    setLoading(true); setError('');
    try {
      const payload = await fetch('/api/admin/readiness').then(r => r.json());
      if (!payload.ok) throw new Error(payload.error);
      setChecks(payload.data.checks);
    } catch (err) { setError(err instanceof Error ? err.message : '확인하지 못했습니다.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  return <section className="ra-section">
    <h2 className="ra-title">운영 준비 확인</h2>
    <p className="ws-hint">설정 유무를 확인합니다. ‘설정 있음’은 실제 연결·문서 검증을 통과했다는 뜻이 아닙니다. 비밀값은 화면에 표시하지 않습니다.</p>
    {checks.map(check => <div key={check.name}><strong>{check.name} · {check.configured ? '설정 있음' : '설정 필요'}</strong><p className="ws-hint">{check.next}</p></div>)}
    <button type="button" className="ws-btn ws-btn--soft" disabled={loading} onClick={() => void refresh()}>{loading ? '확인 중…' : '설정 상태 다시 확인'}</button>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
