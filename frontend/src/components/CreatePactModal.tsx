'use client';
import { useState } from 'react';
import { parseEther, isAddress } from 'viem';
import { useCreatePact } from '@/hooks/useContracts';
import { useWallet } from '@/context/WalletContext';

const DEMO_BENEFICIARY = '0x000000000000000000000000000000000000dEaD';

const EXAMPLES = [
  {
    promise: 'I will publish 10 blog posts within 30 days.',
    criteria: 'My blog at the submitted URL shows at least 10 posts published after today\'s date.',
  },
  {
    promise: 'I will run 100 km this month logged on Strava.',
    criteria: 'My Strava profile at the submitted URL shows ≥100 km of running activities this month.',
  },
  {
    promise: 'I will ship an open-source project with at least 5 commits this week.',
    criteria: 'The GitHub repo at the submitted URL shows ≥5 commits by me in the last 7 days.',
  },
];

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreatePactModal({ onClose, onSuccess }: Props) {
  const { createPact, loading, error } = useCreatePact();
  const { address: myAddress } = useWallet();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [promise, setPromise] = useState('');
  const [criteria, setCriteria] = useState('');
  const [beneficiary, setBeneficiary] = useState(DEMO_BENEFICIARY);
  const [deadlineDays, setDeadlineDays] = useState('30');
  const [stakeGLT, setStakeGLT] = useState('0.1');

  const loadExample = (i: number) => {
    setPromise(EXAMPLES[i].promise);
    setCriteria(EXAMPLES[i].criteria);
  };

  const handleSubmit = async () => {
    // Fix #1: use parseEther for 18-decimal GEN
    let stakeWei: bigint;
    try {
      stakeWei = parseEther(stakeGLT);
      if (stakeWei <= 0n) throw new Error();
    } catch { alert('Stake must be a valid number > 0'); return; }

    if (promise.trim().length < 10) { alert('Promise is too short'); return; }
    if (criteria.trim().length < 10) { alert('Success criteria is too short'); return; }

    // Fix #3: proper EVM address validation
    if (!isAddress(beneficiary)) { alert('Invalid beneficiary address (must be a valid 0x… EVM address)'); return; }
    if (myAddress && beneficiary.toLowerCase() === myAddress.toLowerCase()) {
      alert('Beneficiary cannot be your own address'); return;
    }

    const days = parseInt(deadlineDays);
    if (isNaN(days) || days < 1) { alert('Deadline must be at least 1 day'); return; }

    const deadlineUnix = Math.floor(Date.now() / 1000) + days * 86400;

    const result = await createPact({
      promise: promise.trim(),
      criteria: criteria.trim(),
      beneficiary,
      deadlineUnix,
      stakeWei,
    });

    if (result.success) onSuccess();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-labelledby="modal-title">
        <div className="modal-header">
          <h2 className="modal-title" id="modal-title">🔒 Create a Pact</h2>
          <button id="btn-close-modal" className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Step bar */}
        <div className="step-indicator">
          {[1, 2, 3].map(s => (
            <div key={s} className={`step-bar ${step >= s ? 'active' : ''}`} />
          ))}
        </div>

        {/* ── STEP 1: Promise ── */}
        {step === 1 && (
          <div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <div className="form-label">💡 Example promises</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {EXAMPLES.map((ex, i) => (
                  <button
                    key={i}
                    id={`btn-example-${i}`}
                    onClick={() => loadExample(i)}
                    style={{
                      background: 'var(--bg-input)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', padding: '10px 14px',
                      textAlign: 'left', cursor: 'pointer', color: 'var(--text-secondary)',
                      fontSize: 13, transition: 'border-color 150ms', fontFamily: 'var(--font-body)',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold-500)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    {ex.promise}
                  </button>
                ))}
              </div>
            </div>

            <div className="divider" />

            <div className="form-group">
              <label className="form-label" htmlFor="input-promise">Your promise *</label>
              <textarea
                id="input-promise"
                className="form-textarea"
                placeholder="I will publish 10 blog posts within 30 days."
                value={promise}
                onChange={e => setPromise(e.target.value)}
                style={{ minHeight: 100 }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-criteria">Success criteria * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(what counts as kept)</span></label>
              <textarea
                id="input-criteria"
                className="form-textarea"
                placeholder="My blog shows ≥10 posts published after today's date."
                value={criteria}
                onChange={e => setCriteria(e.target.value)}
                style={{ minHeight: 80 }}
              />
              <div className="form-hint">Be specific. The AI will judge evidence against exactly this criteria.</div>
            </div>

            <button
              id="btn-next-1"
              className="btn btn-gold"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => setStep(2)}
              disabled={promise.trim().length < 10 || criteria.trim().length < 10}
            >
              Next →
            </button>
          </div>
        )}

        {/* ── STEP 2: Stakes & Deadline ── */}
        {step === 2 && (
          <div>
            <div style={{
              background: 'rgba(251,191,36,0.06)', border: '1px solid var(--border-gold)',
              borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 20,
              fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 4 }}>Promise</div>
              {promise}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-stake">Stake amount (GLT) *</label>
              <input
                id="input-stake"
                type="number"
                className="form-input"
                min="0.000001"
                step="0.01"
                value={stakeGLT}
                onChange={e => setStakeGLT(e.target.value)}
              />
              <div className="form-hint">This amount is locked. You get it back only if the AI confirms you kept your promise.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-deadline">Deadline (days from now) *</label>
              <input
                id="input-deadline"
                type="number"
                className="form-input"
                min="1" max="365"
                value={deadlineDays}
                onChange={e => setDeadlineDays(e.target.value)}
              />
              <div className="form-hint">After {deadlineDays} day{parseInt(deadlineDays) !== 1 ? 's' : ''}, if no kept verdict exists, anyone can send the stake to the beneficiary.</div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="input-beneficiary">Beneficiary address * <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(receives stake on failure)</span></label>
              <input
                id="input-beneficiary"
                type="text"
                className="form-input"
                placeholder="0x000...dEaD"
                value={beneficiary}
                onChange={e => setBeneficiary(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
              />
              <div className="form-hint">E.g. a charity, a friend, or the burn address. Cannot be yourself.</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <button id="btn-back-1" className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
              <button
                id="btn-next-2"
                className="btn btn-gold"
                style={{ justifyContent: 'center' }}
                onClick={() => setStep(3)}
                disabled={!stakeGLT || !beneficiary || !deadlineDays}
              >
                Review →
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Review & Submit ── */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>Review your pact</div>
              {[
                { label: 'Promise', value: promise },
                { label: 'Success criteria', value: criteria },
                { label: 'Stake', value: `${stakeGLT} GLT` },
                { label: 'Deadline', value: `${deadlineDays} days` },
                { label: 'Beneficiary on failure', value: `${beneficiary.slice(0, 10)}…${beneficiary.slice(-6)}` },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 140, flexShrink: 0, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, paddingTop: 2 }}>{label}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{value}</div>
                </div>
              ))}
            </div>

            {error && <div className="form-error">❌ {error}</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
              <button id="btn-back-2" className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
              <button
                id="btn-create-submit"
                className="btn btn-gold"
                style={{ justifyContent: 'center' }}
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? <><span className="spinner-sm" /> Staking & creating…</> : '🔒 Lock Stake & Create Pact'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
