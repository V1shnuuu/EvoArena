// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IEpochManager
 * @notice Interface for EvoArena epoch-based scoring & multi-agent competition.
 */
interface IEpochManager {
    struct Proposal {
        address agent;
        uint256 feeBps;
        uint256 curveBeta;
        uint8   curveMode;
        uint256 timestamp;
    }

    struct EpochData {
        uint256 epochId;
        uint256 startTime;
        uint256 endTime;
        address winner;
        uint256 winnerScore;
        uint256 proposalCount;
        bool    finalized;
    }

    struct AgentScore {
        address agent;
        uint256 score;     // scaled 1e4
        uint256 epochId;
    }

    event EpochStarted(uint256 indexed epochId, uint256 startTime, uint256 endTime);
    event ProposalSubmitted(uint256 indexed epochId, address indexed agent, uint256 feeBps, uint256 curveBeta, uint8 curveMode);
    event EpochFinalized(uint256 indexed epochId, address indexed winner, uint256 winnerScore);
    event ScoreSubmitted(uint256 indexed epochId, address indexed agent, uint256 score);
    event RewardClaimed(uint256 indexed epochId, address indexed agent, uint256 amount);
}
