// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IAgentController.sol";
import "./interfaces/IEvoPool.sol";
import "./EvoPool.sol";

/**
 * @title AgentController
 * @author EvoArena Protocol
 * @notice Manages agent registration, bonding (BNB + ERC-20 token),
 *         cooldown enforcement, parameter-delta limits, and slashing.
 *         Agents submit parameter updates which are validated and then
 *         forwarded to the EvoPool.
 *
 * @dev Security invariants enforced on-chain:
 *    - |ΔfeeBps|     ≤ maxFeeDelta   per update
 *    - |ΔcurveBeta|  ≤ maxBetaDelta  per update
 *    - cooldown      ≥ cooldownSeconds between updates
 *    - agent bond    ≥ minBond
 *    - feeBps        ≤ MAX_FEE_BPS (500 bps = 5 %)
 *    - curveMode     ∈ {0, 1, 2}
 */
contract AgentController is IAgentController, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ── Linked pool ─────────────────────────────────────────────────────
    EvoPool public pool;

    // ── Token bond ──────────────────────────────────────────────────────
    IERC20 public bondToken; // Optional ERC-20 token for staking bond

    // ── Governance-configurable bounds ──────────────────────────────────
    uint256 public minBond;            // wei (BNB)
    uint256 public cooldownSeconds;    // seconds between updates
    uint256 public maxFeeDelta;        // max |Δfee| per update in bps
    uint256 public maxBetaDelta;       // max |ΔcurveBeta| per update (1e4 scaled)
    uint256 public constant MAX_FEE_BPS = 500; // 5 %

    // ── Agent state ─────────────────────────────────────────────────────
    mapping(address => AgentInfo) private agents;
    address[] public agentList;
    mapping(address => uint256) public updateCount; // total updates per agent

    // ── Pause ───────────────────────────────────────────────────────────
    bool public paused;

    // ── Errors ──────────────────────────────────────────────────────────
    error NotRegistered();
    error AlreadyRegistered();
    error BondTooLow();
    error CooldownActive();
    error DeltaExceedsLimit();
    error FeeTooHigh();
    error InvalidCurveMode();
    error Paused();
    error InsufficientSlashAmount();
    error TransferFailed();
    error ZeroAmount();
    error StillActive();

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    modifier onlyRegistered() {
        if (!agents[msg.sender].active) revert NotRegistered();
        _;
    }

    /**
     * @notice Deploy the AgentController.
     * @param _pool Address of the linked EvoPool
     * @param _minBond Minimum BNB bond required for registration (wei)
     * @param _cooldownSeconds Minimum seconds between parameter updates
     * @param _maxFeeDelta Maximum fee change per update (basis points)
     * @param _maxBetaDelta Maximum beta change per update (scaled 1e4)
     * @param _owner Owner address (governance)
     */
    constructor(
        address _pool,
        uint256 _minBond,
        uint256 _cooldownSeconds,
        uint256 _maxFeeDelta,
        uint256 _maxBetaDelta,
        address _owner
    ) Ownable(_owner) {
        pool = EvoPool(_pool);
        minBond = _minBond;
        cooldownSeconds = _cooldownSeconds;
        maxFeeDelta = _maxFeeDelta;
        maxBetaDelta = _maxBetaDelta;
    }

    // ── Admin ───────────────────────────────────────────────────────────

    /// @notice Pause all agent operations.
    function pause() external onlyOwner { paused = true; }

    /// @notice Unpause all agent operations.
    function unpause() external onlyOwner { paused = false; }

    /// @notice Set minimum BNB bond for registration.
    /// @param _v New minimum bond (wei)
    function setMinBond(uint256 _v) external onlyOwner { minBond = _v; }

    /// @notice Set cooldown between parameter updates.
    /// @param _v New cooldown (seconds)
    function setCooldown(uint256 _v) external onlyOwner { cooldownSeconds = _v; }

    /// @notice Set maximum fee delta per update.
    /// @param _v New max fee delta (basis points)
    function setMaxFeeDelta(uint256 _v) external onlyOwner { maxFeeDelta = _v; }

    /// @notice Set maximum beta delta per update.
    /// @param _v New max beta delta (scaled 1e4)
    function setMaxBetaDelta(uint256 _v) external onlyOwner { maxBetaDelta = _v; }

    /// @notice Set the ERC-20 token used for token-based bonding.
    /// @param _token Address of the ERC-20 token (address(0) to disable)
    function setBondToken(address _token) external onlyOwner {
        bondToken = IERC20(_token);
    }

    // ── Agent Registration ──────────────────────────────────────────────

    /**
     * @notice Register as an agent by staking a bond in native BNB.
     * @dev msg.value must be ≥ minBond. Creates agent entry, emits event.
     */
    function registerAgent() external payable override nonReentrant whenNotPaused {
        if (agents[msg.sender].active) revert AlreadyRegistered();
        if (msg.value < minBond) revert BondTooLow();

        agents[msg.sender] = AgentInfo({
            agentAddress: msg.sender,
            bondAmount: msg.value,
            tokenBondAmount: 0,
            registeredAt: block.timestamp,
            lastUpdateTime: 0,
            active: true
        });

        agentList.push(msg.sender);

        emit AgentRegistered(msg.sender, msg.value);
    }

    /**
     * @notice Deregister and withdraw remaining BNB bond.
     *         Agent must be active. Bond is returned in full (minus any slashes).
     *         ERC-20 token bond must be withdrawn separately via withdrawTokenBond().
     */
    function deregisterAgent() external override nonReentrant whenNotPaused onlyRegistered {
        AgentInfo storage info = agents[msg.sender];
        uint256 bondToReturn = info.bondAmount;

        info.active = false;
        info.bondAmount = 0;

        if (bondToReturn > 0) {
            (bool ok, ) = msg.sender.call{value: bondToReturn}("");
            if (!ok) revert TransferFailed();
        }

        emit AgentDeregistered(msg.sender, bondToReturn);
    }

    /**
     * @notice Top up an existing agent's BNB bond.
     * @dev msg.value must be > 0.
     */
    function topUpBond() external payable override nonReentrant whenNotPaused onlyRegistered {
        if (msg.value == 0) revert ZeroAmount();
        agents[msg.sender].bondAmount += msg.value;
        emit BondTopUp(msg.sender, msg.value, agents[msg.sender].bondAmount);
    }

    /**
     * @notice Deposit ERC-20 tokens as additional bond collateral.
     * @dev Requires bondToken to be set. Agent must be registered.
     * @param amount Amount of ERC-20 tokens to deposit
     */
    function depositTokenBond(uint256 amount) external override nonReentrant whenNotPaused onlyRegistered {
        if (amount == 0) revert ZeroAmount();
        if (address(bondToken) == address(0)) revert ZeroAmount();

        bondToken.safeTransferFrom(msg.sender, address(this), amount);
        agents[msg.sender].tokenBondAmount += amount;

        emit TokenBondDeposited(msg.sender, amount, agents[msg.sender].tokenBondAmount);
    }

    /**
     * @notice Withdraw ERC-20 token bond. Only callable when deregistered.
     */
    function withdrawTokenBond() external override nonReentrant {
        AgentInfo storage info = agents[msg.sender];
        if (info.active) revert StillActive();
        uint256 amount = info.tokenBondAmount;
        if (amount == 0) revert ZeroAmount();

        info.tokenBondAmount = 0;
        bondToken.safeTransfer(msg.sender, amount);
    }

    // ── Parameter Submission ────────────────────────────────────────────

    /**
     * @notice Submit a parameter update for the linked EvoPool.
     *         Validates delta limits, cooldown, and absolute caps.
     * @param newFeeBps Proposed fee in basis points (≤ 500)
     * @param newCurveBeta Proposed curve beta (scaled 1e4)
     * @param newCurveMode Proposed curve mode (0, 1, or 2)
     */
    function submitParameterUpdate(
        uint256 newFeeBps,
        uint256 newCurveBeta,
        uint8 newCurveMode
    ) external override nonReentrant whenNotPaused onlyRegistered {
        AgentInfo storage agent = agents[msg.sender];

        // ── Cooldown check ──────────────────────────────────────────────
        if (
            agent.lastUpdateTime != 0 &&
            block.timestamp < agent.lastUpdateTime + cooldownSeconds
        ) revert CooldownActive();

        // ── Absolute caps ───────────────────────────────────────────────
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        if (newCurveMode > 2) revert InvalidCurveMode();

        // ── Delta checks ────────────────────────────────────────────────
        uint256 currentFee  = pool.feeBps();
        uint256 currentBeta = pool.curveBeta();

        uint256 feeDiff  = newFeeBps > currentFee
            ? newFeeBps - currentFee
            : currentFee - newFeeBps;
        uint256 betaDiff = newCurveBeta > currentBeta
            ? newCurveBeta - currentBeta
            : currentBeta - newCurveBeta;

        if (feeDiff > maxFeeDelta) revert DeltaExceedsLimit();
        if (betaDiff > maxBetaDelta) revert DeltaExceedsLimit();

        // ── Apply ───────────────────────────────────────────────────────
        agent.lastUpdateTime = block.timestamp;
        updateCount[msg.sender]++;

        pool.updateParameters(
            newFeeBps,
            newCurveBeta,
            IEvoPool.CurveMode(newCurveMode),
            msg.sender
        );

        emit AgentUpdateProposed(
            msg.sender,
            newFeeBps,
            newCurveBeta,
            newCurveMode,
            block.timestamp
        );
    }

    // ── Slashing ────────────────────────────────────────────────────────

    /**
     * @notice Slash an agent's BNB bond. Owner-only (guardian role).
     *         Formal slashing criteria:
     *         - Repeated rapid parameter oscillation (fee toggling)
     *         - Submitting params that cause >10% reserve imbalance
     *         - Colluding with traders (detected off-chain, reported on-chain)
     * @param agent Address of the agent to slash
     * @param amount Amount of BNB to slash (wei)
     * @param reason Human-readable reason for the slash
     */
    function slashAgent(
        address agent,
        uint256 amount,
        string calldata reason
    ) external override onlyOwner nonReentrant {
        AgentInfo storage info = agents[agent];
        if (!info.active) revert NotRegistered();
        if (amount > info.bondAmount) revert InsufficientSlashAmount();

        info.bondAmount -= amount;

        // Transfer slashed funds to owner (treasury)
        (bool ok, ) = owner().call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit AgentSlashed(agent, amount, reason);
    }

    // ── Views ───────────────────────────────────────────────────────────

    /**
     * @notice Get information about a registered agent.
     * @param agent Agent address to query
     * @return AgentInfo struct with all agent state
     */
    function getAgentInfo(address agent) external view override returns (AgentInfo memory) {
        return agents[agent];
    }

    /**
     * @notice Get total number of agents (including deregistered).
     * @return Number of agents in the registry
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    // Allow contract to receive BNB (bond top-ups, etc.)
    receive() external payable {}
}
