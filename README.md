  # EvoArena
  > **Adaptive AI-Driven Liquidity Infrastructure for BNB Chain**

  An autonomous liquidity protocol that dynamically adjusts automated market maker (AMM) parameters using off-chain AI agents. EvoArena optimizes liquidity efficiency and protects providers from impermanent loss by reacting to market volatility in real-time.

  ---

  ##  Project Overview

  Traditional AMMs (like Uniswap V2) use static fees and pricing curves. This "one-size-fits-all" approach fails during extreme market conditions:
  - **Low Volatility:** High fees discourage volume.
  - **High Volatility:** Low fees fail to compensate LPs for impermanent loss (IL).

  **EvoArena** introduces a **Manager-Agent Architecture** where an off-chain AI strategy engine monitors market signals (volatility, whale watching, trade velocity) and optimizes the pool's configuration on-chain.

  All agent decisions are cryptographically signed and stored on **BNB Greenfield**, creating a decentralized, immutable audit trail of the AI's "thought process."

  ---

  ##  Problem Being Addressed

  Liquidity Providers (LPs) in DeFi face a dilemma:
  1. **Static Fees:** Cannot capture value during high demand or attract volume during low demand.
  2. **Impermanent Loss:** Fixed bonding curves ($x \cdot y = k$) are vulnerable to toxic flow during price crashes.
  3. **Black Box Management:** Managed pools often lack transparency on *why* parameters were changed.

  **EvoArena solves this by:**
  1. **Dynamic Parameter Adjustment:**
    - **Fees:** 0.05% to 5.00% based on volatility.
    - **Curve Beta:** Adjusts capital concentration.
    - **Curve Mode:** Switches logic between *Normal*, *Defensive* (high volatility protection), and *Adaptive*.
  2. **Transparent Audit Trail:** Every parameter change is logged to BNB Greenfield for public verification.
  3. **ML-Based Optimization:** Agents use online learning to predict the optimal configuration that maximizes fee generation while minimizing IL.

  ---

  ##  How The System Works

  1. **Market Monitoring:** The Agent service watches pending transactions, block headers, and pool events.
  2. **Feature Extraction:** Calculates metrics like `volatility index`, `buy/sell ratio`, and `whale impact`.
  3. **Strategy Inference:** The ML Engine (`mlStrategy.ts`) predicts the best parameters (`fee`, `beta`, `mode`).
  4. **On-Chain Execution:** The Agent sends a transaction to the `AgentController` contract.
  5. **State Update:** `EvoPool` updates its internal logic (e.g., increasing fees during a crash).
  6. **Data Availability:** Detailed decision reasoning is uploaded to a dedicated bucket on **BNB Greenfield**.

  ---

  ## ✨ Key Features

  - **Adaptive AMM:** Supports 3 curve modes (Normal, Defensive, VolatilityAdaptive).
  - **AI Strategy Engine:** Online linear regression model with historical backtesting capability.
  - **Decentralized Audit Logs:** Integrity-verified storage of agent decisions on BNB Greenfield.
  - **Circuit Breaker:** Automated emergency halt if reserves are drained or rapid updates occur.
  - **Agent Performance Score (APS):** On-chain scoring system to reward efficient agents.
  - **Governance Timelock:** Critical system upgrades are delayed for security.

  ---

  ##  System Architecture

  The system consists of three core layers:

  1. **Protocol Layer (Smart Contracts):** Holds funds, executes swaps, and enforces agent rules.
  2. **Agent Layer (Off-chain):** Node.js service running the strategy engine.
  3. **Data Layer (Greenfield):** Decentralized storage for strategy logs and historical performance.
  4. **Interface Layer (Frontend):** Next.js dashboard for LPs and traders.

  ### Architecture Diagram

  ```mermaid
  graph TD
    User((Trader)) -->|Swap| Pool[EvoPool.sol]
    LP((Liquidity Prov)) -->|Add/Remove Liq| Pool
    
    subgraph "Off-Chain Agent"
        Feeds[Market Data Feeds] --> Engine[ML Strategy Engine]
        Engine -->|Predict Params| Executor[Transaction Executor]
    end
    
    Executor -->|Update Params| Controller[AgentController.sol]
    Controller -->|Set Config| Pool
    
    Executor -.->|Log Decision| Greenfield[BNB Greenfield]
    Frontend[Next.js App] -.->|Read Logs| Greenfield
    Frontend -->|Read State| Pool
```

---

##  Tech Stack

  ### Frontend
  - **Framework:** Next.js 14 (App Router)
  - **Styling:** Tailwind CSS
  - **Web3:** `ethers.js`, `@bnb-chain/greenfield-js-sdk`
  - **Visualization:** Recharts

  ### Backend / Agent
  - **Runtime:** Node.js, TypeScript
  - **AI/ML:** Custom Online Linear Regression (Gradient Descent)
  - **Blockchain Interaction:** Hardhat, Ethers.js

  ### Smart Contracts
  - **Network:** BNB Chain (BST Testnet / Mainnet)
  - **Language:** Solidity ^0.8.24
  - **Libraries:** OpenZeppelin (ERC20, Ownable)

  ### Storage
  - **Decentralized Storage:** BNB Greenfield (Bucket: `evoarena-audit-logs`)

  ---

  ##  Project Structure

  ```bash
  EvoArena-1/
  ├── contracts/              # Solidity Smart Contracts
  │   ├── EvoPool.sol         # Core AMM logic with dynamic parameters
  │   ├── AgentController.sol # Permissioned controller for agents
  │   └── interfaces/         # Standard interfaces
  ├── agent/                  # AI Strategy Agent
  │   ├── src/
  │   │   ├── mlStrategy.ts   # Machine learning model (Linear Regression)
  │   │   ├── executor.ts     # Transaction submission logic
  │   │   └── volatility.ts   # Market data feature extraction
  ├── frontend/               # Next.js Web Application
  │   ├── src/app/            # App Router pages
  │   ├── src/lib/greenfield.ts # BNB Greenfield integration
  │   └── src/components/     # React UI components
  ├── scripts/                # Deployment and utility scripts
  ├── subgraph/               # The Graph data indexing (optional)
  └── docs/                   # Architecture documentation
  ```

  ---

  ##  Module Responsibilities

  ### Smart Contracts
  - **EvoPool.sol:** The heart of the protocol. Manages reserves, swaps, and holds the current `curveMode` state.
  - **AgentController.sol:** Acts as a gatekeeper. Only whitelisted agents can call this contract to relay updates to the pool.
  - **EpochManager.sol:** Handles time-based constraints, ensuring agents don't update parameters too frequently (preventing griefing).

  ### AI Agent
  - **Volatility Calculator:** Computes standard deviation of prices over sliding windows.
  - **ML Engine:** Maintains a `weights` matrix. Adapts to new data points to minimize the error between *predicted* fee revenue and *actual* fee revenue.
  - **Backtester:** `src/backtester.ts` allows widely simulating market conditions to validate strategy safety before deployment.

  ### Frontend
  - **Dashboard:** Displays real-time pool APY, Volume, and Current Config.
  - **Audit Page:** Fetches JSON logs from Greenfield and renders them in a human-readable format.
  - **Swap Interface:** Standard swap UI that reads the *current* dynamic fee before quoting.

  ---

  ##  UML Diagrams

  ### Component Diagram

  ```mermaid
  graph TD
      subgraph OnChain [On-Chain]
          EvoPool[EvoPool]
          AgentController[AgentController]
      end
      
      subgraph OffChain [Off-Chain]
          AgentService[Agent Service]
          MLEngine[ML Engine]
      end
      
      subgraph Storage [Storage]
          Greenfield[BNB Greenfield]
      end
      
      AgentService -->|Transactions| AgentController
      AgentService -.->|Upload Logs| Greenfield
      AgentController -.->|Manage| EvoPool
      MLEngine -->|Signals| AgentService
  ```

  ### Sequence Diagram: Adaptive Update

  ```mermaid
  sequenceDiagram
      participant Market
      participant Agent
      participant Controller
      participant EvoPool
      participant Greenfield

      Market->>Agent: High Volatility Detected
      Agent->>Agent: Calculate New Params (Fee++, Beta--)
      Agent->>Greenfield: Upload Decision JSON
      Greenfield-->>Agent: Returns Object ID
      Agent->>Controller: updateParams(fee=300, beta=8000)
      Controller->>EvoPool: setPoolParams(...)
      EvoPool->>EvoPool: Update State (Fee=3.0%)
  ```

  ---

  ##  Setup Instructions

  ### Prerequisites
  - Node.js v18+
  - Git
  - BNB Testnet Wallet with tBNB

  ### 1. Installation
  ```bash
  # Clone repository
  git clone https://github.com/yourusername/evoarena.git
  cd evoarena

  # Install dependencies
  npm install
  cd frontend && npm install && cd ..
  cd agent && npm install && cd ..
  ```

  ### 2. Environment Variables
  Create `.env` in the root:
  ```env
  PRIVATE_KEY=your_private_key_here
  BSC_RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545
  GREENFIELD_RPC=https://gnfd-testnet-fullnode-tendermint-us.bnbchain.org
  ```

  ### 3. Deploy Contracts
  ```bash
  npx hardhat run scripts/deploy.ts --network bscTestnet
  # Copy the output addresses to agent/src/config.ts and frontend/src/lib/contracts.ts
  ```

  ### 4. Run the AI Agent
  ```bash
  cd agent
  # Run in ML mode (learns from active market)
  npm run ml
  ```

  ### 5. Start Frontend
  ```bash
  cd frontend
  npm run dev
  # Open http://localhost:3000
  ```

  ---

  ## 📡 API Documentation (Frontend Routes)

  The frontend exposes simple internal APIs for the UI to consume:

  | Route | Method | Description |
  |-------|--------|-------------|
  | `/api/agent-stats` | GET | Returns current agent performance metrics |
  | `/api/history` | GET | Fetches historical changes from Greenfield |
  | `/api/audit` | GET | Verifies on-chain param changes against Greenfield logs |

  ---

  ## Example End-to-End Flow

  1. **User Action:** A user opens the frontend to swap USDT for BNB.
  2. **System Check:** The frontend queries the `EvoPool` contract for the current fee rate.
  3. **Agent Intervention:** Just prior, the Agent detected high volatility (price swinging rapidly). It increased the fee from 0.3% to 1.0% to protect LPs.
  4. **Execution:** The user accepts the higher fee (or waits), and the swap executes. To the user, it looks like a standard swap.
  5. **Verification:** The user can go to the "Audit" tab and see the exact timestamp when the Agent raised the fee, along with the "High Volatility" reason code stored on Greenfield.

  ---

  ##  Limitations & Future Improvements

  1. **Centralized Agent Execution:** Currently, the agent is run by a trusted operator. Future versions will use a decentralized network of agents (AVS).
  2. **Model Privacy:** Strategy weights are currently visible in the codebase. ZK-ML could hide the model while proving correct execution.
  3. **Single Asset Pair:** The current version supports one pair per pool. Multi-token pools (Balancer style) are planned.

  ---

  ##  Hackathon Note

  This project demonstrates a full-stack integration of **DeFi + AI + DePIN (Storage)**. We moved the heavy compute (Strategy Analysis) off-chain to save gas, while using **BNB Greenfield** to ensure that "Off-chain" does not mean "Opaque".

  *Built for the BNB Chain Hackathon 2026. EvoArena Team.*
