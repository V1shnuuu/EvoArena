import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { CONTROLLER_ABI, EPOCH_MANAGER_ABI, EVOPOOL_ABI, ADDRESSES, BSC_TESTNET_RPC } from "@/lib/contracts";

/**
 * #29 — Agent Dashboard Stats API
 *
 * GET /api/agent-stats?address=0x...
 *
 * Returns on-chain stats for a specific agent:
 * - registration info & bond
 * - update count
 * - epoch participation / wins
 * - pool state snapshot
 */
export async function GET(req: NextRequest) {
  const agentAddr = req.nextUrl.searchParams.get("address");

  if (!agentAddr || !ethers.isAddress(agentAddr)) {
    return NextResponse.json({ error: "Missing or invalid `address` param" }, { status: 400 });
  }

  try {
    const rpc = process.env.BSC_TESTNET_RPC || BSC_TESTNET_RPC;
    const provider = new ethers.JsonRpcProvider(rpc);

    const controllerAddr = ADDRESSES.agentController;
    const epochAddr = ADDRESSES.epochManager;
    const poolAddr = ADDRESSES.evoPool;

    if (!controllerAddr || !poolAddr) {
      return NextResponse.json({ error: "Contract addresses not configured" }, { status: 500 });
    }

    const controller = new ethers.Contract(controllerAddr, CONTROLLER_ABI, provider);
    const pool = new ethers.Contract(poolAddr, EVOPOOL_ABI, provider);

    // Fetch agent info
    const info = await controller.getAgentInfo(agentAddr);
    const updateCount = await controller.updateCount(agentAddr);

    // Fetch pool state
    const [r0, r1] = await pool.getReserves();
    const feeBps = await pool.feeBps();
    const curveBeta = await pool.curveBeta();
    const curveMode = await pool.curveMode();
    const tradeCount = await pool.tradeCount();
    const volume0 = await pool.cumulativeVolume0();
    const volume1 = await pool.cumulativeVolume1();

    // Epoch stats (if epoch manager is deployed)
    let epochStats = null;
    if (epochAddr) {
      try {
        const epochMgr = new ethers.Contract(epochAddr, EPOCH_MANAGER_ABI, provider);
        const currentEpoch = await epochMgr.currentEpochId();
        const timeRemaining = await epochMgr.getTimeRemaining();

        epochStats = {
          currentEpoch: currentEpoch.toString(),
          timeRemaining: timeRemaining.toString(),
        };
      } catch {
        // EpochManager may not be deployed or linked
      }
    }

    const response = {
      agent: {
        address: info.agentAddress,
        bondAmount: ethers.formatEther(info.bondAmount),
        tokenBondAmount: ethers.formatEther(info.tokenBondAmount),
        registeredAt: info.registeredAt.toString(),
        lastUpdateTime: info.lastUpdateTime.toString(),
        active: info.active,
        updateCount: updateCount.toString(),
      },
      pool: {
        reserve0: ethers.formatEther(r0),
        reserve1: ethers.formatEther(r1),
        feeBps: feeBps.toString(),
        curveBeta: curveBeta.toString(),
        curveMode: Number(curveMode),
        tradeCount: tradeCount.toString(),
        cumulativeVolume0: ethers.formatEther(volume0),
        cumulativeVolume1: ethers.formatEther(volume1),
      },
      epoch: epochStats,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (err: any) {
    return NextResponse.json(
      { error: "Failed to fetch agent stats", details: err.message },
      { status: 500 }
    );
  }
}
