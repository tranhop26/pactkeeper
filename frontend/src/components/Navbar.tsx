'use client';
import Link from 'next/link';
import { CONTRACT_ADDRESS, demoAccount, shortAddr } from '@/lib/genlayer';

export default function Navbar() {
  return (
    <nav className="navbar">
      <div className="container">
        <div className="navbar-inner">
          <Link href="/" className="navbar-logo">
            <div className="navbar-logo-seal">🔒</div>
            <span className="navbar-logo-text">PactKeeper</span>
          </Link>

          <div className="navbar-actions">
            <span className="navbar-badge">
              👤 {shortAddr(demoAccount.address)}
            </span>
            <span className="navbar-badge" style={{ color: 'var(--kept-color)', borderColor: 'var(--kept-border)' }}>
              ● Studionet
            </span>
            <Link href="/" className="btn btn-ghost btn-sm">All Pacts</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
