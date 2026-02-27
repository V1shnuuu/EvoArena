# EvoArena — BNB Chain Demo Walkthrough

> **Network**: BSC Testnet (Chain 97)  
> **Frontend**: http://localhost:3000  
> **Deployer wallet**: `0x3E7716BeE2D7E923CB9b572EB169EdFB6cdbDAB6`

---

## Prerequisites

1. **MetaMask** installed with BSC Testnet configured  
2. **tBNB** — get from [BNB Faucet](https://testnet.bnbchain.org/faucet-smart)  
3. Frontend running: `cd frontend && npm run dev`

---

## Demo Script (Step-by-Step)

### 🏠 1. Pool Dashboard (`/`)

**What to show**: Real-time on-chain pool state with live charts.

| Test | Action | Expected |
|------|--------|----------|
| Pool stats load | Open `/` | Reserve0, Reserve1, Price, Trade count all populate from BSC Testnet |
| Curve mode displayed | Check "Curve Mode" card | Shows Normal/Defensive/VolatilityAdaptive with color |
| Fee & Beta | Check "Fee" and "Curve Beta" cards | Shows current bps and beta values |
| Live charts | Watch "Fee & Beta History" + "Reserve Balances" charts | Chart renders; reserves update if trades occur |
| Mode timeline | Scroll to "Curve Mode Timeline" | Shows mode changes over time |
| Parameter history table | Scroll to "Recent Parameter Updates" | Lists all on-chain `ParametersUpdated` events with BscScan links |
| Polling | Wait 8 seconds | Stats auto-refresh without page reload |

---

### 🔄 2. Swap Page (`/swap`)

**What to show**: Token swaps with real slippage controls and trade details.

| Test | Action | Expected |
|------|--------|----------|
| Connect wallet | Click "Connect Wallet" if not connected | MetaMask prompt → BSC Testnet auto-switch |
| Select direction | Toggle EVOA→EVOB or EVOB→EVOA | Labels and token names update |
| Enter amount | Type `100` in the input | Estimated output appears in real-time |
| **Price impact** | Check "Trade Details" panel | Shows price impact % (green < 1%, yellow 1-5%, red > 5%) |
| **Min received** | Check "Trade Details" | Shows `Min. Received` factoring in current slippage tolerance |
| **Change slippage** | Click `0.5%`, `1%`, `2%` or type custom | Min. Received updates immediately; button highlights gold |
| Fee + Route | Check "Trade Details" | Shows fee in bps and route (EVOA → EVOB) |
| Execute swap | Click "Swap" | MetaMask popup → approve token → swap TX → "Swap successful!" with BscScan link |
| Pool updates | Go back to `/` | Reserves changed, trade count incremented |

**Edge cases**:
- Enter `0` → Swap button disabled
- Enter a huge number (more than reserves) → TX reverts, error shown
- Disconnect wallet → "Connect Wallet" prompt shown

---

### 🤖 3. Agents Page (`/agents`)

**What to show**: AI agent registry, registration, and APS leaderboard.

| Test | Action | Expected |
|------|--------|----------|
| No agents state | Visit `/agents` if no agents registered | Shows "No Agents Registered Yet" with step-by-step guide |
| Register agent | Enter bond amount (e.g., `0.01` BNB) → Click "Register Agent" | MetaMask popup → TX confirms → agent appears in table within 15s |
| "You" badge | Check your agent row | Shows golden "You" badge next to your address |
| BscScan link | Click the address link | Opens agent address on testnet.bscscan.com |
| Agent details | Check columns | Bond amount (in BNB), registered time, active status, last update |
| APS chart | Scroll to "Agent Performance Score" | Chart loads from `/api/aps` endpoint |
| Auto-refresh | Wait 15 seconds | Agent list polls automatically (no page reload needed) |
| Parameter history | Scroll to bottom | Shows which agents submitted which parameter changes |

---

### ⚙️ 4. Settings Page (`/settings`)

**What to show**: Agent parameter submission with cooldown system.

| Test | Action | Expected |
|------|--------|----------|
| Not connected | Visit without wallet | "Connect your wallet" message |
| Not an agent | Connect but don't register | Shows "Register as Agent" form with bond input |
| Register | Enter bond, click Register | TX confirms, form switches to "Agent Status" + "Submit Parameter Update" |
| Agent status | Check bond amount and cooldown | Shows bonded BNB and ✓ Ready or ✗ Cooling down |
| Change fee | Set Fee to `50` (from `30`) | Input accepts value; current value shown below |
| Change beta | Set Beta to `5000` (from `1000`) | Input accepts value |
| Change mode | Select "Defensive" from dropdown | Dropdown shows all 3 modes |
| Submit update | Click "Submit Update" | MetaMask TX → BscScan link appears → pool state updates |
| Cooldown | Try submitting again immediately | Button says "Cooldown Active" and is disabled |
| Strategy guide | Scroll down | Shows tips for Normal, Defensive, VolatilityAdaptive modes |

---

### 💧 5. Liquidity Page (`/liquidity`)

**What to show**: Add/remove liquidity from the adaptive pool.

| Test | Action | Expected |
|------|--------|----------|
| Pool info | Check pool stats at top | Reserves, LP supply, share calculation |
| Add liquidity | Enter equal amounts of EVOA + EVOB → Click "Add Liquidity" | MetaMask approvals → add TX → LP tokens received |
| LP balance | Check "Your LP Balance" | Shows LP token balance after adding |
| Remove liquidity | Enter LP amount → Click "Remove Liquidity" | Burns LP → returns proportional EVOA + EVOB |

---

### 📜 6. History Page (`/history`)

**What to show**: Complete on-chain event explorer.

| Test | Action | Expected |
|------|--------|----------|
| Events load | Visit `/history` | Lists Swaps, LiquidityAdded, ParameterUpdates, AgentRegistered events |
| Filter | Click "Swap" filter | Only swap events shown |
| Filter "AgentRegistered" | Click "AgentRegistered" | Only agent registration events |
| Block range | Change to "Last 10K blocks" | Fetches more historical events |
| BscScan links | Click "TX ↗" on any event | Opens transaction on testnet.bscscan.com |

---

### 🎬 7. Demo Mode (`/demo`)

**What to show**: Automated demo that runs test scenarios.

| Test | Action | Expected |
|------|--------|----------|
| Run demo | Click "Run Full Demo" | Sequentially executes: mints, approvals, add liquidity, swaps, agent registration, parameter update, epoch advance |
| Step-by-step | Watch the log output | Each step shows TX hash with BscScan link |
| Live pool updates | Switch to `/` during demo | Pool reserves and parameters change in real-time |

---

## 🧪 Full Test Matrix

### Wallet Tests
| # | Test | How |
|---|------|-----|
| W1 | Connect MetaMask | Click connect → approve |
| W2 | Wrong network | Switch to Ethereum mainnet → should prompt BSC Testnet switch |
| W3 | Disconnect | Click disconnect → all pages show connect prompt |
| W4 | Auto-reconnect | Refresh page with wallet already connected → auto-reconnects |
| W5 | Account switch | Change MetaMask account → address updates across all pages |

### Swap Tests
| # | Test | How |
|---|------|-----|
| S1 | Normal swap | 100 EVOA → EVOB |
| S2 | Reverse direction | Toggle to EVOB → EVOA, swap 50 |
| S3 | Slippage 0.5% | Set slippage to 0.5%, verify min received is tighter |
| S4 | Slippage 5% | Set slippage to 5%, verify min received is looser |
| S5 | Custom slippage | Type 3.5%, verify it applies |
| S6 | Large trade | Swap half the reserves → high price impact (red) |
| S7 | Tiny trade | Swap 0.001 → near-zero price impact |

### Agent Tests
| # | Test | How |
|---|------|-----|
| A1 | Register agent | Register with 0.01 BNB bond |
| A2 | Submit parameter update | Change fee from 30 to 50 bps |
| A3 | Cooldown enforcement | Try updating again → button disabled |
| A4 | Multiple agents | Register from a 2nd wallet → both appear in leaderboard |

### Liquidity Tests
| # | Test | How |
|---|------|-----|
| L1 | Add balanced liquidity | Add 1000 EVOA + 1000 EVOB |
| L2 | Remove partial | Remove 50% of LP tokens |
| L3 | Remove all | Remove 100% → LP balance = 0 |

### History Tests
| # | Test | How |
|---|------|-----|
| H1 | All events | Verify all event types appear after above tests |
| H2 | Filter works | Each filter button isolates its event type |
| H3 | BscScan link | Click any TX link → opens correct transaction |

---

## 📋 Quick Hackathon Demo (3-minute version)

1. **Open Pool Dashboard** → "Here's our adaptive AMM running live on BSC Testnet"
2. **Go to Swap** → Swap 100 EVOA→EVOB → "Notice the price impact, slippage protection, and on-chain execution"
3. **Go to Agents** → Register as agent → "AI agents compete to optimize pool parameters"
4. **Go to Settings** → Submit parameter update (change fee & mode) → "Agent just changed the pool's behavior"
5. **Go back to Pool** → "See the fee and curve mode updated in real-time from the agent's action"
6. **Go to History** → "Every action is fully transparent and verifiable on BscScan"
7. **Show BscScan** → Open any verified contract → "All 6 contracts verified and open-source"

---

## Contract Addresses (BSC Testnet)

| Contract | Address |
|----------|---------|
| EvoToken A | `0xAe6A9CaF9739C661e593979386580d3d14abB502` |
| EvoToken B | `0x08DA91C81cebD27d181cA732615379f185FbFb51` |
| EvoPool | `0x36Fda9F9F17ea5c07C0CDE540B220fC0697bBcE3` |
| AgentController | `0x163f03E4633B86fBB5C82c6e6a6aCbD1452bEe7c` |
| EpochManager | `0xab07a553a7237c39fBbf74b7FcC003013D0618D3` |
| TimeLock | `0xf967B398c6Df05a1ED6b9DE15f0B93f8f253c1a6` |

All verified on [testnet.bscscan.com](https://testnet.bscscan.com).
