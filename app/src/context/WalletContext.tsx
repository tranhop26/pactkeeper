'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient, chains } from 'genlayer-js';
import { custom } from 'viem';

interface WalletState {
  address: string | null;
  client: ReturnType<typeof createClient> | null;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletState>({
  address: null,
  client: null,
  isConnecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
});

// GenLayer Studionet network params for MetaMask
const STUDIONET_PARAMS = {
  chainId: '0xF22F', // 61999 in hex
  chainName: 'GenLayer Studionet',
  nativeCurrency: { name: 'GenLayer Token', symbol: 'GLT', decimals: 18 },
  rpcUrls: ['https://studio.genlayer.com/api'],
  blockExplorerUrls: [],
};

function getEthereum() {
  if (typeof window !== 'undefined' && (window as unknown as { ethereum?: unknown }).ethereum) {
    return (window as unknown as { ethereum: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    } }).ethereum;
  }
  return null;
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [client, setClient] = useState<ReturnType<typeof createClient> | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setupClient = useCallback((addr: string) => {
    const eth = getEthereum();
    if (!eth) return;
    const newClient = createClient({
      chain: chains.studionet,
      // @ts-expect-error genlayer-js accepts json-rpc account string
      account: addr,
      transport: custom(eth),
    });
    setAddress(addr);
    setClient(newClient);
    sessionStorage.setItem('pk_connected_address', addr);
  }, []);

  // Auto-reconnect if previously connected
  useEffect(() => {
    const saved = sessionStorage.getItem('pk_connected_address');
    if (!saved) return;
    const eth = getEthereum();
    if (!eth) return;
    // Check if still authorized (no popup)
    eth.request({ method: 'eth_accounts' })
      .then((accounts) => {
        const list = accounts as string[];
        if (list.length > 0 && list[0].toLowerCase() === saved.toLowerCase()) {
          setupClient(list[0]);
        } else {
          sessionStorage.removeItem('pk_connected_address');
        }
      })
      .catch(() => sessionStorage.removeItem('pk_connected_address'));
  }, [setupClient]);

  // Listen for account changes
  useEffect(() => {
    const eth = getEthereum();
    if (!eth) return;
    const handler = (accounts: unknown) => {
      const list = accounts as string[];
      if (list.length === 0) {
        setAddress(null);
        setClient(null);
        sessionStorage.removeItem('pk_connected_address');
      } else {
        setupClient(list[0]);
      }
    };
    eth.on('accountsChanged', handler);
    return () => eth.removeListener('accountsChanged', handler);
  }, [setupClient]);

  const connect = useCallback(async () => {
    setError(null);
    const eth = getEthereum();
    if (!eth) {
      setError('MetaMask not found. Please install MetaMask extension.');
      return;
    }
    setIsConnecting(true);
    try {
      // Add GenLayer studionet to MetaMask if not already added
      try {
        await eth.request({
          method: 'wallet_addEthereumChain',
          params: [STUDIONET_PARAMS],
        });
      } catch {
        // Already added or user dismissed — continue
      }

      // Switch to studionet
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: STUDIONET_PARAMS.chainId }],
        });
      } catch {
        // Continue even if switch fails
      }

      // Request accounts
      const accounts = await eth.request({ method: 'eth_requestAccounts' }) as string[];
      if (!accounts || accounts.length === 0) throw new Error('No accounts returned from MetaMask');
      setupClient(accounts[0]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes('User rejected')) setError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, [setupClient]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setClient(null);
    sessionStorage.removeItem('pk_connected_address');
  }, []);

  return (
    <WalletContext.Provider value={{ address, client, isConnecting, error, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
