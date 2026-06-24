'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient, chains } from 'genlayer-js';
import { privateKeyToAccount } from 'viem/accounts';
import type { Account } from 'viem';

interface WalletState {
  address: string | null;
  client: ReturnType<typeof createClient> | null;
  connect: (privateKey: string) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  client: null,
  connect: () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [client, setClient] = useState<ReturnType<typeof createClient> | null>(null);

  // Restore session on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('pk_wallet_key');
      if (saved) connectWithKey(saved);
    } catch { /* ignore */ }
  }, []);

  const connectWithKey = useCallback((rawKey: string) => {
    let key = rawKey.trim();
    if (!key.startsWith('0x')) key = '0x' + key;
    const account = privateKeyToAccount(key as `0x${string}`);
    const newClient = createClient({ chain: chains.studionet, account });
    setAddress(account.address);
    setClient(newClient);
    sessionStorage.setItem('pk_wallet_key', key);
  }, []);

  const connect = useCallback((privateKey: string) => {
    connectWithKey(privateKey);
  }, [connectWithKey]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setClient(null);
    sessionStorage.removeItem('pk_wallet_key');
  }, []);

  return (
    <WalletContext.Provider value={{ address, client, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
