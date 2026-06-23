'use client';
import Link from 'next/link';
import { useState } from 'react';
import Navbar from '@/components/Navbar';
import CreatePactModal from '@/components/CreatePactModal';
import { useAllPacts } from '@/hooks/useContracts';
import { Pact, statusLabel, statusClass, formatWei, formatDeadline, PACT_STATUS } from '@/lib/genlayer';

export default function HomePage() {
  const { pacts, loading, error, refetch } = useAllPacts();
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'submitted' | 'kept' | 'broken'>('all');

  const filtered = pacts.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'active') return p.status === PACT_STATUS.ACTIVE;
    if (filter === 'submitted') return p.status === PACT_STATUS.SUBMITTED;
    if (filter === 'kept') return p.status === PACT_STATUS.KEPT;
    if (filter === 'broken') return p.status === PACT_STATUS.BROKEN;
    return true;
  });

  return (
    <div className="page-wrapper">
      <Navbar />

      {/* ── Hero ── */}
      <section className="hero">
        <div className="container">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            AI-enforced commitments · GenLayer Studionet
          </div>

          <h1 className="hero-title">
            Keep your promises<br />
            <span className="hero-title-gold">or pay the price.</span>
          </h1>

          <p className="hero-subtitle">
            Stake money on your personal goals. Submit evidence when done.
            A GenLayer Intelligent Contract reads your evidence from the live web
            and an LLM judges whether you kept your word — no human arbitrator.
          </p>

          <div className="hero-cta">
            <button
              id="btn-create-pact"
              className="btn btn-gold btn-lg"
              onClick={() => setShowCreate(true)}
            >
              🔒 Create a Pact
            </button>
            <a
              href="https://github.com/tranhop26/pactkeeper"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-lg"
            >
              📖 View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section style={{ padding: '0 0 56px' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { icon: '🔒', step: '01', title: 'Make a Pact', desc: 'Write your promise and success criteria. Stake GLT. Name a beneficiary.' },
              { icon: '📝', step: '02', title: 'Submit Evidence', desc: 'When done, paste a public URL proving you kept your word (blog, GitHub, Strava…).' },
              { icon: '🤖', step: '03', title: 'AI Judges', desc: 'The contract reads your URL live and an LLM decides: KEPT or BROKEN.' },
              { icon: '💰', step: '04', title: 'Settle', desc: 'KEPT → stake back to you. BROKEN → stake to your beneficiary.' },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} className="card" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                <div style={{ fontSize: 11, color: 'var(--gold-500)', fontWeight: 700, letterSpacing: 1, marginBottom: 6 }}>STEP {step}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pacts list ── */}
      <section style={{ flex: 1, paddingBottom: 80 }}>
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">All Pacts</h2>
            <span className="section-count">{filtered.length} pact{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Filter tabs */}
          <div className="tabs" style={{ marginTop: 16, marginBottom: 24 }}>
            {(['all', 'active', 'submitted', 'kept', 'broken'] as const).map(f => (
              <button
                key={f}
                id={`filter-${f}`}
                className={`tab ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' :
                 f === 'active' ? '🔵 Active' :
                 f === 'submitted' ? '🟡 Submitted' :
                 f === 'kept' ? '✅ Kept' : '❌ Broken'}
              </button>
            ))}
          </div>

          {loading && (
            <div className="loading-state">
              <div className="spinner" />
              <span style={{ color: 'var(--text-muted)' }}>Loading pacts from GenLayer…</span>
            </div>
          )}

          {error && (
            <div className="card" style={{ borderColor: 'var(--broken-border)', textAlign: 'center', padding: 48 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
              <div style={{ color: 'var(--broken-color)', fontWeight: 600, marginBottom: 8 }}>Unable to connect to contract</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20 }}>{error}</div>
              <button className="btn btn-secondary" onClick={refetch}>Retry</button>
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">🤝</div>
              <div className="empty-state-title">{pacts.length === 0 ? 'No pacts yet' : 'No pacts match this filter'}</div>
              <div className="empty-state-sub">
                {pacts.length === 0
                  ? 'Be the first to create a self-staked commitment enforced by AI on GenLayer.'
                  : 'Try a different filter to see other pacts.'}
              </div>
              {pacts.length === 0 && (
                <button className="btn btn-gold" onClick={() => setShowCreate(true)}>
                  🔒 Create First Pact
                </button>
              )}
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="pacts-grid">
              {filtered.map(p => <PactCard key={p.id} pact={p} />)}
            </div>
          )}
        </div>
      </section>

      {showCreate && (
        <CreatePactModal
          onClose={() => setShowCreate(false)}
          onSuccess={() => { setShowCreate(false); refetch(); }}
        />
      )}
    </div>
  );
}

function PactCard({ pact }: { pact: Pact }) {
  const sc = statusClass(pact.status);
  const cardBorderClass = `pact-card-${['active','submitted','kept','broken'][pact.status]}`;

  return (
    <Link href={`/pact/${pact.id}`} className="card-link">
      <div className={`card ${cardBorderClass}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <span className={`status-badge ${sc}`}>{statusLabel(pact.status)}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>#{pact.id}</span>
        </div>

        <p className="pact-promise">{pact.promise}</p>

        <div style={{ flex: 1 }} />

        <div className="pact-meta">
          <div className="pact-meta-item">
            <span className="pact-meta-label">Stake</span>
            <span className="stake-value">{formatWei(pact.stake)}</span>
          </div>
          <div className="pact-meta-item">
            <span className="pact-meta-label">Deadline</span>
            <span className="pact-meta-value">{formatDeadline(pact.deadline)}</span>
          </div>
          {pact.status === PACT_STATUS.KEPT || pact.status === PACT_STATUS.BROKEN ? (
            <div className="pact-meta-item">
              <span className="pact-meta-label">Confidence</span>
              <span className="pact-meta-value">{pact.confidence}%</span>
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
