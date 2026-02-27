import { Client } from "@bnb-chain/greenfield-js-sdk";

// ----- Greenfield Testnet Config -----
export const GREENFIELD_RPC = "https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org";
export const GREENFIELD_CHAIN_ID = "greenfield_5600-1";
export const GREENFIELD_SP_ENDPOINT = "https://gnfd-testnet-sp1.bnbchain.org";
export const GREENFIELD_SP_ADDRESS = "0x76C34E34db516E0e8dBa8C714E1eCF4C48aE19a7"; // SP1 testnet operator

// EvoArena bucket for agent decision logs
export const EVOARENA_BUCKET = "evoarena-audit-logs";

/**
 * Create a Greenfield client instance
 */
export function getGreenfieldClient(): Client {
  return Client.create(GREENFIELD_RPC, GREENFIELD_CHAIN_ID);
}

/**
 * Generate an object name for an agent log entry
 */
export function makeLogObjectName(agentAddress: string, timestamp: number): string {
  const date = new Date(timestamp);
  const dateStr = date.toISOString().split("T")[0]; // e.g., 2026-02-28
  return `logs/${agentAddress.toLowerCase()}/${dateStr}_${timestamp}.json`;
}

/**
 * Build a public access URL for a Greenfield object
 */
export function getObjectUrl(bucketName: string, objectName: string): string {
  return `${GREENFIELD_SP_ENDPOINT}/view/${bucketName}/${objectName}`;
}

/**
 * Represents a single agent strategy log entry stored on Greenfield
 */
export interface AgentStrategyLog {
  agentAddress: string;
  timestamp: number;
  action: "parameter_update" | "registration" | "pool_snapshot";
  data: {
    feeBps?: number;
    curveBeta?: number;
    curveMode?: number;
    curveModeName?: string;
    reason?: string;
    txHash?: string;
    poolState?: {
      reserve0: string;
      reserve1: string;
      price: string;
      totalSupply: string;
    };
  };
  metadata: {
    chainId: number;
    blockNumber?: number;
    version: string;
  };
}
