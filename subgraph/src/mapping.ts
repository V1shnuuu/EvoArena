import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  Swap as SwapEvent,
  LiquidityAdded as LiquidityAddedEvent,
  LiquidityRemoved as LiquidityRemovedEvent,
  ParametersUpdated as ParametersUpdatedEvent,
  ProtocolFeeCollected as ProtocolFeeCollectedEvent,
} from "../generated/EvoPool/EvoPool";
import {
  AgentRegistered as AgentRegisteredEvent,
  AgentDeregistered as AgentDeregisteredEvent,
  AgentSlashed as AgentSlashedEvent,
  AgentUpdateProposed as AgentUpdateProposedEvent,
} from "../generated/AgentController/AgentController";
import {
  EpochStarted as EpochStartedEvent,
  ProposalSubmitted as ProposalSubmittedEvent,
  EpochFinalized as EpochFinalizedEvent,
  RewardClaimed as RewardClaimedEvent,
} from "../generated/EpochManager/EpochManager";
import {
  Swap,
  LiquidityEvent,
  ParameterUpdate,
  ProtocolFeeCollection,
  Agent,
  SlashEvent,
  Epoch,
  Proposal,
  RewardClaim,
} from "../generated/schema";

// ── EvoPool Handlers ───────────────────────────────────────────────

export function handleSwap(event: SwapEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const swap = new Swap(id);
  swap.sender = event.params.sender;
  swap.zeroForOne = event.params.zeroForOne;
  swap.amountIn = event.params.amountIn;
  swap.amountOut = event.params.amountOut;
  swap.feeAmount = event.params.feeAmount;
  swap.timestamp = event.block.timestamp;
  swap.blockNumber = event.block.number;
  swap.save();
}

export function handleLiquidityAdded(event: LiquidityAddedEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const liq = new LiquidityEvent(id);
  liq.provider = event.params.provider;
  liq.amount0 = event.params.amount0;
  liq.amount1 = event.params.amount1;
  liq.liquidity = event.params.liquidity;
  liq.isAdd = true;
  liq.timestamp = event.block.timestamp;
  liq.blockNumber = event.block.number;
  liq.save();
}

export function handleLiquidityRemoved(event: LiquidityRemovedEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const liq = new LiquidityEvent(id);
  liq.provider = event.params.provider;
  liq.amount0 = event.params.amount0;
  liq.amount1 = event.params.amount1;
  liq.liquidity = event.params.liquidity;
  liq.isAdd = false;
  liq.timestamp = event.block.timestamp;
  liq.blockNumber = event.block.number;
  liq.save();
}

export function handleParametersUpdated(event: ParametersUpdatedEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const update = new ParameterUpdate(id);
  update.agent = event.params.agent;
  update.newFeeBps = event.params.newFeeBps;
  update.newCurveBeta = event.params.newCurveBeta;
  update.newMode = event.params.newMode;
  update.timestamp = event.block.timestamp;
  update.blockNumber = event.block.number;
  update.save();
}

export function handleProtocolFeeCollected(event: ProtocolFeeCollectedEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const fee = new ProtocolFeeCollection(id);
  fee.amount0 = event.params.amount0;
  fee.amount1 = event.params.amount1;
  fee.treasury = event.params.treasury;
  fee.timestamp = event.block.timestamp;
  fee.save();
}

// ── AgentController Handlers ───────────────────────────────────────

export function handleAgentRegistered(event: AgentRegisteredEvent): void {
  const id = event.params.agent.toHexString();
  let agent = Agent.load(id);
  if (!agent) {
    agent = new Agent(id);
    agent.address = event.params.agent;
    agent.updateCount = BigInt.zero();
    agent.slashCount = BigInt.zero();
    agent.totalSlashed = BigInt.zero();
  }
  agent.bondAmount = event.params.bondAmount;
  agent.registeredAt = event.block.timestamp;
  agent.active = true;
  agent.save();
}

export function handleAgentDeregistered(event: AgentDeregisteredEvent): void {
  const id = event.params.agent.toHexString();
  const agent = Agent.load(id);
  if (agent) {
    agent.active = false;
    agent.bondAmount = BigInt.zero();
    agent.save();
  }
}

export function handleAgentSlashed(event: AgentSlashedEvent): void {
  // Create slash event entity
  const slashId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const slash = new SlashEvent(slashId);
  slash.agent = event.params.agent;
  slash.amount = event.params.slashAmount;
  slash.reason = event.params.reason;
  slash.timestamp = event.block.timestamp;
  slash.save();

  // Update agent
  const id = event.params.agent.toHexString();
  const agent = Agent.load(id);
  if (agent) {
    agent.bondAmount = agent.bondAmount.minus(event.params.slashAmount);
    agent.slashCount = agent.slashCount.plus(BigInt.fromI32(1));
    agent.totalSlashed = agent.totalSlashed.plus(event.params.slashAmount);
    agent.save();
  }
}

export function handleAgentUpdateProposed(event: AgentUpdateProposedEvent): void {
  const id = event.params.agent.toHexString();
  const agent = Agent.load(id);
  if (agent) {
    agent.updateCount = agent.updateCount.plus(BigInt.fromI32(1));
    agent.save();
  }
}

// ── EpochManager Handlers ──────────────────────────────────────────

export function handleEpochStarted(event: EpochStartedEvent): void {
  const id = event.params.epochId.toString();
  const epoch = new Epoch(id);
  epoch.epochId = event.params.epochId;
  epoch.startTime = event.params.startTime;
  epoch.endTime = event.params.endTime;
  epoch.proposalCount = BigInt.zero();
  epoch.finalized = false;
  epoch.save();
}

export function handleProposalSubmitted(event: ProposalSubmittedEvent): void {
  const id = event.params.epochId.toString() + "-" + event.params.agent.toHexString();
  const proposal = new Proposal(id);
  proposal.epochId = event.params.epochId;
  proposal.agent = event.params.agent;
  proposal.feeBps = event.params.feeBps;
  proposal.curveBeta = event.params.curveBeta;
  proposal.curveMode = event.params.curveMode;
  proposal.timestamp = event.block.timestamp;
  proposal.save();

  // Update epoch proposal count
  const epoch = Epoch.load(event.params.epochId.toString());
  if (epoch) {
    epoch.proposalCount = epoch.proposalCount.plus(BigInt.fromI32(1));
    epoch.save();
  }
}

export function handleEpochFinalized(event: EpochFinalizedEvent): void {
  const epoch = Epoch.load(event.params.epochId.toString());
  if (epoch) {
    epoch.winner = event.params.winner;
    epoch.winnerScore = event.params.winnerScore;
    epoch.finalized = true;
    epoch.save();
  }
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
  const id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const claim = new RewardClaim(id);
  claim.epochId = event.params.epochId;
  claim.winner = event.params.winner;
  claim.amount = event.params.amount;
  claim.timestamp = event.block.timestamp;
  claim.save();
}
