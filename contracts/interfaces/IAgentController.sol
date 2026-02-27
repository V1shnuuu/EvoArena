// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IAgentController
 * @author EvoArena Protocol
 * @notice Interface for agent registration, bonding (BNB + ERC-20),
 *         parameter submission, cooldown enforcement, and slashing.
 */
interface IAgentController {
    /// @notice Stores the state of a registered agent.
    struct AgentInfo {
        address agentAddress;    // Agent's EOA address
        uint256 bondAmount;      // BNB bond deposited (wei)
        uint256 tokenBondAmount; // ERC-20 token bond deposited (wei)
        uint256 registeredAt;    // Timestamp of registration
        uint256 lastUpdateTime;  // Timestamp of last parameter update
        bool active;             // Whether the agent is currently active
    }

    /// @notice Represents a submitted parameter update.
    struct ParameterUpdate {
        uint256 newFeeBps;       // Proposed fee in basis points
        uint256 newCurveBeta;    // Proposed curve beta (scaled 1e4)
        uint8 newCurveMode;      // Proposed curve mode: 0, 1, or 2
        uint256 timestamp;       // When the update was submitted
    }

    // ── Events ──────────────────────────────────────────────────────────

    /// @notice Emitted when an agent registers with a BNB bond.
    event AgentRegistered(address indexed agent, uint256 bondAmount);

    /// @notice Emitted when an agent deregisters and withdraws their bond.
    event AgentDeregistered(address indexed agent, uint256 bondReturned);

    /// @notice Emitted when an agent is slashed by the guardian.
    event AgentSlashed(address indexed agent, uint256 slashAmount, string reason);

    /// @notice Emitted when an agent tops up their BNB bond.
    event BondTopUp(address indexed agent, uint256 amount, uint256 newTotal);

    /// @notice Emitted when an agent stakes ERC-20 tokens as additional bond.
    event TokenBondDeposited(address indexed agent, uint256 amount, uint256 newTotal);

    /// @notice Emitted when an agent proposes a parameter update.
    event AgentUpdateProposed(
        address indexed agent,
        uint256 newFeeBps,
        uint256 newCurveBeta,
        uint8 newCurveMode,
        uint256 timestamp
    );

    // ── Functions ───────────────────────────────────────────────────────

    /// @notice Register as an agent by staking BNB.
    function registerAgent() external payable;

    /// @notice Deregister and withdraw remaining BNB bond.
    function deregisterAgent() external;

    /// @notice Top up BNB bond for an active agent.
    function topUpBond() external payable;

    /// @notice Deposit ERC-20 tokens as additional bond collateral.
    /// @param amount Amount of tokens to deposit
    function depositTokenBond(uint256 amount) external;

    /// @notice Withdraw ERC-20 token bond (only when deregistered).
    function withdrawTokenBond() external;

    /// @notice Submit a parameter update proposal.
    /// @param newFeeBps Proposed fee in basis points
    /// @param newCurveBeta Proposed curve beta (scaled 1e4)
    /// @param newCurveMode Proposed curve mode (0, 1, or 2)
    function submitParameterUpdate(
        uint256 newFeeBps,
        uint256 newCurveBeta,
        uint8 newCurveMode
    ) external;

    /// @notice Slash an agent's BNB bond (owner/guardian only).
    /// @param agent Agent to slash
    /// @param amount Amount of BNB to slash
    /// @param reason Human-readable reason
    function slashAgent(address agent, uint256 amount, string calldata reason) external;

    /// @notice Get agent information.
    /// @param agent Agent address to query
    /// @return AgentInfo struct
    function getAgentInfo(address agent) external view returns (AgentInfo memory);
}
