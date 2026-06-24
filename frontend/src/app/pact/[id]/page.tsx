'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { usePact, useSubmitEvidence, useSettle, useClaimExpired, useWithdraw, useWithdrawable } from '@/hooks/useContracts';
import { useWallet } from '@/context/WalletContext';
import {
  PACT_STATUS, statusLabel, statusClass,
  formatWei, formatDeadline, deadlinePassed, shortAddr,
} from '@/lib/genlayer';

export default function PactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pactId = parseInt(params.id as string);
  const { address: myAddress } = useWallet();

  const { pact, loading, error, refetch } = usePact(pactId);
  const { submitEvidence, loading: submitting } = useSubmitEvidence();
  const { settle, loading: settling } = useSettle();
  const { claimExpired, loading: expiring } = useClaimExpired();
  const { withdraw, loading: withdrawing } = useWithdraw();
  // Fix #4: show real withdrawable balance
  const withdrawable = useWithdrawable(myAddress ?? '');

  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [activeTab, setActiveTab] = useState<'evidence' | 'settle' | 'expired'>('evidence');
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', title: string, msg = '') => {
    setToast({ type, title, msg });
    setTimeout(() => setToast(null), 6000);
  };

  const handleSubmitEvidence = async () => {
    if (!evidenceUrl.startsWith('http')) { showToast('error', 'Invalid URL', 'Must start with http:// or https://'); return; }
    const res = await submitEvidence(pactId, evidenceUrl);
    if (res.success) {
      showToast('success', 'Evidence submitted!', 'Now click "Settle" to trigger AI judgment.');
      setEvidenceUrl('');
      refetch();
    } else {
      showToast('error', 'Failed to submit evidence', res.error ?? '');
    }
  };

  const handleSettle = async () => {
    showToast('info', 'AI is reading your evidence…', 'This may take 30–120 seconds. Please wait.');
    const res = await settle(pactId);
    if (res.success) {
      showToast('success', 'Settlement complete!', 'The AI has delivered its verdict.');
      refetch();
    } else {
      showToast('error', 'Settlement failed', res.error ?? '');
    }
  };

  const handleClaimExpired = async () => {
    const res = await claimExpired(pactId);
    if (res.success) {
      showToast('success', 'Claimed as expired!', 'Stake sent to beneficiary.');
      refetch();
    } else {
      showToast('error', 'Claim failed', res.error ?? '');
    }
  };

  const handleWithdraw = async () => {
    const res = await withdraw();
    if (res.success) {
      showToast('success', 'Withdrawn!', 'Funds sent to your address.');
    } else {
      showToast('error', 'Withdraw failed', res.error ?? '');
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="loading-state" style={{ marginTop: 80 }}>
          <div className="spinner" />
          <span style={{ color: 'var(--text-muted)' }}>Loading pact from GenLayer…</span>
        </div>
      </div>
    );
  }

  if (error || !pact) {
    return (
      <div className="page-wrapper">
        <Navbar />
        <div className="container" style={{ paddingTop: 60 }}>
          <div className="card" style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Pact not found</div>
            <div style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 14 }}>{error}</div>
            <button className="btn btn-secondary" onClick={() => router.push('/')}>← Back to all pacts</button>
          </div>
        </div>
      </div>
    );
  }

  const expired = deadlinePassed(pact.deadline);
  const isSettled = pact.status === PACT_STATUS.KEPT || pact.status === PACT_STATUS.BROKEN;
  const sc = statusClass(pact.status);

  return (
    <div className="page-wrapper">
      <Navbar />

      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <button
          id="btn-back"
          className="btn btn-secondary btn-sm"
          onClick={() => router.push('/')}
          style={{ marginBottom: 24 }}
        >
          ← All Pacts
        </button>

        <div className="detail-grid">
          {/* ── LEFT ── */}
          <div>
            {/* Pact info card */}
            <div className="card" style={{ marginBottom: 20 }}>
              <div className="info-row" style={{ marginBottom: 16 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>Pact #{pact.id}</span>
                <span className="info-dot" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Owner: {shortAddr(pact.owner)}</span>
                <span className="info-dot" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDeadline(pact.deadline)}</span>
                <span className="info-dot" />
                <span className={`status-badge ${sc}`}>{statusLabel(pact.status)}</span>
              </div>

              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, lineHeight: 1.35, marginBottom: 16, letterSpacing: '-0.5px' }}>
                {pact.promise}
              </h1>

              <div style={{ padding: '14px 16px', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', marginBottom: 20 }}>
                <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>Success criteria</div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{pact.criteria}</div>
              </div>

              {/* Stats row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {[
                  { label: 'Stake', value: formatWei(pact.stake), accent: true },
                  { label: 'Deadline', value: formatDeadline(pact.deadline), accent: false },
                  { label: 'Beneficiary', value: shortAddr(pact.beneficiary), accent: false },
                ].map(({ label, value, accent }) => (
                  <div key={label} style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                    <div className="pact-meta-label">{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: accent ? 'var(--gold-400)' : 'var(--text-secondary)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence URL (if submitted) */}
            {pact.evidence_url && (
              <div className="card" style={{ marginBottom: 20 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>📎 Submitted Evidence</div>
                <a
                  href={pact.evidence_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evidence-url"
                >
                  {pact.evidence_url}
                </a>
              </div>
            )}

            {/* Verdict panel */}
            {isSettled && (
              <div className={`verdict-panel ${pact.status === PACT_STATUS.KEPT ? 'kept' : 'broken'}`}>
                <div className="verdict-icon">
                  {pact.status === PACT_STATUS.KEPT ? '✅' : '❌'}
                </div>
                <div className="verdict-title">AI Verdict</div>
                <div className="verdict-result">
                  {pact.status === PACT_STATUS.KEPT ? 'KEPT' : 'BROKEN'}
                </div>

                {pact.confidence > 0 && (
                  <div className="confidence-bar-wrap" style={{ marginTop: 14 }}>
                    <div className="confidence-label">
                      <span>AI Confidence</span>
                      <span>{pact.confidence}%</span>
                    </div>
                    <div className="confidence-bar">
                      <div className="confidence-fill" style={{ width: `${pact.confidence}%` }} />
                    </div>
                  </div>
                )}

                {pact.reason && (
                  <div className="verdict-reason">💭 {pact.reason}</div>
                )}

                {/* Fix #4: single withdraw button with real balance */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
                    Your withdrawable balance:
                    <span style={{ color: 'var(--gold-400)', fontWeight: 700, marginLeft: 6 }}>
                      {myAddress ? formatWei(withdrawable) : 'Connect wallet to check'}
                    </span>
                  </div>
                  <button
                    className="btn btn-gold"
                    style={{ width: '100%', justifyContent: 'center' }}
                    onClick={handleWithdraw}
                    disabled={withdrawing || withdrawable === 0n || !myAddress}
                    id="btn-withdraw"
                  >
                    {withdrawing
                      ? <><span className="spinner-sm" /> Withdrawing…</>
                      : withdrawable === 0n
                        ? '💰 No Balance to Withdraw'
                        : `💰 Withdraw ${formatWei(withdrawable)}`}
                  </button>
                </div>
              </div>
            )}

            {/* AI settling state */}
            {settling && (
              <div className="ai-panel">
                <div className="ai-spinner" />
                <div className="ai-title">AI is analyzing your evidence…</div>
                <div className="ai-sub">Reading the URL · Calling LLM · Reaching validator consensus</div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>Usually takes 30–120 seconds</div>
              </div>
            )}
          </div>

          {/* ── RIGHT ── */}
          <div className="detail-sticky">
            {!isSettled && (
              <div className="card">
                {/* Tabs */}
                <div className="tabs" style={{ marginBottom: 20 }}>
                  <button
                    id="tab-evidence"
                    className={`tab ${activeTab === 'evidence' ? 'active' : ''}`}
                    onClick={() => setActiveTab('evidence')}
                  >
                    📝 Evidence
                  </button>
                  {pact.status === PACT_STATUS.SUBMITTED && (
                    <button
                      id="tab-settle"
                      className={`tab ${activeTab === 'settle' ? 'active' : ''}`}
                      onClick={() => setActiveTab('settle')}
                    >
                      🤖 Settle
                    </button>
                  )}
                  {expired && (
                    <button
                      id="tab-expired"
                      className={`tab ${activeTab === 'expired' ? 'active' : ''}`}
                      onClick={() => setActiveTab('expired')}
                    >
                      ⏰ Expired
                    </button>
                  )}
                </div>

                {/* Evidence tab */}
                {activeTab === 'evidence' && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Submit Proof</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.65 }}>
                      Paste a public URL where the AI can verify your promise was kept.
                      The page must be publicly accessible.
                    </div>

                    <div className="form-group">
                      <label className="form-label" htmlFor="input-evidence-url">Evidence URL</label>
                      <input
                        id="input-evidence-url"
                        type="url"
                        className="form-input"
                        placeholder="https://your-blog.com/posts"
                        value={evidenceUrl}
                        onChange={e => setEvidenceUrl(e.target.value)}
                      />
                      <div className="form-hint">
                        E.g. your blog, GitHub repo, Strava profile, LinkedIn post…
                      </div>
                    </div>

                    <button
                      id="btn-submit-evidence"
                      className="btn btn-gold"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleSubmitEvidence}
                      disabled={submitting || !evidenceUrl}
                    >
                      {submitting ? <><span className="spinner-sm" /> Submitting…</> : '📝 Submit Evidence'}
                    </button>

                    {pact.status === PACT_STATUS.SUBMITTED && (
                      <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--submitted-bg)', border: '1px solid var(--submitted-border)', borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--submitted-color)' }}>
                        ✓ Evidence already submitted. Go to the &ldquo;Settle&rdquo; tab to trigger AI judgment.
                      </div>
                    )}
                  </div>
                )}

                {/* Settle tab */}
                {activeTab === 'settle' && pact.status === PACT_STATUS.SUBMITTED && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>🤖 AI Settlement</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.65 }}>
                      The AI Intelligent Contract will:
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                      {[
                        '1. Read your evidence URL live from the web',
                        '2. Call an LLM to judge against your criteria',
                        '3. Reach multi-validator consensus on GenLayer',
                        '4. Pay out KEPT or BROKEN automatically',
                      ].map(step => (
                        <div key={step} style={{ display: 'flex', gap: 10, fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                          {step}
                        </div>
                      ))}
                    </div>

                    <div style={{ padding: 12, background: 'var(--submitted-bg)', border: '1px solid var(--submitted-border)', borderRadius: 'var(--radius-sm)', fontSize: 12, color: 'var(--submitted-color)', marginBottom: 16 }}>
                      ⚠️ This usually takes <strong>30–120 seconds</strong>. Do not close the page.
                    </div>

                    <button
                      id="btn-settle"
                      className="btn btn-gold"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleSettle}
                      disabled={settling}
                    >
                      {settling ? <><span className="spinner-sm" /> AI analyzing…</> : '🚀 Trigger AI Settlement'}
                    </button>
                  </div>
                )}

                {/* Expired tab */}
                {activeTab === 'expired' && expired && (
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>⏰ Claim as Expired</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.65 }}>
                      The deadline has passed without a KEPT verdict. Anyone can now claim this pact as expired — the stake will be sent to the beneficiary ({shortAddr(pact.beneficiary)}).
                    </div>
                    <button
                      id="btn-claim-expired"
                      className="btn btn-danger"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={handleClaimExpired}
                      disabled={expiring}
                    >
                      {expiring ? <><span className="spinner-sm" /> Processing…</> : '⏰ Claim Expired'}
                    </button>
                  </div>
                )}
              </div>
            )}


            {/* Owner / Beneficiary info */}
            <div className="card" style={{ marginTop: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🔎 Pact Details</div>
              {[
                { label: 'Owner', value: pact.owner || '—' },
                { label: 'Beneficiary', value: pact.beneficiary || '—' },
                { label: 'Contract', value: process.env.NEXT_PUBLIC_PACTKEEPER_CONTRACT_ADDRESS || '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 10 }}>
                  <div className="pact-meta-label">{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)', wordBreak: 'break-all', marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span className="toast-icon">
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            <div>
              <div className="toast-title">{toast.title}</div>
              {toast.msg && <div className="toast-msg">{toast.msg}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
