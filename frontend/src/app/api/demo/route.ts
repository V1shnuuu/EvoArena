import { NextResponse } from "next/server";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

const CURVE_MODES = ["Normal", "Defensive", "VolatilityAdaptive"];

/**
 * POST /api/demo
 *
 * Triggers the off-chain agent in --once mode.
 * Reads the latest update summary JSON produced by the agent.
 * Falls back to on-chain read if agent is not configured.
 */
export async function POST() {
  try {
    const agentDir = path.resolve(process.cwd(), "../agent");
    const agentEnv = path.join(agentDir, ".env");
    const hasEnv = fs.existsSync(agentEnv);

    // ── Try to run the real agent ───────────────────────────────────
    if (hasEnv) {
      try {
        // Run agent in --once mode with a 45-second timeout
        execSync("npx ts-node src/index.ts --once", {
          cwd: agentDir,
          timeout: 45_000,
          env: { ...process.env, NODE_ENV: "production" },
          stdio: "pipe",
        });

        // Find the latest update summary file
        const updatesDir = path.join(agentDir, "updates");
        if (fs.existsSync(updatesDir)) {
          const files = fs.readdirSync(updatesDir).filter((f) => f.endsWith(".json")).sort();
          if (files.length > 0) {
            const latest = JSON.parse(
              fs.readFileSync(path.join(updatesDir, files[files.length - 1]), "utf-8")
            );
            return NextResponse.json({
              success: true,
              live: true,
              ruleFired: latest.ruleFired || "unknown",
              feeBps: latest.proposedParams?.feeBps ?? latest.feeBps,
              curveBeta: latest.proposedParams?.curveBeta ?? latest.curveBeta,
              curveMode: latest.proposedParams?.curveMode ?? latest.curveMode,
              curveModeName:
                CURVE_MODES[latest.proposedParams?.curveMode ?? 0] || "Unknown",
              txHash: latest.txHash || null,
              aps: latest.aps ?? null,
              expectedImpact: latest.expectedImpact || "",
              agentAddress: latest.agentAddress || "",
              message: latest.txHash
                ? `Live update submitted: ${latest.txHash}`
                : latest.expectedImpact === "no-change"
                  ? "No parameter change needed this epoch."
                  : "Agent ran successfully (dry-run or no-change).",
            });
          }
        }

        return NextResponse.json({
          success: true,
          live: true,
          message: "Agent ran but no update summary found.",
        });
      } catch (execErr: any) {
        // Agent execution failed — fall through to on-chain read
        console.error("[api/demo] Agent exec error:", execErr.stderr?.toString() || execErr.message);
        return NextResponse.json({
          success: false,
          live: false,
          error: `Agent execution failed: ${execErr.stderr?.toString().slice(0, 300) || execErr.message}`,
          hint: "Check agent/.env configuration and ensure the agent is set up correctly.",
        }, { status: 500 });
      }
    }

    // ── Fallback: read current on-chain state via ethers ────────────
    const { ethers } = await import("ethers");
    const rpc = process.env.NEXT_PUBLIC_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
    const poolAddr = process.env.NEXT_PUBLIC_EVOPOOL_ADDRESS || "";

    if (!poolAddr) {
      return NextResponse.json({
        success: false,
        live: false,
        error: "Agent .env not configured and NEXT_PUBLIC_EVOPOOL_ADDRESS not set.",
        hint: "Deploy contracts and configure the agent, or set frontend env vars.",
      }, { status: 400 });
    }

    const provider = new ethers.JsonRpcProvider(rpc);
    const pool = new ethers.Contract(poolAddr, [
      "function feeBps() view returns (uint256)",
      "function curveBeta() view returns (uint256)",
      "function curveMode() view returns (uint8)",
      "function tradeCount() view returns (uint256)",
    ], provider);

    const [feeBps, curveBeta, curveMode, tradeCount] = await Promise.all([
      pool.feeBps(),
      pool.curveBeta(),
      pool.curveMode(),
      pool.tradeCount(),
    ]);

    return NextResponse.json({
      success: true,
      live: false,
      ruleFired: "read-only",
      feeBps: Number(feeBps),
      curveBeta: Number(curveBeta),
      curveMode: Number(curveMode),
      curveModeName: CURVE_MODES[Number(curveMode)] || "Unknown",
      tradeCount: Number(tradeCount),
      txHash: null,
      message: "Agent not configured. Showing current on-chain state (read-only).",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
