"use client";

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { EVOPOOL_ABI, CONTROLLER_ABI, ADDRESSES, BSC_TESTNET_RPC, CURVE_MODES } from "@/lib/contracts";

export interface PoolState {
  reserve0: string;
  reserve1: string;
  feeBps: number;
  curveBeta: number;
  curveMode: number;
  curveModeName: string;
  tradeCount: number;
  price: string;
  totalSupply: string;
}

export interface AgentInfo {
  address: string;
  bondAmount: string;
  registeredAt: number;
  lastUpdateTime: number;
  active: boolean;
}

export interface ParameterEvent {
  feeBps: number;
  curveBeta: number;
  curveMode: number;
  agent: string;
  blockNumber: number;
  txHash: string;
}

const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);

function getPool() {
  return new ethers.Contract(ADDRESSES.evoPool, EVOPOOL_ABI, provider);
}

function getController() {
  return new ethers.Contract(ADDRESSES.agentController, CONTROLLER_ABI, provider);
}

export function usePoolState(refreshInterval = 10000) {
  const [state, setState] = useState<PoolState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!ADDRESSES.evoPool) {
      setError("Pool address not configured");
      setLoading(false);
      return;
    }
    try {
      const pool = getPool();
      const [r0, r1] = await pool.getReserves();
      const feeBps = Number(await pool.feeBps());
      const curveBeta = Number(await pool.curveBeta());
      const curveMode = Number(await pool.curveMode());
      const tradeCount = Number(await pool.tradeCount());
      const totalSupply = await pool.totalSupply();

      const reserve0 = ethers.formatEther(r0);
      const reserve1 = ethers.formatEther(r1);
      const price = Number(reserve1) > 0
        ? (Number(reserve0) / Number(reserve1)).toFixed(6)
        : "0";

      setState({
        reserve0,
        reserve1,
        feeBps,
        curveBeta,
        curveMode,
        curveModeName: CURVE_MODES[curveMode] || "Unknown",
        tradeCount,
        price,
        totalSupply: ethers.formatEther(totalSupply),
      });
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const id = setInterval(fetch, refreshInterval);
    return () => clearInterval(id);
  }, [fetch, refreshInterval]);

  return { state, loading, error, refetch: fetch };
}

export function useAgents() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAgents = useCallback(async () => {
    if (!ADDRESSES.agentController) return;
    try {
      const ctrl = getController();
      const count = Number(await ctrl.getAgentCount());
      const list: AgentInfo[] = [];
      for (let i = 0; i < count; i++) {
        const addr = await ctrl.agentList(i);
        const info = await ctrl.getAgentInfo(addr);
        list.push({
          address: info.agentAddress,
          bondAmount: ethers.formatEther(info.bondAmount),
          registeredAt: Number(info.registeredAt),
          lastUpdateTime: Number(info.lastUpdateTime),
          active: info.active,
        });
      }
      setAgents(list);
    } catch (e) {
      console.error("useAgents error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const id = setInterval(fetchAgents, 15000);
    return () => clearInterval(id);
  }, [fetchAgents]);

  return { agents, loading };
}

export function useParameterHistory() {
  const [events, setEvents] = useState<ParameterEvent[]>([]);

  useEffect(() => {
    (async () => {
      if (!ADDRESSES.evoPool) return;
      try {
        const pool = getPool();
        const current = await provider.getBlockNumber();
        const from = Math.max(0, current - 5000);
        const filter = pool.filters.ParametersUpdated();
        const logs = await pool.queryFilter(filter, from, current);

        setEvents(
          logs.map((l: any) => ({
            feeBps: Number(l.args[0]),
            curveBeta: Number(l.args[1]),
            curveMode: Number(l.args[2]),
            agent: l.args[3],
            blockNumber: l.blockNumber,
            txHash: l.transactionHash,
          }))
        );
      } catch (e) {
        console.error("useParameterHistory error:", e);
      }
    })();
  }, []);

  return events;
}
