'use client';
import { useState } from 'react';
import { useWallet } from '@/context/WalletContext';

export default function ConnectModal({ onClose }: { onClose: () => void }) {
  const { connect } = useWallet();
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleConnect = () => {
    setError('');
    try {
      if (!key.trim()) { setError('Please enter your private key'); return; }
      connect(key.trim());
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Invalid private key');
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }} role="dialog" aria-labelledby="connect-title">
        <div className="modal-header">
          <h2 className="modal-title" id="connect-title">🔑 Connect Wallet</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Warning */}
        <div style={{
          background: 'rgba(251,191,36,0.08)',
          border: '1px solid var(--border-gold)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--text-secondary)',
          lineHeight: 1.7,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--gold-400)' }}>⚠️ Studionet only</div>
          Your private key stays <strong>100% in your browser</strong> (sessionStorage).
          It is never sent to any server. Use a <strong>testnet-only</strong> account — never your mainnet wallet.
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="input-private-key">Private Key</label>
          <input
            id="input-private-key"
            type="password"
            className="form-input"
            placeholder="0xac0974bec39a17e36ba4a..."
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConnect()}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <div className="form-hint">
            Export from GenLayer Studio → your account → Export Private Key
          </div>
        </div>

        {error && <div className="form-error" style={{ marginBottom: 16 }}>❌ {error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="btn-do-connect"
            className="btn btn-gold"
            style={{ justifyContent: 'center' }}
            onClick={handleConnect}
          >
            🔑 Connect
          </button>
        </div>
      </div>
    </div>
  );
}
