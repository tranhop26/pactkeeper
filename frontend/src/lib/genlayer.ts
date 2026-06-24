/**
 * PactKeeper — genlayer-js client
 * Connects to GenLayer Studionet and provides helper utilities.
 */

import { createClient, chains } from 'genlayer-js';
import { formatEther } from 'viem';

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_PACTKEEPER_CONTRACT_ADDRESS ?? ''
) as `0x${string}`;

// Read-only client — no account needed for reads.
// Write calls go through WalletContext (MetaMask signer).
export const glClient = createClient({ chain: chains.studionet });

// Pact status enum (matches contract)
export const PACT_STATUS = {
  ACTIVE: 0,
  SUBMITTED: 1,
  KEPT: 2,
  BROKEN: 3,
} as const;

export type PactStatus = 0 | 1 | 2 | 3;

export interface Pact {
  id: number;
  owner: string;
  beneficiary: string;
  promise: string;
  criteria: string;
  stake: number;       // wei (18 decimals, GEN)
  deadline: number;    // unix seconds
  status: PactStatus;
  evidence_url: string;
  reason: string;
  confidence: number;  // 0-100
}

export function statusLabel(s: PactStatus): string {
  switch (s) {
    case 0: return 'Active';
    case 1: return 'Evidence Submitted';
    case 2: return 'Kept ✓';
    case 3: return 'Broken ✗';
    default: return 'Unknown';
  }
}

export function statusClass(s: PactStatus): string {
  switch (s) {
    case 0: return 'status-active';
    case 1: return 'status-submitted';
    case 2: return 'status-kept';
    case 3: return 'status-broken';
    default: return '';
  }
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 10) return addr || '—';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Fix #1: GEN has 18 decimals — use viem's formatEther
export function formatWei(wei: number | bigint): string {
  const n = typeof wei === 'bigint' ? wei : BigInt(Math.round(Number(wei)));
  if (n === 0n) return '0 GEN';
  const formatted = formatEther(n);
  // Trim trailing zeros but keep at least 4 significant decimals
  const num = parseFloat(formatted);
  if (num < 0.0001) return `${n.toString()} wei`;
  return `${num.toFixed(4).replace(/\.?0+$/, '')} GEN`;
}

export function formatDeadline(ts: number): string {
  if (!ts) return 'No deadline';
  const diff = ts * 1000 - Date.now();
  if (diff < 0) {
    const abs = Math.abs(diff);
    if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ago`;
    if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)}h ago`;
    return `${Math.floor(abs / 86_400_000)}d ago`;
  }
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m left`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h left`;
  return `${Math.floor(diff / 86_400_000)}d left`;
}

export function deadlinePassed(ts: number): boolean {
  return ts > 0 && Date.now() / 1000 > ts;
}
