# EvoArena — Step-by-Step Verification Walkthrough

> **Network**: BSC Testnet (Chain 97)
> **Frontend**: http://localhost:3000
> **Deployer wallet**: `0x3E7716BeE2D7E923CB9b572EB169EdFB6cdbDAB6`
> **Date**: February 2026

Use this document to verify every feature works. Check `[✓]` or `[✗]` as you go. If something fails, note the error in the **Notes** column.

---

## 0 — Setup

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 0.1 | Open terminal in `/Users/bond/EvoArena/frontend` | Terminal open | | |
| 0.2 | Run `npm run dev` | `▲ Next.js … ready on http://localhost:3000` | | |
| 0.3 | Open **http://localhost:3000** in Chrome | Page loads with dark BNB theme (black background, gold accents) | | |
| 0.4 | Open MetaMask and ensure you're on **BSC Testnet (Chain 97)** | Network shows "BSC Testnet" or "BNB Chain Testnet" | | |
| 0.5 | Ensure you have **tBNB** (get from https://testnet.bnbchain.org/faucet-smart) | Balance > 0 tBNB | | |
| 0.6 | Ensure deployer wallet (`0x3E77…`) has EVOA + EVOB tokens (minted at deploy) | BscScan shows token balances | | |

---

## 1 — Global UI Features

### 1A — Navbar & Theme

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 1.1 | Look at top navbar | Shows: ⚔️ EvoArena logo, "Powered by BNB Chain" badge, 8 nav links (Pool, Agents, Swap, Liquidity, Audit, History, Settings, Demo), theme toggle (☀️/🌙), Connect Wallet button | | |
| 1.2 | Click **☀️/🌙 theme toggle** | Page switches to light mode (white background, dark text). Gold accents remain. | | |
| 1.3 | Click theme toggle again | Switches back to dark mode | | |
| 1.4 | Refresh the page | Theme persists (localStorage) — still on whichever mode you left it | | |
| 1.5 | Click the **"Pool"** nav link | Link highlights gold, navigates to `/` | | |
| 1.6 | Click **"Swap"** nav link | "Swap" highlights gold, "Pool" un-highlights | | |
| 1.7 | Resize browser to **mobile width** (< 768px) | Hamburger menu (☰) appears, desktop nav links disappear | | |
| 1.8 | Click the **hamburger ☰** | Dropdown menu opens with all 8 nav links + theme toggle | | |
| 1.9 | Click **"Agents"** in mobile menu | Navigates to `/agents`, menu closes automatically | | |
| 1.10 | Resize back to desktop width | Full nav bar reappears, hamburger disappears | | |

### 1B — Wallet Connection

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 1.11 | Click **"Connect Wallet"** button in navbar | MetaMask popup opens, requests account access | | |
| 1.12 | Approve connection | Button changes to show truncated address: `0x3E77…B6` with a copy icon (📋) next to it | | |
| 1.13 | Click the **copy icon** next to address | Shows "✓ Copied" feedback (1.5 seconds), address is in clipboard | | |
| 1.14 | Click the red **✕** disconnect button | Address disappears, "Connect Wallet" button reappears | | |
| 1.15 | Refresh the page | Should auto-reconnect (address shows again without clicking) | | |
| 1.16 | In MetaMask, switch to **a different account** | Address in navbar updates automatically (no refresh needed) | | |
| 1.17 | In MetaMask, switch to **Ethereum Mainnet** | Should prompt to switch back to BSC Testnet (Chain 97) | | |

### 1C — Keyboard Shortcuts

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 1.18 | Press **Ctrl+1** (or Cmd+1 on Mac) | Navigates to Pool `/` | | |
| 1.19 | Press **Ctrl+3** | Navigates to Swap `/swap` | | |
| 1.20 | Press **Ctrl+5** | Navigates to Audit `/audit` | | |
| 1.21 | Press **Ctrl+7** | Navigates to Settings `/settings` | | |
| 1.22 | On Swap page, press **Ctrl+K** | Amount input field gets focused | | |

### 1D — Onboarding Tour

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 1.23 | Open browser DevTools → Application → Local Storage → delete `evo-tour-completed` key | Key removed | | |
| 1.24 | Refresh the page | After ~1.5 seconds, a tour tooltip appears pointing at the "Swap" nav link with title "Swap Tokens" | | |
| 1.25 | Click **"Next"** | Tour moves to "Provide Liquidity" → "AI Agents" → "Audit Trail" → "Agent Settings" | | |
| 1.26 | On the last step, click **"Done"** | Tour disappears, overlay removed | | |
| 1.27 | Refresh the page | Tour does NOT appear again (localStorage `evo-tour-completed` = true) | | |
| 1.28 | At any step, click **"Skip"** instead | Tour disappears and does not come back on refresh | | |

---

## 2 — Pool Dashboard (`/`)

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 2.1 | Navigate to **`/`** | Page loads with heading "🏊 EvoPool" and "Adaptive AMM…on BNB Chain" | | |
| 2.2 | Check **4 stat cards** at top | Shows: Reserve 0 (EVOA), Reserve 1 (EVOB), Price (EVOA/EVOB), Trades (total swaps). All have real values, not "0" or "NaN" | | |
| 2.3 | Check **3 parameter cards** | Shows: Fee (in bps with % below), Curve Beta (with scaled value), Curve Mode (colored: green=Normal, red=Defensive, yellow=VolatilityAdaptive) | | |
| 2.4 | Check **"Fee & Beta History"** chart | Recharts LineChart renders. If no parameter updates yet, shows "No parameter history yet" empty state | | |
| 2.5 | Check **"Reserve Balances (Live)"** chart | AreaChart renders. Shows at least 1 data point. Accumulates over time | | |
| 2.6 | Check **"Curve Mode Timeline"** chart | BarChart renders or shows empty state | | |
| 2.7 | Check **"Recent Parameter Updates"** table | Shows table with Block, Fee, Beta, Mode, Agent (truncated), TX link. Or "No parameter updates found" | | |
| 2.8 | **Wait 8-10 seconds** without doing anything | Stats auto-refresh (check browser DevTools → Network tab for RPC calls every ~8s). Reserve chart gets new data point | | |
| 2.9 | On **initial page load** (hard refresh with empty cache) | Skeleton shimmer loading animation shows for stat cards, parameter cards, and chart areas before data loads | | |
| 2.10 | If there's a **connection error** (e.g., bad RPC) | Shows red "Connection Error" message with the error text | | |

---

## 3 — Swap (`/swap`)

### 3A — UI Elements

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 3.1 | Navigate to **`/swap`** | Page shows "💱 Swap" heading, pool info banner, and swap card | | |
| 3.2 | Check **pool info banner** | Shows: Current Fee (bps + %), Curve Mode (colored), Price | | |
| 3.3 | Check **direction toggle** | Shows "EVOA → EVOB" with ⇄ arrow button | | |
| 3.4 | Click the **direction button** | Arrow rotates 180° (animated), direction switches to "EVOB → EVOA" | | |
| 3.5 | Click direction again | Arrow rotates back, "EVOA → EVOB" | | |
| 3.6 | Check **balance display** (wallet connected) | Shows "Balance: X.XXXX" with a gold **MAX** button next to it | | |
| 3.7 | Click **MAX** button | Input fills with your full token balance | | |
| 3.8 | Check **slippage buttons** | Three buttons: 0.5%, 1.0%, 2.0%. Default 1.0% is highlighted gold | | |
| 3.9 | Click **0.5%** slippage | 0.5% button highlights gold, 1.0% un-highlights | | |

### 3B — Trade Calculations

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 3.10 | Type **`100`** in input field | "You receive" output shows estimated amount (not 0, not NaN). Trade details panel appears below | | |
| 3.11 | Check **Price Impact** in trade details | Shows a percentage. Color: green (< 1%), yellow (1-3%), red (> 3%) | | |
| 3.12 | Check **Min. Received** | Shows a number less than the estimated output, factoring in slippage | | |
| 3.13 | Check **Fee** line | Shows current fee in bps with % | | |
| 3.14 | Check **Route** line | Shows "EVOA → EvoPool → EVOB" (or reverse) | | |
| 3.15 | Change slippage from 1.0% to **0.5%** | Min. Received increases (tighter tolerance) | | |
| 3.16 | Change slippage to **2.0%** | Min. Received decreases (looser tolerance) | | |
| 3.17 | Type **`0`** in input | Swap button is **disabled** (grayed out), no trade details shown | | |
| 3.18 | Clear input completely | Swap button disabled, output shows "0" | | |

### 3C — Price Chart

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 3.19 | Wait for **2+ poll cycles** (pool polls every 5s) | A "Price (live)" mini chart appears in the pool info banner (needs ≥2 data points) | | |
| 3.20 | Hover over the chart | Tooltip shows time and price value | | |

### 3D — Execute Swap

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 3.21 | Type **`100`** and click **"🔄 Swap"** button | **Confirmation modal** appears with: "Confirm Swap" title, You pay (100 EVOA), You receive (est.), Min received, Price impact, Slippage tolerance | | |
| 3.22 | Click **"Cancel"** in modal | Modal closes, nothing happens | | |
| 3.23 | Click **"🔄 Swap"** again, then click **"Swap Now"** in modal | Modal closes. Toast notification appears: "⏳ Preparing swap…" (loading spinner) | | |
| 3.24 | Wait for **MetaMask approval popup** | Toast updates to "⏳ Approving token…". MetaMask asks to approve EVOA spending | | |
| 3.25 | **Approve** in MetaMask | Toast updates to "⏳ Executing swap…" | | |
| 3.26 | **Confirm swap TX** in MetaMask | Toast updates to "⏳ Confirming swap…" with TX hash link | | |
| 3.27 | Wait for **TX confirmation** | Toast changes to "✅ Swap successful!" with green border, shows "100 EVOA → X.XX EVOB", and "View on BscScan ↗" link | | |
| 3.28 | Click **"View on BscScan ↗"** on the toast | Opens `testnet.bscscan.com/tx/0x…` with the confirmed transaction | | |
| 3.29 | Check the **input field** | Cleared to empty after successful swap | | |
| 3.30 | Check the **balance** | EVOA balance decreased, should update within ~15 seconds | | |

### 3E — Swap Edge Cases

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 3.31 | Enter a **huge amount** (e.g., `999999999`) → Swap | TX should revert. Toast shows "❌ Swap failed" with error reason | | |
| 3.32 | **Disconnect wallet** | Swap button says "🔗 Connect wallet in navbar to swap" and is disabled | | |
| 3.33 | Check **Defensive mode warning** (if pool is in mode 1) | Yellow warning at bottom: "⚠️ Defensive mode active — large trades incur quadratic whale penalty" | | |

### 3F — Real-Time Event Toast

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 3.34 | After completing a swap, wait **~15 seconds** on any page | An info toast should appear: "🔄 Swap detected — 0x3E77… swapped on EvoPool" with TX link. This is the global event listener | | |

---

## 4 — Liquidity (`/liquidity`)

### 4A — Pool Info & LP Position

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 4.1 | Navigate to **`/liquidity`** | Page shows "💧 Liquidity" heading | | |
| 4.2 | Check **pool info section** | Shows Reserve EVOA, Reserve EVOB, Total LP Supply (all real numbers, not NaN) | | |
| 4.3 | Check **"Your LP Balance"** line | Shows your LP token balance (may be 0 if you haven't added liquidity) | | |
| 4.4 | If you have LP tokens, check **"Your Position Value"** section | Shows: EVOA share, EVOB share, Pool share % (all correct math, not NaN) | | |

### 4B — Add Liquidity

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 4.5 | Tab should default to **"➕ Add Liquidity"** | Add tab highlighted gold, form shows two inputs (EVOA + EVOB) | | |
| 4.6 | Check **balance display** on EVOA input | Shows "Balance: X.XXXX" with gold **MAX** button | | |
| 4.7 | Click **MAX** on EVOA | Input fills with full EVOA balance | | |
| 4.8 | Check **balance display** on EVOB input | Shows "Balance: X.XXXX" with gold **MAX** button | | |
| 4.9 | Type **`500`** in EVOA, **`500`** in EVOB | Both inputs accept values. "💧 Add Liquidity" button is enabled (green) | | |
| 4.10 | Click **"💧 Add Liquidity"** | **Confirmation modal** appears: "Confirm Add Liquidity" with EVOA deposit, EVOB deposit amounts | | |
| 4.11 | Click **"Add Liquidity"** in modal | Toast: "⏳ Preparing…" → "Approving Token A…" → MetaMask approve A → "Approving Token B…" → MetaMask approve B → "Adding liquidity…" → MetaMask confirm → "✅ Liquidity added!" with TX link | | |
| 4.12 | Check **"Your LP Balance"** | Now shows a non-zero LP balance | | |
| 4.13 | Check **"Your Position Value"** | Shows EVOA share, EVOB share, Pool share % (e.g., if you're the only LP, 100.00%) | | |
| 4.14 | Inputs should be **cleared** | Both amount fields reset to empty | | |

### 4C — Remove Liquidity

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 4.15 | Click **"➖ Remove Liquidity"** tab | Tab switches (red highlight). Shows LP input + "Max: X.XXXXXX" link | | |
| 4.16 | Click the **"Max: X.XXXXXX"** link | Input fills with your full LP balance | | |
| 4.17 | Change to a **smaller amount** (e.g., half) | "🔥 Remove Liquidity" button enabled | | |
| 4.18 | Click **"🔥 Remove Liquidity"** | Confirmation modal: "Confirm Remove Liquidity" showing LP tokens to burn | | |
| 4.19 | Confirm in modal + MetaMask | Toast: "⏳ Removing liquidity…" → "✅ Liquidity removed!" with TX link | | |
| 4.20 | Check **LP balance** | Decreased by the amount you burned | | |
| 4.21 | Check **token balances** on Swap page | EVOA + EVOB balances increased (received back from pool) | | |

---

## 5 — Agents (`/agents`)

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 5.1 | Navigate to **`/agents`** | Shows "🤖 Agents" heading with agent count | | |
| 5.2 | If **no agents registered** | Shows empty state: big robot emoji, "No Agents Registered Yet" with 4-step guide | | |
| 5.3 | Check **"Register as Agent"** card at top | Shows bond input (default 0.01 tBNB) and "Register Agent" button | | |
| 5.4 | Enter **`0.01`** in bond, click **"Register Agent"** | MetaMask popup for 0.01 tBNB. TX confirms. Status shows "✅ Agent registered!" | | |
| 5.5 | Wait **15 seconds** (auto-poll interval) | Your agent appears in the agent list below | | |
| 5.6 | Check your agent card | Shows: green dot (active), full address (clickable BscScan link), **copy icon** (📋), golden **"You"** badge, Bond amount in BNB | | |
| 5.7 | Click the **copy icon** next to address | "✓ Copied" appears briefly | | |
| 5.8 | Click the **address link** | Opens `testnet.bscscan.com/address/0x…` | | |
| 5.9 | Check agent details grid | Registered time, Last Update (or "Never"), Updates count, Avg APS, Best APS | | |
| 5.10 | Scroll to **"🏆 APS Leaderboard"** | Shows table or "No APS scores recorded yet" message | | |
| 5.11 | Scroll to **"📊 APS Over Epochs"** chart | Chart renders or shows "No APS data yet" empty state | | |
| 5.12 | If already registered, **Register card disappears** | The "Register as Agent" section should not show if you're already an agent | | |

---

## 6 — Settings (`/settings`)

### 6A — Before Registration

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 6.1 | Navigate to **`/settings`** without wallet connected | Shows "🔗 Connect your wallet" info box | | |
| 6.2 | Connect wallet (but use a **non-registered** address) | Shows "Current Pool State" section + "Register as Agent" form | | |
| 6.3 | Check **Current Pool State** | Shows Fee (bps), Curve Beta, Curve Mode with correct values (not "0") | | |

### 6B — After Registration (use your registered agent wallet)

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 6.4 | Connect with registered agent wallet | "Register" section replaced by "Agent Status" showing Bond + Cooldown status | | |
| 6.5 | Check **Agent Status** card | Shows: Bond (e.g., 0.01 BNB in green), Cooldown (✓ Ready in green, or countdown timer in red like "2m 34s") | | |
| 6.6 | If cooldown is active, **watch the countdown** | Timer ticks down every second (e.g., "2m 34s" → "2m 33s"). When it reaches 0, switches to "✓ Ready" | | |
| 6.7 | Check **"Submit Parameter Update"** form | Shows 3 inputs: Fee (bps) with current value, Curve Beta with current value, Curve Mode dropdown | | |
| 6.8 | Change Fee to **`45`** | Input accepts the value. "Current: 30" shown below | | |
| 6.9 | Change Mode to **"Defensive"** from dropdown | Dropdown shows all 3 modes: Normal, Defensive, VolatilityAdaptive | | |
| 6.10 | Click **"Submit Update"** | MetaMask popup. TX confirms. BscScan link shown with green ✓ | | |
| 6.11 | Check **Greenfield upload toast** | After TX, toast appears: "📦 Uploading audit log to Greenfield…" (loading) → then either "✅ Audit log stored on Greenfield!" or "ℹ️ Greenfield upload skipped/failed" (this is OK — Greenfield testnet may not be available) | | |
| 6.12 | Check **Current Pool State** after update | Fee and/or Mode values updated to match what you submitted | | |
| 6.13 | Try clicking **"Submit Update"** again immediately | Button is disabled, shows countdown: "Cooldown Xm XXs" | | |
| 6.14 | Scroll to **"💡 Strategy Guide"** | Shows tips for Normal, Defensive, VolatilityAdaptive modes with colored labels | | |

### 6C — Light Mode Check

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 6.15 | Switch to **light mode** (theme toggle) | All input fields, dropdowns, and stat values use proper theme colors (NOT invisible white-on-white text) | | |
| 6.16 | Switch back to dark mode | Everything looks correct | | |

---

## 7 — Audit Trail (`/audit`)

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 7.1 | Navigate to **`/audit`** | Shows "📋 Audit Trail" heading with Greenfield description | | |
| 7.2 | Check **Greenfield info banner** | Shows: 🟢 Powered by BNB Greenfield, bucket name `evoarena-audit-logs`, SP link, Explorer link | | |
| 7.3 | Check **filter input** | Text input with placeholder "Filter by agent address or object name…" | | |
| 7.4 | Check **log list** | Either shows log entries (if uploads have been done) or "📭 No audit logs found yet" empty state | | |
| 7.5 | If logs exist, **click on a log entry** | Expands to show: Action, Fee, Curve, TX hash (BscScan link), Reason, "Raw JSON" collapsible | | |
| 7.6 | Click **"Raw JSON"** details toggle | Expands to show formatted JSON of the full log entry | | |
| 7.7 | Click **"View on Greenfield ↗"** link | Opens Greenfield SP URL for the object | | |
| 7.8 | Click **"🔄 Refresh"** button | Reloads log list from Greenfield | | |
| 7.9 | Type an address fragment in filter | List filters to matching entries only | | |
| 7.10 | Clear filter + type nonsense | Shows "No logs match your filter" | | |
| 7.11 | During initial load | Shows 5 skeleton shimmer loading bars | | |

---

## 8 — History (`/history`)

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 8.1 | Navigate to **`/history`** | Shows "📜 Transaction History" heading | | |
| 8.2 | Check **event list** loads | Shows recent on-chain events with icons: 💱 Swap, 💧 LiquidityAdded, 🔥 LiquidityRemoved, ⚙️ ParameterUpdate, 🤖 AgentRegistered, ⚡ AgentSlashed | | |
| 8.3 | Check event **details** | Each event shows: type icon + colored label, details string (amounts, addresses), block number, "TX ↗" BscScan link | | |
| 8.4 | Click **"💱 Swap"** filter button | Only swap events shown, button highlighted gold | | |
| 8.5 | Click **"⚙️ ParameterUpdate"** filter | Only parameter update events shown | | |
| 8.6 | Click **"🤖 AgentRegistered"** filter | Only agent registration events (should have at least 1 from step 5.4) | | |
| 8.7 | Click **"All"** filter | All events shown again | | |
| 8.8 | Change block range to **"Last 10K blocks"** | Fetches more historical events (may take a moment) | | |
| 8.9 | Click any **"TX ↗"** link | Opens correct transaction on testnet.bscscan.com | | |
| 8.10 | If no events in range | Shows "No events found in the selected range" empty state | | |

---

## 9 — Demo Panel (`/demo`)

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 9.1 | Navigate to **`/demo`** | Shows "🎮 Demo Panel" heading with current pool state | | |
| 9.2 | Check **pool state card** | Shows: Fee (bps), Beta, Mode (colored), Trades, Epochs Run (starts at 0) | | |
| 9.3 | Check **"Static vs EvoPool"** bar chart | Renders with red (Static) vs green (EvoPool) bars for 4 metrics | | |
| 9.4 | Check **"Capability Radar"** chart | Renders with red (Static) vs green (EvoPool) radar overlays | | |
| 9.5 | Check **feature comparison text** | Left column (❌ Static AMM) vs Right column (✅ EvoPool) with current values | | |
| 9.6 | Click **"⚡ Run Demo Epoch"** button | Button changes to "⏳ Running epoch…" (disabled). Log shows "Starting demo epoch..." | | |
| 9.7 | Wait for result | Log shows either: 🟢 LIVE agent execution (if agent/.env configured) with rule fired, fee, mode, TX hash; OR 🔵 Read-only with current on-chain state; OR ❌ Error with hint | | |
| 9.8 | Click **"Clear Log"** button | Log clears to "Click 'Run Demo Epoch' to start" | | |
| 9.9 | Run multiple epochs | Epochs Run counter increments. Log accumulates | | |

---

## 10 — Cross-Feature Verification

These tests verify features work **across pages** together.

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 10.1 | Do a swap on `/swap`, then go to **`/history`** | Your swap event appears in the event list | | |
| 10.2 | Do a swap on `/swap`, then go to **`/`** (Pool) | Reserves changed, trade count incremented | | |
| 10.3 | Submit a parameter update on `/settings`, then go to **`/`** | Fee/Beta/Mode updated on dashboard | | |
| 10.4 | Submit a parameter update on `/settings`, then go to **`/audit`** | Audit log entry should appear (if Greenfield upload succeeded) | | |
| 10.5 | Add liquidity on `/liquidity`, then go to **`/history`** | LiquidityAdded event appears | | |
| 10.6 | Register agent on `/agents`, then go to **`/settings`** | Shows "Agent Status" instead of "Register" form | | |
| 10.7 | After any TX, check **toast notification area** (bottom-right) | Toast appears, auto-dismisses after 5 seconds (or click ✕ to dismiss immediately). Loading toasts persist until TX completes | | |
| 10.8 | **Global event toasts**: Stay on any page and perform a TX from another browser tab or wallet | Within 15 seconds, an info toast appears: "🔄 Swap detected" or "💧 Liquidity added" etc. | | |

---

## 11 — Contract Verification (BscScan)

Open each contract on BscScan and verify it shows green ✅ "Contract Source Code Verified":

| # | Contract | Address | Link | ✓/✗ |
|---|----------|---------|------|------|
| 11.1 | EvoToken A | `0xAe6A9CaF9739C661e593979386580d3d14abB502` | [BscScan](https://testnet.bscscan.com/address/0xAe6A9CaF9739C661e593979386580d3d14abB502#code) | |
| 11.2 | EvoToken B | `0x08DA91C81cebD27d181cA732615379f185FbFb51` | [BscScan](https://testnet.bscscan.com/address/0x08DA91C81cebD27d181cA732615379f185FbFb51#code) | |
| 11.3 | EvoPool | `0x36Fda9F9F17ea5c07C0CDE540B220fC0697bBcE3` | [BscScan](https://testnet.bscscan.com/address/0x36Fda9F9F17ea5c07C0CDE540B220fC0697bBcE3#code) | |
| 11.4 | AgentController | `0x163f03E4633B86fBB5C82c6e6a6aCbD1452bEe7c` | [BscScan](https://testnet.bscscan.com/address/0x163f03E4633B86fBB5C82c6e6a6aCbD1452bEe7c#code) | |
| 11.5 | EpochManager | `0xab07a553a7237c39fBbf74b7FcC003013D0618D3` | [BscScan](https://testnet.bscscan.com/address/0xab07a553a7237c39fBbf74b7FcC003013D0618D3#code) | |
| 11.6 | TimeLock | `0xf967B398c6Df05a1ED6b9DE15f0B93f8f253c1a6` | [BscScan](https://testnet.bscscan.com/address/0xf967B398c6Df05a1ED6b9DE15f0B93f8f253c1a6#code) | |

---

## 12 — Hardhat Tests

| # | Step | Expected | ✓/✗ | Notes |
|---|------|----------|------|-------|
| 12.1 | Run `cd /Users/bond/EvoArena && npx hardhat test` in terminal | 152 tests passing, 0 failures | | |

---

## Summary Checklist

| Section | Tests | Pass | Fail |
|---------|-------|------|------|
| 0 — Setup | 6 | | |
| 1A — Navbar & Theme | 10 | | |
| 1B — Wallet | 7 | | |
| 1C — Keyboard Shortcuts | 5 | | |
| 1D — Onboarding Tour | 6 | | |
| 2 — Pool Dashboard | 10 | | |
| 3A — Swap UI | 9 | | |
| 3B — Trade Calculations | 8 | | |
| 3C — Price Chart | 2 | | |
| 3D — Execute Swap | 10 | | |
| 3E — Swap Edge Cases | 3 | | |
| 3F — Event Toast | 1 | | |
| 4A — Liquidity Info | 4 | | |
| 4B — Add Liquidity | 10 | | |
| 4C — Remove Liquidity | 7 | | |
| 5 — Agents | 12 | | |
| 6A — Settings (Before) | 3 | | |
| 6B — Settings (After) | 11 | | |
| 6C — Settings Light Mode | 2 | | |
| 7 — Audit Trail | 11 | | |
| 8 — History | 10 | | |
| 9 — Demo Panel | 9 | | |
| 10 — Cross-Feature | 8 | | |
| 11 — BscScan Contracts | 6 | | |
| 12 — Hardhat Tests | 1 | | |
| **TOTAL** | **170** | | |
