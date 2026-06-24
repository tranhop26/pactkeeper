/**
 * PactKeeper — genlayer-js client
 * Connects to GenLayer Studionet and provides helper utilities.
 */

import { createClient, chains } from 'genlayer-js';
import { privateKeyToAccount } from 'viem/accounts';

export const CONTRACT_ADDRESS = (
  process.env.NEXT_PUBLIC_PACTKEEPER_CONTRACT_ADDRESS ?? ''
) as `0x${string}`;

// Studionet demo account (pre-funded test key — studionet only, no real funds)
// In production replace with wallet connect (e.g. wagmi + RainbowKit)
const STUDIONET_TEST_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
export const demoAccount = privateKeyToAccount(STUDIONET_TEST_KEY);

export const glClient = createClient({
  chain: chains.studionet,
  account: demoAccount,
});

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
  stake: number;       // wei
  deadline: number;    // unix seconds (0 = no deadline)
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

export function formatWei(wei: number | bigint): string {
  const n = typeof wei === 'bigint' ? Number(wei) : wei;
  if (n === 0) return '0 GLT';
  if (n < 1_000_000) return `${n} wei`;
  return `${(n / 1_000_000).toFixed(4)} GLT`;
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
