# EvoArena — Adaptive AI-Driven Liquidity Infrastructure for BNB Chain

> A permissionless AI agent marketplace where autonomous agents compete to control AMM parameters, dynamically reshaping bonding curves, fees, and liquidity — outperforming static AMMs in capital efficiency and volatility control.

## 🏗 Architecture

```
┌────────────────────────────────────────────┐
│             Frontend UI (Next.js 14)       │
│  Pool · Agents · Swap · Liquidity · Audit  │
│  History · Settings · Demo                 │
└──────────────────▲─────────────────────────┘
                   │
┌──────────────────┴─────────────────────────┐
│          Off-Chain Agent (Node.js)          │
│  ML Strategy · Circuit Breaker · Backtester│
│  Multi-Pool · Volatility · APS Calculator  │
└──────────────────▲─────────────────────────┘
                   │ signed tx
┌──────────────────┴─────────────────────────┐
│        AgentController.sol                 │
│  Bounds · Cooldown · Slash · ERC-20 Bond   │
└──────────────────▲─────────────────────────┘
                   │
┌──────────────────┴─────────────────────────┐
│  EpochManager.sol  │    TimeLock.sol       │
│  Competition · Rewards · Scoring           │
└──────────────────▲─────────────────────────┘
                   │
┌──────────────────┴─────────────────────────┐
│           EvoPool.sol (AMM)                │
│  ERC-20 LP · TWAP Oracle · Protocol Fee   │
│  3 Curve Modes · Balance-Diff Accounting   │
│  EIP-2612 Permit                           │
└──────────────────┬─────────────────────────┘
                   │
┌──────────────────▼─────────────────────────┐
│      BNB Greenfield (Decentralized Storage)│
│  Audit Logs · Strategy Decisions           │
│  Pool Snapshots · Tamper-Proof Records     │
└────────────────────────────────────────────┘
```

## 📦 Repository Structure

```
contracts/                Solidity smart contracts (Hardhat)
  EvoPool.sol             Adaptive AMM with ERC-20 LP, TWAP, protocol fees, EIP-2612 Permit
  AgentController.sol     Agent registry, bounds, cooldown, slashing, ERC-20 token bonding
  EpochManager.sol        On-chain epoch-based multi-agent competition
  TimeLock.sol            Governance timelock (queue/execute/cancel)
  EvoToken.sol            Minimal ERC-20 for protocol coordination
  interfaces/             Contract interfaces (IEvoPool, IAgentController, IEpochManager)

test/                     Contract tests (Mocha + Chai, 152 passing)
  AgentController.test.ts 45 tests — registration, updates, slashing, bonding
  EvoPool.test.ts         38 tests — liquidity, swaps, TWAP, protocol fees, pause
  EpochManager.test.ts    23 tests — epochs, proposals, finalization, rewards
  TimeLock.test.ts        9 tests — queue, execute, cancel, access control
  E2E.test.ts             13 tests — full lifecycle integration test
  Invariant.test.ts       24 tests — K invariant, reserve positivity, TWAP monotonicity, LP proportionality, stress

scripts/                  Deploy, verify & demo scripts
  deploy.ts               Full deployment with TimeLock governance transfer
  demo-local.ts           One-command live simulation (11 scenarios)

agent/                    Off-chain Node.js agent
  src/
    index.ts              Main loop — multi-pool, ML integration, circuit breaker
    executor.ts           On-chain execution with multicall batching
    strategyEngine.ts     Rule-based strategy engine (3 curve modes)
    mlStrategy.ts         Online linear regression ML model
    backtester.ts         Historical backtesting framework
    circuitBreaker.ts     Anomaly detection & auto-halt
    volatility.ts         EMA-based volatility calculator
    apsCalculator.ts      Agent Performance Score computation
    config.ts             Environment configuration
  state/                  APS snapshots & update logs

frontend/                 Next.js 14 dashboard (App Router + Tailwind)
  src/app/
    page.tsx              Pool overview with live charts
    agents/page.tsx       Agent leaderboard
    swap/page.tsx         Token swap UI
    liquidity/page.tsx    Add/remove liquidity UI
    history/page.tsx      Transaction history (Swaps, Liquidity, Parameters)
    settings/page.tsx     Agent strategy configuration UI
    demo/page.tsx         Interactive demo
    api/agent-stats/      REST API for agent stats
    api/aps/              APS scoring endpoint
  src/hooks/
    useEvoPool.ts         Pool state hook
    useWallet.tsx         Multi-wallet context (MetaMask + WalletConnect)
    usePolling.ts         Generic real-time polling hook
  src/lib/
    contracts.ts          ABIs, addresses, constants
    wallet.ts             Multi-wallet connection (MetaMask, WalletConnect, injected)
  src/components/
    Charts.tsx            Recharts visualizations
    WalletButton.tsx      Connect wallet button

subgraph/                 The Graph subgraph scaffold
  subgraph.yaml           Data source configuration (EvoPool, Controller, EpochManager)
  schema.graphql          Entity schema (Swap, Agent, Epoch, Proposal, etc.)
  src/mapping.ts          Event handlers

docs/                     Architecture, demo script, agent spec
.github/workflows/ci.yml  3-job CI pipeline (test+coverage+lint, agent, frontend)
```

## ✨ Features

### Smart Contracts
- **EvoPool**: Adaptive AMM with 3 curve modes (Normal, Defensive, VolatilityAdaptive)
- **ERC-20 LP Tokens**: Full ERC-20 composability with EIP-2612 Permit support
- **TWAP Oracle**: Uniswap-V2-style time-weighted average price accumulators
- **Protocol Fee Switch**: Configurable protocol fee (up to 20% of swap fee)
- **Balance-Diff Accounting**: Safe token accounting via balance snapshots
- **EpochManager**: On-chain multi-agent competition with scoring and rewards
- **TimeLock**: Governance timelock for admin operations (24h–7d delay)
- **ERC-20 Token Bonding**: Agents can stake ERC-20 tokens in addition to native bonds
- **Emergency Pause**: Owner can halt swaps/deposits while allowing LP emergency exits
- **Formal Slashing Criteria**: 3 enumerated conditions for agent slashing
- **Rate Limiting**: `parameterUpdateBlock` tracking prevents flash-loan attacks

### Off-Chain Agent
- **ML Strategy Engine**: Online linear regression with confidence-weighted predictions
- **Historical Backtesting**: Replay-based backtesting framework with strategy comparison
- **Circuit Breaker**: Anomaly detection (reserve drain, price crash, rapid updates)
- **Multi-Pool Support**: Single agent instance manages multiple pools
- **Gas Optimization**: Multicall batching for on-chain execution

### Frontend
- **7 Pages**: Pool, Agents, Swap, Liquidity, History, Settings, Demo
- **Multi-Wallet**: MetaMask + WalletConnect support
- **Real-Time Polling**: Auto-refresh pool and agent data
- **Agent Settings UI**: Submit parameter updates directly from the browser
- **Transaction History**: Browse swaps, liquidity events, and parameter updates
- **Mobile-Responsive**: Hamburger navigation for mobile devices
- **Agent Stats API**: REST endpoint at `/api/agent-stats?address=0x...`

### DevOps
- **3-Job CI Pipeline**: test+coverage+lint, agent build, frontend build
- **Gas Snapshot**: Automated gas reporting as CI artifact
- **BSC Testnet + Mainnet**: Dual-network Hardhat configuration
- **Subgraph Scaffold**: Ready for The Graph deployment

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18
- npm or yarn
- BSC Testnet (Chapel) RPC + funded wallet

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Fill in PRIVATE_KEY, BSC_TESTNET_RPC, BSCSCAN_API_KEY
```

### 3. Compile contracts
```bash
npx hardhat compile
```

### 4. Run tests
```bash
npx hardhat test          # 152 tests
npx hardhat coverage      # Coverage report
npm run test:gas          # Gas usage report
```

### 5. Deploy to BSC Testnet
```bash
npx hardhat run scripts/deploy.ts --network bscTestnet
```

### 6. Run the agent
```bash
cd agent && npm install
npm run once              # Single epoch
npm start                 # Continuous loop
npm run backtest          # Historical backtesting
```

### 7. Start frontend
```bash
cd frontend && npm install && npm run dev
```

### 8. Full demo
```bash
./demo.sh          # Quick: live simulation only (~5s)
./demo.sh full     # Full: compile + 152 tests + simulation + gas report
```

## 📊 Test Coverage

152 tests passing across 6 test files.

| Contract | Statements | Branches | Functions | Lines |
|----------|-----------|----------|-----------|-------|
| AgentController.sol | 100% | 78.89% | 100% | 100% |
| EvoPool.sol | 97.37% | 71.57% | 100% | 97.60% |
| EpochManager.sol | 92.73% | 65.38% | 86.67% | 95.00% |
| TimeLock.sol | 89.47% | 59.38% | 80.00% | 85.19% |
| **All contracts** | **95.38%** | **70.86%** | **93.22%** | **95.92%** |

## 📊 APS (Agent Performance Score)

Each epoch the agent computes:

| Component | Weight | Formula |
|-----------|--------|---------|
| LP Return Δ | 0.40 | `(lpReturn_agent - lpReturn_static) / lpReturn_static` |
| Slippage Reduction | 0.30 | `1 - (avgSlippage_agent / avgSlippage_static)` |
| Volatility Compression | 0.20 | `(σ_static - σ_agent) / σ_static` |
| Fee Revenue | 0.10 | `feeRevenue_agent / totalVolume` |

```
APS = 0.4·LPΔ + 0.3·SlippageReduction + 0.2·VolatilityCompression + 0.1·FeeRevenue
```

## 🔐 Security Model

| Constraint | Default | Configurable |
|------------|---------|-------------|
| Max fee change per update | 50 bps | ✅ |
| Max curveBeta change | 2000 (0.2 scaled) | ✅ |
| Cooldown between updates | 5 minutes | ✅ |
| Minimum agent bond | 0.01 tBNB | ✅ |
| Max fee cap | 500 bps (5%) | ✅ |
| Protocol fee cap | 2000 bps (20%) | ✅ |
| Governance timelock | 24h minimum | ✅ |
| Emergency pause | Owner only | ✅ |
| Formal slashing criteria | 3 conditions | ✅ |

### Slashing Conditions
1. **Excessive Deviation**: Parameters deviate >200bps from optimal in a single update
2. **Rapid Oscillation**: >5 updates within 10 minutes suggesting manipulation
3. **Manipulation Detected**: Evidence of coordinated front-running or sandwich attacks

## 🔗 Contract Addresses

After deployment, addresses are saved to `deployment.json`. Update your `.env` file with the NEXT_PUBLIC_ variants for the frontend.

## � BNB Greenfield Integration

EvoArena integrates **BNB Greenfield** decentralized storage to create an immutable, tamper-proof audit trail of all AI agent decisions.

### What We Store
| Data Type | Description |
|---|---|
| **Agent Strategy Logs** | Every parameter update (fee, curveBeta, curveMode) is logged as a JSON object with timestamp, TX hash, and pool state |
| **Pool Snapshots** | Reserve balances and price data at the time of each agent decision |
| **Agent Metadata** | Registration events and strategy descriptions |

### How It Works
1. Agent submits parameter update on-chain via `AgentController.sol`
2. After TX confirmation, a structured JSON log is uploaded to Greenfield bucket `evoarena-audit-logs`
3. Logs are publicly readable — anyone can verify agent decisions
4. The `/audit` page in the frontend browses and displays all stored logs

### Greenfield Testnet Details
| Property | Value |
|---|---|
| Chain ID | `greenfield_5600-1` |
| RPC | `https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org` |
| Storage Provider | `https://gnfd-testnet-sp1.bnbchain.org` |
| Bucket | `evoarena-audit-logs` |
| Explorer | [testnet.greenfieldscan.com](https://testnet.greenfieldscan.com/) |
| SDK | `@bnb-chain/greenfield-js-sdk v2.2.2` |

### Why Greenfield?
- **Transparency**: All AI agent decisions are publicly auditable
- **Immutability**: Stored on decentralized storage, not a centralized database
- **BNB Ecosystem**: Bridges BSC smart contracts with Greenfield storage
- **Cross-Chain**: Same wallet works on both BSC and Greenfield

## �🔗 References

- [Optimal Dynamic Fees for AMMs](https://arxiv.org/abs/2106.14404)
- [Uniswap v3 Concentrated Liquidity](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)
- [Bancor IL Protection](https://docs.bancor.network/)
- [Autonomous AI Agents in DeFi](https://arxiv.org/abs/2312.08027)

## 📝 License

MIT — see [LICENSE](./LICENSE).
