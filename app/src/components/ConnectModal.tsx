'use client';
import { useWallet } from '@/context/WalletContext';

export default function ConnectModal({ onClose }: { onClose: () => void }) {
  const { connect, isConnecting, error } = useWallet();

  const handleConnect = async () => {
    await connect();
    // Close only if connected successfully (address will be set)
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }} role="dialog" aria-labelledby="connect-title">
        <div className="modal-header">
          <h2 className="modal-title" id="connect-title">🦊 Connect Wallet</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* MetaMask info */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '24px 0', gap: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 56 }}>🦊</div>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>
            Connect with MetaMask
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, maxWidth: 320 }}>
            PactKeeper will automatically add <strong style={{ color: 'var(--gold-400)' }}>GenLayer Studionet</strong> to
            your MetaMask. Your account on studionet needs GLT to stake.
          </div>
        </div>

        <div style={{
          background: 'var(--bg-input)', borderRadius: 'var(--radius-md)',
          padding: '12px 16px', marginBottom: 20,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--text-muted)', fontWeight: 600 }}>
            Network Details
          </div>
          {[
            ['Network', 'GenLayer Studionet'],
            ['Chain ID', '61999'],
            ['RPC', 'studio.genlayer.com/api'],
            ['Symbol', 'GLT'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-muted)' }}>{k}</span>
              <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{v}</span>
            </div>
          ))}
        </div>

        {error && (
          <div className="form-error" style={{ marginBottom: 16 }}>
            {error.includes('MetaMask not found')
              ? <>❌ MetaMask not installed. <a href="https://metamask.io" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--gold-400)' }}>Download here →</a></>
              : `❌ ${error}`
            }
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            id="btn-metamask-connect"
            className="btn btn-gold"
            style={{ justifyContent: 'center' }}
            onClick={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting
              ? <><span className="spinner-sm" /> Connecting…</>
              : '🦊 Connect MetaMask'
            }
          </button>
        </div>
      </div>
    </div>
  );
}
