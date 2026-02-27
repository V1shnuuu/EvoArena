"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { ERC20_ABI, ADDRESSES, BSC_TESTNET_RPC } from "@/lib/contracts";

const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);

export function useTokenBalances(address: string | null) {
  const [balanceA, setBalanceA] = useState<string | null>(null);
  const [balanceB, setBalanceB] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    if (!address) {
      setBalanceA(null);
      setBalanceB(null);
      return;
    }
    try {
      const tokenA = new ethers.Contract(ADDRESSES.tokenA, ERC20_ABI, provider);
      const tokenB = new ethers.Contract(ADDRESSES.tokenB, ERC20_ABI, provider);
      const [a, b] = await Promise.all([
        tokenA.balanceOf(address),
        tokenB.balanceOf(address),
      ]);
      setBalanceA(ethers.formatEther(a));
      setBalanceB(ethers.formatEther(b));
    } catch (e) {
      console.error("useTokenBalances error:", e);
    }
  }, [address]);

  useEffect(() => {
    fetchBalances();
    const id = setInterval(fetchBalances, 15000);
    return () => clearInterval(id);
  }, [fetchBalances]);

  return { balanceA, balanceB, refetchBalances: fetchBalances };
}
