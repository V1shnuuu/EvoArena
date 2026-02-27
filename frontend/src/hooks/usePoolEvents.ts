"use client";

import { useEffect, useRef } from "react";
import { ethers } from "ethers";
import { useToast } from "@/components/Toast";
import { ADDRESSES, EVOPOOL_ABI, BSC_TESTNET_RPC } from "@/lib/contracts";

/**
 * Subscribes to EvoPool events (Swap, AddLiquidity, RemoveLiquidity, FeeUpdated)
 * and shows toast notifications in real time.
 * Uses polling (every 15s) since most public RPCs don't support ws subscriptions.
 */
export function usePoolEvents() {
  const { addToast } = useToast();
  const lastBlockRef = useRef<number>(0);

  useEffect(() => {
    const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
    const pool = new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, provider);
    let stopped = false;

    const poll = async () => {
      try {
        const currentBlock = await provider.getBlockNumber();
        if (lastBlockRef.current === 0) {
          lastBlockRef.current = currentBlock;
          return;
        }
        if (currentBlock <= lastBlockRef.current) return;

        const fromBlock = lastBlockRef.current + 1;
        const toBlock = currentBlock;

        // Query events in the block range
        const swapFilter = pool.filters.Swap();
        const addFilter = pool.filters.AddLiquidity();
        const removeFilter = pool.filters.RemoveLiquidity();
        const feeFilter = pool.filters.FeeUpdated();

        const [swaps, adds, removes, fees] = await Promise.all([
          pool.queryFilter(swapFilter, fromBlock, toBlock).catch(() => []),
          pool.queryFilter(addFilter, fromBlock, toBlock).catch(() => []),
          pool.queryFilter(removeFilter, fromBlock, toBlock).catch(() => []),
          pool.queryFilter(feeFilter, fromBlock, toBlock).catch(() => []),
        ]);

        for (const ev of swaps) {
          const log = ev as ethers.EventLog;
          if (log.args) {
            const who = log.args[0]?.toString().slice(0, 8) + "…";
            addToast({
              type: "info",
              title: "🔄 Swap detected",
              message: `${who} swapped on EvoPool`,
              txHash: log.transactionHash,
              duration: 8000,
            });
          }
        }

        for (const ev of adds) {
          const log = ev as ethers.EventLog;
          if (log.args) {
            const who = log.args[0]?.toString().slice(0, 8) + "…";
            addToast({
              type: "info",
              title: "💧 Liquidity added",
              message: `${who} added liquidity`,
              txHash: log.transactionHash,
              duration: 8000,
            });
          }
        }

        for (const ev of removes) {
          const log = ev as ethers.EventLog;
          if (log.args) {
            const who = log.args[0]?.toString().slice(0, 8) + "…";
            addToast({
              type: "info",
              title: "🔥 Liquidity removed",
              message: `${who} removed liquidity`,
              txHash: log.transactionHash,
              duration: 8000,
            });
          }
        }

        for (const ev of fees) {
          const log = ev as ethers.EventLog;
          if (log.args) {
            const newFee = Number(log.args[0]);
            addToast({
              type: "info",
              title: "📊 Fee updated",
              message: `Pool fee changed to ${newFee} bps`,
              txHash: log.transactionHash,
              duration: 8000,
            });
          }
        }

        lastBlockRef.current = toBlock;
      } catch (err) {
        // Silently ignore polling errors
      }
    };

    const interval = setInterval(() => {
      if (!stopped) poll();
    }, 15000);

    // Initial poll
    poll();

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
