"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { ethers } from "ethers";
import { connectWallet, getWalletAddress, WalletType, getAvailableWallets } from "@/lib/wallet";

interface WalletContextType {
  address: string | null;
  signer: ethers.Signer | null;
  provider: ethers.BrowserProvider | null;
  connected: boolean;
  connecting: boolean;
  walletType: WalletType | null;
  availableWallets: WalletType[];
  connect: (type?: WalletType) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  signer: null,
  provider: null,
  connected: false,
  connecting: false,
  walletType: null,
  availableWallets: [],
  connect: async () => {},
  disconnect: () => {},
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [availableWallets] = useState<WalletType[]>(() =>
    typeof window !== "undefined" ? getAvailableWallets() : []
  );

  const connect = useCallback(async (type: WalletType = "metamask") => {
    setConnecting(true);
    try {
      const p = await connectWallet(type);
      if (p) {
        const s = await p.getSigner();
        const addr = await s.getAddress();
        setProvider(p);
        setSigner(s);
        setAddress(addr);
        setWalletType(type);
      }
    } catch (err) {
      console.error("Wallet connect error:", err);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setSigner(null);
    setProvider(null);
    setWalletType(null);
  }, []);

  // Auto-reconnect if already connected
  useEffect(() => {
    (async () => {
      const addr = await getWalletAddress();
      if (addr) {
        await connect();
      }
    })();

    // Listen for account changes
    if (typeof window !== "undefined" && (window as any).ethereum) {
      const ethereum = (window as any).ethereum;
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          connect();
        }
      };
      const handleChainChanged = () => {
        connect();
      };
      ethereum.on("accountsChanged", handleAccountsChanged);
      ethereum.on("chainChanged", handleChainChanged);
      return () => {
        ethereum.removeListener("accountsChanged", handleAccountsChanged);
        ethereum.removeListener("chainChanged", handleChainChanged);
      };
    }
  }, [connect, disconnect]);

  return (
    <WalletContext.Provider
      value={{
        address,
        signer,
        provider,
        connected: !!address,
        connecting,
        walletType,
        availableWallets,
        connect,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  return useContext(WalletContext);
}
