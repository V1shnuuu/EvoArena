"use client";

import { useState, useCallback } from "react";
import { Long } from "@bnb-chain/greenfield-js-sdk";
import {
  getGreenfieldClient,
  EVOARENA_BUCKET,
  GREENFIELD_SP_ADDRESS,
  GREENFIELD_SP_ENDPOINT,
  makeLogObjectName,
  getObjectUrl,
  type AgentStrategyLog,
} from "@/lib/greenfield";

// Visibility & Redundancy enums from the SDK
const VisibilityType = {
  VISIBILITY_TYPE_PUBLIC_READ: 1,
};
const RedundancyType = {
  REDUNDANCY_EC_TYPE: 0,
};

export function useGreenfield() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ensure the EvoArena audit bucket exists; create if not.
   */
  const ensureBucket = useCallback(async (address: string) => {
    const client = getGreenfieldClient();
    try {
      await client.bucket.headBucket(EVOARENA_BUCKET);
      return true; // exists
    } catch {
      // Bucket doesn't exist → create it
      try {
        const createBucketTx = await client.bucket.createBucket({
          bucketName: EVOARENA_BUCKET,
          creator: address,
          visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
          chargedReadQuota: Long.fromString("0"),
          primarySpAddress: GREENFIELD_SP_ADDRESS,
          paymentAddress: address,
        });

        const simulateInfo = await createBucketTx.simulate({ denom: "BNB" });
        await createBucketTx.broadcast({
          denom: "BNB",
          gasLimit: Number(simulateInfo.gasLimit),
          gasPrice: simulateInfo.gasPrice,
          payer: address,
          granter: "",
        });
        return true;
      } catch (err: any) {
        console.error("Failed to create bucket:", err);
        setError(`Bucket creation failed: ${err.message}`);
        return false;
      }
    }
  }, []);

  /**
   * Upload an agent strategy log to Greenfield
   */
  const uploadLog = useCallback(
    async (address: string, log: AgentStrategyLog): Promise<string | null> => {
      setUploading(true);
      setError(null);
      try {
        const client = getGreenfieldClient();

        // Ensure bucket exists
        const bucketOk = await ensureBucket(address);
        if (!bucketOk) {
          setUploading(false);
          return null;
        }

        const objectName = makeLogObjectName(log.agentAddress, log.timestamp);
        const content = JSON.stringify(log, null, 2);
        const bytes = new TextEncoder().encode(content);
        const file = new File([bytes], objectName, { type: "application/json" });

        // Create object on chain
        const createObjectTx = await client.object.createObject({
          bucketName: EVOARENA_BUCKET,
          objectName,
          creator: address,
          visibility: VisibilityType.VISIBILITY_TYPE_PUBLIC_READ,
          contentType: "application/json",
          redundancyType: RedundancyType.REDUNDANCY_EC_TYPE,
          payloadSize: Long.fromInt(bytes.length),
          expectChecksums: [], // SDK will calculate
        });

        const simulateInfo = await createObjectTx.simulate({ denom: "BNB" });
        const broadcastRes = await createObjectTx.broadcast({
          denom: "BNB",
          gasLimit: Number(simulateInfo.gasLimit),
          gasPrice: simulateInfo.gasPrice,
          payer: address,
          granter: "",
        });

        if (broadcastRes.code !== 0) {
          throw new Error(`CreateObject tx failed: code ${broadcastRes.code}`);
        }

        // Upload object data to storage provider
        await client.object.uploadObject(
          {
            bucketName: EVOARENA_BUCKET,
            objectName,
            body: file,
            txnHash: broadcastRes.transactionHash,
          },
          {
            type: "EDDSA",
            domain: window.location.origin,
            seed: "", // Will use wallet signature
            address,
          }
        );

        const url = getObjectUrl(EVOARENA_BUCKET, objectName);
        setUploading(false);
        return url;
      } catch (err: any) {
        console.error("Upload log error:", err);
        setError(err.message || "Upload failed");
        setUploading(false);
        return null;
      }
    },
    [ensureBucket]
  );

  /**
   * List all log objects in the audit bucket
   */
  const listLogs = useCallback(async (): Promise<any[]> => {
    try {
      const client = getGreenfieldClient();
      const res = await client.object.listObjects({
        bucketName: EVOARENA_BUCKET,
        endpoint: GREENFIELD_SP_ENDPOINT,
      });
      return (res as any)?.body?.GfSpListObjectsByBucketNameResponse?.Objects ?? [];
    } catch (err) {
      console.error("List logs error:", err);
      return [];
    }
  }, []);

  /**
   * List all objects for a specific agent
   */
  const listAgentLogs = useCallback(
    async (agentAddress: string): Promise<any[]> => {
      const all = await listLogs();
      const prefix = `logs/${agentAddress.toLowerCase()}/`;
      return all.filter(
        (obj: any) => obj?.ObjectInfo?.ObjectName?.startsWith(prefix)
      );
    },
    [listLogs]
  );

  return {
    uploadLog,
    listLogs,
    listAgentLogs,
    ensureBucket,
    uploading,
    error,
  };
}
