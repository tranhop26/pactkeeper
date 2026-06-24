'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';
import ConnectModal from '@/components/ConnectModal';
import { shortAddr } from '@/lib/genlayer';

export default function Navbar() {
  const { address, disconnect } = useWallet();
  const [showConnect, setShowConnect] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <nav className="navbar">
        <div className="container">
          <div className="navbar-inner">
            <Link href="/" className="navbar-logo">
              <div className="navbar-logo-seal">🔒</div>
              <span className="navbar-logo-text">PactKeeper</span>
            </Link>

            <div className="navbar-actions">
              <span className="navbar-badge" style={{ color: 'var(--kept-color)', borderColor: 'var(--kept-border)' }}>
                ● Studionet
              </span>

              {address ? (
                <div style={{ position: 'relative' }}>
                  <button
                    id="btn-wallet-menu"
                    className="navbar-badge"
                    style={{
                      cursor: 'pointer', background: 'rgba(251,191,36,0.1)',
                      borderColor: 'var(--border-gold)', color: 'var(--gold-400)',
                      border: '1px solid var(--border-gold)', borderRadius: 'var(--radius-sm)',
                      padding: '4px 12px', fontSize: 12, fontFamily: 'var(--font-mono)',
                    }}
                    onClick={() => setShowMenu(v => !v)}
                  >
                    👤 {shortAddr(address)} ▾
                  </button>
                  {showMenu && (
                    <div style={{
                      position: 'absolute', top: '110%', right: 0,
                      background: 'var(--bg-card)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)', padding: 8, minWidth: 160,
                      zIndex: 100, boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    }}>
                      <div style={{ padding: '6px 10px', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                        {address}
                      </div>
                      <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
                      <button
                        id="btn-disconnect"
                        onClick={() => { disconnect(); setShowMenu(false); }}
                        style={{
                          width: '100%', textAlign: 'left', padding: '8px 10px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--broken-color)', fontSize: 13, borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        🔌 Disconnect
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  id="btn-connect-wallet"
                  className="btn btn-gold btn-sm"
                  onClick={() => setShowConnect(true)}
                >
                  🔑 Connect
                </button>
              )}

              <Link href="/" className="btn btn-ghost btn-sm">All Pacts</Link>
            </div>
          </div>
        </div>
      </nav>

      {showConnect && <ConnectModal onClose={() => setShowConnect(false)} />}
    </>
  );
}
