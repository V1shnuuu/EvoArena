// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IEpochManager.sol";
import "./interfaces/IAgentController.sol";
import "./EvoPool.sol";

/**
 * @title EpochManager
 * @author EvoArena Protocol
 * @notice Manages epoch-based competition among registered agents.
 *
 *         Each epoch has two phases:
 *           1. PROPOSAL phase — agents submit candidate parameters
 *           2. FINALIZE phase — guardian/oracle submits scores, highest wins,
 *              winner's parameters are applied to the pool
 *
 *         Scores are submitted by a trusted scorer (oracle/guardian) after
 *         off-chain APS computation.  The winner earns epoch rewards from
 *         a reward pool funded by the owner.
 *
 * @dev Epoch length is configurable. Proposals are stored per-epoch.
 *      Only one proposal per agent per epoch. The arbiter selects the
 *      highest-scoring agent and applies their parameters.
 */
contract EpochManager is IEpochManager, ReentrancyGuard, Ownable {

    // ── Linked contracts ────────────────────────────────────────────────
    EvoPool public pool;
    address public agentController;

    // ── Epoch config ────────────────────────────────────────────────────
    uint256 public epochDuration;    // seconds per epoch
    uint256 public currentEpochId;
    uint256 public epochStartTime;

    // ── Scoring ─────────────────────────────────────────────────────────
    address public scorer; // trusted address that submits off-chain APS scores

    // ── Epoch data ──────────────────────────────────────────────────────
    mapping(uint256 => EpochData) public epochs;
    mapping(uint256 => Proposal[]) public epochProposals;        // epochId → proposals
    mapping(uint256 => mapping(address => bool)) public hasProposed; // epochId → agent → bool
    mapping(uint256 => mapping(address => uint256)) public agentScores; // epochId → agent → score
    mapping(uint256 => address[]) public epochAgents;             // epochId → list of agents that proposed

    // ── Rewards ─────────────────────────────────────────────────────────
    uint256 public epochRewardAmount; // BNB reward per epoch for winner
    mapping(uint256 => mapping(address => bool)) public rewardClaimed;

    // ── Leaderboard ─────────────────────────────────────────────────────
    mapping(address => uint256) public totalScore;    // lifetime cumulative score
    mapping(address => uint256) public epochsWon;     // number of epochs won
    mapping(address => uint256) public epochsParticipated;

    // ── Errors ──────────────────────────────────────────────────────────
    error EpochNotActive();
    error EpochStillActive();
    error AlreadyProposed();
    error AlreadyFinalized();
    error NotScorer();
    error NoProposals();
    error InvalidScoreCount();
    error NothingToClaim();
    error TransferFailed();
    error AgentNotRegistered();

    modifier onlyScorer() {
        if (msg.sender != scorer) revert NotScorer();
        _;
    }

    constructor(
        address _pool,
        address _agentController,
        uint256 _epochDuration,
        address _scorer,
        address _owner
    ) Ownable(_owner) {
        pool = EvoPool(_pool);
        agentController = _agentController;
        epochDuration = _epochDuration;
        scorer = _scorer;

        // Start first epoch
        currentEpochId = 1;
        epochStartTime = block.timestamp;
        epochs[1] = EpochData({
            epochId: 1,
            startTime: block.timestamp,
            endTime: block.timestamp + _epochDuration,
            winner: address(0),
            winnerScore: 0,
            proposalCount: 0,
            finalized: false
        });

        emit EpochStarted(1, block.timestamp, block.timestamp + _epochDuration);
    }

    // ── Admin ───────────────────────────────────────────────────────────

    function setScorer(address _scorer) external onlyOwner {
        scorer = _scorer;
    }

    function setEpochDuration(uint256 _duration) external onlyOwner {
        epochDuration = _duration;
    }

    function setEpochReward(uint256 _amount) external onlyOwner {
        epochRewardAmount = _amount;
    }

    // ── Proposal Phase ──────────────────────────────────────────────────

    /**
     * @notice Submit a parameter proposal for the current epoch.
     *         Agent must be registered in AgentController.
     * @param feeBps Proposed fee in basis points
     * @param curveBeta Proposed curve beta (scaled 1e4)
     * @param curveMode_ Proposed curve mode (0, 1, or 2)
     */
    function submitProposal(
        uint256 feeBps,
        uint256 curveBeta,
        uint8 curveMode_
    ) external nonReentrant {
        // Check epoch is active
        _checkAndAdvanceEpoch();

        uint256 eid = currentEpochId;
        if (block.timestamp >= epochs[eid].endTime) revert EpochNotActive();
        if (hasProposed[eid][msg.sender]) revert AlreadyProposed();

        // Verify agent is registered
        IAgentController ctrl = IAgentController(agentController);
        IAgentController.AgentInfo memory info = ctrl.getAgentInfo(msg.sender);
        if (!info.active) revert AgentNotRegistered();

        // Validate basic bounds
        if (feeBps > 500) revert(); // MAX_FEE_BPS
        if (curveMode_ > 2) revert();

        Proposal memory p = Proposal({
            agent: msg.sender,
            feeBps: feeBps,
            curveBeta: curveBeta,
            curveMode: curveMode_,
            timestamp: block.timestamp
        });

        epochProposals[eid].push(p);
        hasProposed[eid][msg.sender] = true;
        epochAgents[eid].push(msg.sender);
        epochs[eid].proposalCount++;
        epochsParticipated[msg.sender]++;

        emit ProposalSubmitted(eid, msg.sender, feeBps, curveBeta, curveMode_);
    }

    /**
     * @notice Get all proposals for an epoch.
     * @param epochId The epoch to query
     * @return Array of Proposal structs
     */
    function getEpochProposals(uint256 epochId) external view returns (Proposal[] memory) {
        return epochProposals[epochId];
    }

    /**
     * @notice Get list of agents that proposed in an epoch.
     * @param epochId The epoch to query
     * @return Array of agent addresses
     */
    function getEpochAgents(uint256 epochId) external view returns (address[] memory) {
        return epochAgents[epochId];
    }

    // ── Finalize Phase ──────────────────────────────────────────────────

    /**
     * @notice Submit scores for all agents in the epoch and finalize it.
     *         Only callable by the trusted scorer after epoch ends.
     *         The highest-scoring agent's parameters are applied to the pool.
     * @param epochId The epoch to finalize
     * @param agents Array of agent addresses (must match epochAgents)
     * @param scores Array of scores (scaled 1e4, e.g. 5000 = 0.5)
     */
    function finalizeEpoch(
        uint256 epochId,
        address[] calldata agents,
        uint256[] calldata scores
    ) external onlyScorer nonReentrant {
        EpochData storage ep = epochs[epochId];
        if (ep.finalized) revert AlreadyFinalized();
        if (ep.proposalCount == 0) revert NoProposals();
        if (agents.length != scores.length) revert InvalidScoreCount();
        if (agents.length != ep.proposalCount) revert InvalidScoreCount();

        // Record scores and find winner
        address bestAgent;
        uint256 bestScore;

        for (uint256 i = 0; i < agents.length; i++) {
            agentScores[epochId][agents[i]] = scores[i];
            totalScore[agents[i]] += scores[i];

            emit ScoreSubmitted(epochId, agents[i], scores[i]);

            if (scores[i] > bestScore) {
                bestScore = scores[i];
                bestAgent = agents[i];
            }
        }

        ep.winner = bestAgent;
        ep.winnerScore = bestScore;
        ep.finalized = true;
        epochsWon[bestAgent]++;

        // Apply winner's parameters to the pool
        Proposal[] storage proposals = epochProposals[epochId];
        for (uint256 i = 0; i < proposals.length; i++) {
            if (proposals[i].agent == bestAgent) {
                pool.updateParameters(
                    proposals[i].feeBps,
                    proposals[i].curveBeta,
                    IEvoPool.CurveMode(proposals[i].curveMode),
                    bestAgent
                );
                break;
            }
        }

        emit EpochFinalized(epochId, bestAgent, bestScore);

        // Auto-advance to next epoch
        _startNextEpoch();
    }

    /**
     * @notice Claim epoch reward (winner only).
     * @param epochId The epoch to claim reward for
     */
    function claimReward(uint256 epochId) external nonReentrant {
        EpochData storage ep = epochs[epochId];
        if (!ep.finalized) revert EpochNotActive();
        if (ep.winner != msg.sender) revert NothingToClaim();
        if (rewardClaimed[epochId][msg.sender]) revert NothingToClaim();
        if (epochRewardAmount == 0) revert NothingToClaim();

        rewardClaimed[epochId][msg.sender] = true;

        (bool ok, ) = msg.sender.call{value: epochRewardAmount}("");
        if (!ok) revert TransferFailed();

        emit RewardClaimed(epochId, msg.sender, epochRewardAmount);
    }

    // ── Internal ────────────────────────────────────────────────────────

    function _checkAndAdvanceEpoch() internal {
        EpochData storage ep = epochs[currentEpochId];
        // If current epoch ended but wasn't finalized, just advance
        if (block.timestamp >= ep.endTime && !ep.finalized && ep.proposalCount == 0) {
            ep.finalized = true;
            _startNextEpoch();
        }
    }

    function _startNextEpoch() internal {
        currentEpochId++;
        uint256 start = block.timestamp;
        uint256 end = start + epochDuration;

        epochs[currentEpochId] = EpochData({
            epochId: currentEpochId,
            startTime: start,
            endTime: end,
            winner: address(0),
            winnerScore: 0,
            proposalCount: 0,
            finalized: false
        });

        epochStartTime = start;

        emit EpochStarted(currentEpochId, start, end);
    }

    // ── Views ───────────────────────────────────────────────────────────

    /**
     * @notice Get current epoch data.
     * @return EpochData struct for the current epoch
     */
    function getCurrentEpoch() external view returns (EpochData memory) {
        return epochs[currentEpochId];
    }

    /**
     * @notice Get time remaining in the current epoch.
     * @return seconds remaining (0 if epoch ended)
     */
    function getTimeRemaining() external view returns (uint256) {
        uint256 end = epochs[currentEpochId].endTime;
        if (block.timestamp >= end) return 0;
        return end - block.timestamp;
    }

    /**
     * @notice Get an agent's lifetime statistics.
     * @param agent Agent address
     * @return _totalScore Cumulative score across all epochs
     * @return _epochsWon Number of epochs won
     * @return _epochsParticipated Number of epochs participated in
     */
    function getAgentStats(address agent) external view returns (
        uint256 _totalScore,
        uint256 _epochsWon,
        uint256 _epochsParticipated
    ) {
        return (totalScore[agent], epochsWon[agent], epochsParticipated[agent]);
    }

    // Allow contract to receive BNB for epoch rewards
    receive() external payable {}
}
