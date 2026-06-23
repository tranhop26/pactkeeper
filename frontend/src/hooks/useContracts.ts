/**
 * PactKeeper — contract hooks
 * All reads use glClient.readContract, all writes use glClient.writeContract.
 * No mocks, no hardcoded data.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { glClient, CONTRACT_ADDRESS, Pact } from '@/lib/genlayer';

// ─── Read: single pact ──────────────────────────────────────────────────────

export function usePact(pactId: number) {
  const [pact, setPact] = useState<Pact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const raw = await glClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'get_pact',
        args: [BigInt(pactId)],
      });
      const parsed = JSON.parse(raw as string);
      if (!parsed || Object.keys(parsed).length === 0) {
        setError('Pact not found');
        setPact(null);
      } else {
        setPact(parsed as Pact);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [pactId]);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, 15_000);
    return () => clearInterval(t);
  }, [refetch]);

  return { pact, loading, error, refetch };
}

// ─── Read: total pacts count ─────────────────────────────────────────────────

export function useTotalPacts() {
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!CONTRACT_ADDRESS) {
      setError('NEXT_PUBLIC_PACTKEEPER_CONTRACT_ADDRESS not configured');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const raw = await glClient.readContract({
        address: CONTRACT_ADDRESS,
        functionName: 'total_pacts',
        args: [],
      });
      setTotal(Number(raw));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, 30_000);
    return () => clearInterval(t);
  }, [refetch]);

  return { total, loading, error, refetch };
}

// ─── Read: all pacts (paginated by total) ───────────────────────────────────

export function useAllPacts() {
  const { total, loading: countLoading, error: countError, refetch: refetchCount } = useTotalPacts();
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (total === null || total === 0) {
      setPacts([]);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      // Fetch at most the last 50 pacts
      const start = Math.max(0, total - 50);
      const fetches = [];
      for (let i = start; i < total; i++) {
        fetches.push(
          glClient.readContract({
            address: CONTRACT_ADDRESS,
            functionName: 'get_pact',
            args: [BigInt(i)],
          }).then(raw => JSON.parse(raw as string) as Pact)
           .catch(() => null)
        );
      }
      const results = (await Promise.all(fetches)).filter(Boolean) as Pact[];
      setPacts(results.reverse()); // newest first
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [total]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const refetchAll = useCallback(async () => {
    await refetchCount();
    await refetch();
  }, [refetchCount, refetch]);

  return {
    pacts,
    loading: countLoading || loading,
    error: countError || error,
    refetch: refetchAll,
  };
}

// ─── Read: withdrawable balance ───────────────────────────────────────────────

export function useWithdrawable(address: string) {
  const [amount, setAmount] = useState<bigint>(0n);

  useEffect(() => {
    if (!address || !CONTRACT_ADDRESS) return;
    glClient.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_withdrawable',
      args: [address],
    }).then(raw => setAmount(BigInt(raw as string))).catch(() => setAmount(0n));
  }, [address]);

  return amount;
}

// ─── Write hooks ─────────────────────────────────────────────────────────────

function useWriteHook() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  async function execute(fn: () => Promise<unknown>) {
    setLoading(true);
    setError(null);
    setTxHash(null);
    try {
      const hash = await fn();
      setTxHash(hash as string);
      return { success: true, hash: hash as string };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }

  return { loading, error, txHash, execute };
}

// create_pact(promise, criteria, beneficiary_addr, deadline_unix) payable
export function useCreatePact() {
  const { loading, error, execute } = useWriteHook();

  const createPact = useCallback(async (params: {
    promise: string;
    criteria: string;
    beneficiary: string;
    deadlineUnix: number;
    stakeWei: bigint;
  }) => {
    return execute(() =>
      glClient.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'create_pact',
        args: [params.promise, params.criteria, params.beneficiary, BigInt(params.deadlineUnix)],
        value: params.stakeWei,
      })
    );
  }, [execute]);

  return { createPact, loading, error };
}

// submit_evidence(pact_id, url)
export function useSubmitEvidence() {
  const { loading, error, execute } = useWriteHook();

  const submitEvidence = useCallback(async (pactId: number, url: string) => {
    return execute(() =>
      glClient.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'submit_evidence',
        args: [BigInt(pactId), url],
        value: 0n,
      })
    );
  }, [execute]);

  return { submitEvidence, loading, error };
}

// settle(pact_id) — triggers AI judgment
export function useSettle() {
  const { loading, error, execute } = useWriteHook();

  const settle = useCallback(async (pactId: number) => {
    return execute(() =>
      glClient.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'settle',
        args: [BigInt(pactId)],
        value: 0n,
        consensusMaxRotations: 5,
      })
    );
  }, [execute]);

  return { settle, loading, error };
}

// claim_expired(pact_id)
export function useClaimExpired() {
  const { loading, error, execute } = useWriteHook();

  const claimExpired = useCallback(async (pactId: number) => {
    return execute(() =>
      glClient.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'claim_expired',
        args: [BigInt(pactId)],
        value: 0n,
      })
    );
  }, [execute]);

  return { claimExpired, loading, error };
}

// withdraw()
export function useWithdraw() {
  const { loading, error, execute } = useWriteHook();

  const withdraw = useCallback(async () => {
    return execute(() =>
      glClient.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: 'withdraw',
        args: [],
        value: 0n,
      })
    );
  }, [execute]);

  return { withdraw, loading, error };
}
