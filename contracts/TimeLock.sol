// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TimeLock
 * @author EvoArena Protocol
 * @notice Time-lock for governance parameter changes on AgentController.
 *         All parameter changes are queued with a minimum delay before execution,
 *         providing transparency and allowing agents/LPs to react.
 *
 * @dev Supports queuing, executing, and canceling timelocked transactions.
 *      Minimum delay: 24 hours. Maximum delay: 7 days.
 */
contract TimeLock is Ownable {

    uint256 public constant MIN_DELAY = 24 hours;
    uint256 public constant MAX_DELAY = 7 days;
    uint256 public constant GRACE_PERIOD = 3 days;

    uint256 public delay;

    mapping(bytes32 => bool) public queuedTransactions;

    // ── Events ──────────────────────────────────────────────────────────
    event TransactionQueued(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    event TransactionExecuted(
        bytes32 indexed txHash,
        address indexed target,
        uint256 value,
        string signature,
        bytes data,
        uint256 eta
    );

    event TransactionCanceled(bytes32 indexed txHash);
    event DelayUpdated(uint256 oldDelay, uint256 newDelay);

    // ── Errors ──────────────────────────────────────────────────────────
    error DelayOutOfRange();
    error TransactionNotQueued();
    error TransactionAlreadyQueued();
    error TimelockNotReached();
    error TimelockExpired();
    error ExecutionFailed();

    constructor(uint256 _delay, address _owner) Ownable(_owner) {
        if (_delay < MIN_DELAY || _delay > MAX_DELAY) revert DelayOutOfRange();
        delay = _delay;
    }

    /**
     * @notice Update the timelock delay. Must be within [MIN_DELAY, MAX_DELAY].
     * @param _delay New delay in seconds
     */
    function setDelay(uint256 _delay) external onlyOwner {
        if (_delay < MIN_DELAY || _delay > MAX_DELAY) revert DelayOutOfRange();
        emit DelayUpdated(delay, _delay);
        delay = _delay;
    }

    /**
     * @notice Queue a transaction for future execution.
     * @param target Contract to call
     * @param value ETH/BNB to send
     * @param signature Function signature (e.g. "setMinBond(uint256)")
     * @param data ABI-encoded parameters
     * @param eta Estimated time of execution (must be >= block.timestamp + delay)
     * @return txHash The hash of the queued transaction
     */
    function queueTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyOwner returns (bytes32 txHash) {
        if (eta < block.timestamp + delay) revert TimelockNotReached();

        txHash = keccak256(abi.encode(target, value, signature, data, eta));
        if (queuedTransactions[txHash]) revert TransactionAlreadyQueued();

        queuedTransactions[txHash] = true;

        emit TransactionQueued(txHash, target, value, signature, data, eta);
    }

    /**
     * @notice Cancel a queued transaction.
     * @param target Contract to call
     * @param value ETH/BNB to send
     * @param signature Function signature
     * @param data ABI-encoded parameters
     * @param eta Estimated time of execution
     */
    function cancelTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyOwner {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        if (!queuedTransactions[txHash]) revert TransactionNotQueued();

        queuedTransactions[txHash] = false;
        emit TransactionCanceled(txHash);
    }

    /**
     * @notice Execute a queued transaction after its timelock has passed.
     * @param target Contract to call
     * @param value ETH/BNB to send
     * @param signature Function signature
     * @param data ABI-encoded parameters
     * @param eta Estimated time of execution
     * @return returnData The data returned by the executed call
     */
    function executeTransaction(
        address target,
        uint256 value,
        string calldata signature,
        bytes calldata data,
        uint256 eta
    ) external onlyOwner returns (bytes memory returnData) {
        bytes32 txHash = keccak256(abi.encode(target, value, signature, data, eta));
        if (!queuedTransactions[txHash]) revert TransactionNotQueued();
        if (block.timestamp < eta) revert TimelockNotReached();
        if (block.timestamp > eta + GRACE_PERIOD) revert TimelockExpired();

        queuedTransactions[txHash] = false;

        bytes memory callData;
        if (bytes(signature).length > 0) {
            callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
        } else {
            callData = data;
        }

        (bool success, bytes memory result) = target.call{value: value}(callData);
        if (!success) revert ExecutionFailed();

        emit TransactionExecuted(txHash, target, value, signature, data, eta);
        return result;
    }

    receive() external payable {}
}
