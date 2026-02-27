# EvoArena Architecture

## System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                      │
│  Pool View │ Agent View │ Demo Panel │ APS Leaderboard       │
└──────────────────────────┬──────────────────────────────────┘
                           │ ethers.js (read-only RPC)
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                  BSC Testnet (Chapel, Chain 97)               │
│                                                              │
│  ┌──────────────┐    setController()   ┌──────────────────┐  │
│  │  EvoPool.sol  │◄────────────────────│AgentController.sol│  │
│  │              │    updateParameters() │                  │  │
│  │ • reserves   │                      │ • agent registry │  │
│  │ • feeBps     │                      │ • bond staking   │  │
│  │ • curveBeta  │                      │ • cooldown       │  │
│  │ • curveMode  │                      │ • delta limits   │  │
│  │ • swap()     │                      │ • slashing       │  │
│  │ • add/remove │                      │ • pause          │  │
│  │   Liquidity  │                      └───────▲──────────┘  │
│  └──────────────┘                              │             │
│                                                │             │
│  ┌──────────────┐  ┌──────────────┐            │             │
│  │ EvoToken A   │  │ EvoToken B   │   submitParameterUpdate()│
│  │ (ERC-20)     │  │ (ERC-20)     │            │             │
│  └──────────────┘  └──────────────┘            │             │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
                           ┌─────────────────────┴──────────┐
                           │     Off-Chain Agent (Node.js)   │
                           │                                 │
                           │  1. Poll pool state (reserves,  │
                           │     fee, trades)                │
                           │  2. Compute features:           │
                           │     - EMA volatility            │
                           │     - Trade velocity            │
                           │     - Whale detection           │
                           │  3. Rule engine → suggestion    │
                           │  4. Sign + submit update TX     │
                           │  5. Compute APS → save snapshot │
                           └──────────────┬──────────────────┘
                                          │
                           ┌──────────────▼──────────────────┐
                           │    BNB Greenfield (Testnet)      │
                           │    Decentralized Storage          │
                           │                                   │
                           │  • Bucket: evoarena-audit-logs    │
                           │  • Agent strategy decision logs   │
                           │  • Pool state snapshots           │
                           │  • Tamper-proof audit trail       │
                           │  • Public read access             │
                           └───────────────────────────────────┘
```

## Mermaid Diagram

```mermaid
graph TD
    FE[Frontend - Next.js] -->|read state| POOL[EvoPool.sol]
    FE -->|read agents| CTRL[AgentController.sol]
    FE -->|trigger demo| API[/api/demo]
    FE -->|browse audit logs| GF[BNB Greenfield]
    API -->|exec| AGENT[Off-Chain Agent]
    
    AGENT -->|poll reserves, fee, events| POOL
    AGENT -->|submitParameterUpdate| CTRL
    CTRL -->|updateParameters| POOL
    
    AGENT -->|store decision log| GF
    FE -->|upload strategy log| GF
    
    POOL --- TKA[EvoToken A]
    POOL --- TKB[EvoToken B]
    
    CTRL -->|slash| OWNER[Owner / Guardian]
    
    subgraph On-Chain [BSC Testnet]
        POOL
        CTRL
        TKA
        TKB
    end
    
    subgraph Off-Chain
        AGENT
        APS[APS Calculator]
        AGENT --> APS
    end
    
    subgraph Decentralized Storage [BNB Greenfield]
        GF
    end
```

## Parameter Bound Table

| Parameter | Type | Min | Max | Max Δ per Update | Default |
|-----------|------|-----|-----|------------------|---------|
| feeBps | uint256 | 0 | 500 (5%) | 50 bps | 30 |
| curveBeta | uint256 | 0 | 10000 (1.0) | 2000 (0.2) | 5000 (0.5) |
| curveMode | enum | 0 | 2 | any | 0 (Normal) |
| cooldown | time | — | — | — | 300s (5 min) |
| minBond | uint256 | — | — | — | 0.01 BNB |

## Curve Modes

| Mode | ID | Behavior |
|------|----|----------|
| Normal | 0 | Standard constant-product `x·y=k` |
| Defensive | 1 | Quadratic whale penalty: `effectiveIn = amountIn × (1 + β·W²)` |
| VolatilityAdaptive | 2 | Linear spread widening: `effectiveIn = amountIn × (1 + β·ratio)` |

## Agent Protocol — Update Payload

The agent submits updates via `AgentController.submitParameterUpdate()`:

```solidity
function submitParameterUpdate(
    uint256 newFeeBps,      // proposed fee in basis points
    uint256 newCurveBeta,   // proposed curve beta (scaled 1e4)
    uint8   newCurveMode    // proposed mode: 0, 1, or 2
) external
```

### Validation (on-chain):
1. Caller must be registered agent with `active = true`
2. `agent.bondAmount >= minBond`
3. `block.timestamp >= agent.lastUpdateTime + cooldownSeconds`
4. `|newFeeBps - currentFee| <= maxFeeDelta`
5. `|newCurveBeta - currentBeta| <= maxBetaDelta`
6. `newFeeBps <= MAX_FEE_BPS (500)`
7. `newCurveMode ∈ {0, 1, 2}`

### Off-chain summary (JSON):

```json
{
  "timestamp": "2026-02-27T12:00:00Z",
  "agentAddress": "0x...",
  "featuresUsed": {
    "volatility": 0.035,
    "tradeVelocity": 12,
    "whaleDetected": true,
    "maxWhaleRatio": 0.08
  },
  "ruleFired": "high-volatility+whale",
  "currentParams": { "feeBps": 30, "curveBeta": 5000, "curveMode": 0 },
  "proposedParams": { "feeBps": 50, "curveBeta": 5500, "curveMode": 1 },
  "expectedImpact": "fee 30 → 50, beta 5000 → 5500, mode 0 → 1",
  "txHash": "0x...",
  "dryRun": false
}
```

## APS (Agent Performance Score)

```
APS = 0.4 × LP_Return_Delta
    + 0.3 × Slippage_Reduction
    + 0.2 × Volatility_Compression
    + 0.1 × Fee_Revenue_Normalized

Where:
  LP_Return_Delta     = (agentReturn - staticReturn) / staticReturn
  Slippage_Reduction  = 1 - (agentSlippage / staticSlippage)
  Volatility_Compression = (σ_static - σ_agent) / σ_static
  Fee_Revenue_Normalized = feeRevenue / totalVolume
```

## Security Design

- **On-chain bounds**: All parameter changes are bounded by configurable limits
- **Cooldown**: Minimum 5 minutes between updates per agent
- **Bond requirement**: Agents must stake BNB as a slashable bond
- **Slashing**: Owner can slash malicious agents (guardian role)
- **Emergency pause**: Owner can pause all updates
- **No fund access**: Agents never hold or control LP funds

## References

- [Optimal Dynamic Fees in AMMs](https://arxiv.org/abs/2106.14404) — theoretical basis for volatility → fee mapping
- [Uniswap v3 Concentrated Liquidity](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity) — capital efficiency inspiration
- [Bancor IL Protection](https://docs.bancor.network/) — LP protection reference
- [Autonomous AI Agents in DeFi](https://arxiv.org/abs/2312.08027) — agent design patterns
