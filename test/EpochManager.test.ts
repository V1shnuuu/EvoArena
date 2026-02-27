import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("EpochManager", function () {
  let pool: any;
  let controller: any;
  let epochManager: any;
  let tokenA: any;
  let tokenB: any;
  let owner: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let agent3: SignerWithAddress;
  let scorer: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const INITIAL_FEE = 30n;
  const INITIAL_BETA = 5000n;
  const MIN_BOND = ethers.parseEther("0.01");
  const COOLDOWN = 300;
  const MAX_FEE_DELTA = 50;
  const MAX_BETA_DELTA = 2000;
  const EPOCH_DURATION = 600; // 10 minutes

  beforeEach(async function () {
    [owner, agent1, agent2, agent3, scorer] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("EvoToken");
    tokenA = await TokenFactory.deploy("Token A", "TKA", INITIAL_SUPPLY, owner.address);
    tokenB = await TokenFactory.deploy("Token B", "TKB", INITIAL_SUPPLY, owner.address);

    const PoolFactory = await ethers.getContractFactory("EvoPool");
    pool = await PoolFactory.deploy(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      INITIAL_FEE,
      INITIAL_BETA,
      owner.address
    );

    const ControllerFactory = await ethers.getContractFactory("AgentController");
    controller = await ControllerFactory.deploy(
      await pool.getAddress(),
      MIN_BOND,
      COOLDOWN,
      MAX_FEE_DELTA,
      MAX_BETA_DELTA,
      owner.address
    );

    // Deploy EpochManager — it needs to call pool.updateParameters, so set it as controller
    const EpochManagerFactory = await ethers.getContractFactory("EpochManager");
    epochManager = await EpochManagerFactory.deploy(
      await pool.getAddress(),
      await controller.getAddress(),
      EPOCH_DURATION,
      scorer.address,
      owner.address
    );

    // Set epochManager as the pool controller (so it can apply winning params)
    await pool.setController(await epochManager.getAddress());

    // Register agents in the AgentController
    await controller.connect(agent1).registerAgent({ value: MIN_BOND });
    await controller.connect(agent2).registerAgent({ value: MIN_BOND });
    await controller.connect(agent3).registerAgent({ value: MIN_BOND });
  });

  describe("Epoch Initialization", function () {
    it("should start at epoch 1", async function () {
      expect(await epochManager.currentEpochId()).to.equal(1);
    });

    it("should have correct epoch duration", async function () {
      expect(await epochManager.epochDuration()).to.equal(EPOCH_DURATION);
    });

    it("should have correct scorer", async function () {
      expect(await epochManager.scorer()).to.equal(scorer.address);
    });

    it("should return current epoch data", async function () {
      const ep = await epochManager.getCurrentEpoch();
      expect(ep.epochId).to.equal(1);
      expect(ep.finalized).to.be.false;
      expect(ep.proposalCount).to.equal(0);
    });

    it("should report time remaining", async function () {
      const remaining = await epochManager.getTimeRemaining();
      expect(remaining).to.be.gt(0);
      expect(remaining).to.be.lte(EPOCH_DURATION);
    });
  });

  describe("Proposals", function () {
    it("should accept a valid proposal", async function () {
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);

      const proposals = await epochManager.getEpochProposals(1);
      expect(proposals.length).to.equal(1);
      expect(proposals[0].agent).to.equal(agent1.address);
      expect(proposals[0].feeBps).to.equal(50);
    });

    it("should emit ProposalSubmitted event", async function () {
      await expect(epochManager.connect(agent1).submitProposal(40, 5500, 0))
        .to.emit(epochManager, "ProposalSubmitted")
        .withArgs(1, agent1.address, 40, 5500, 0);
    });

    it("should accept multiple proposals from different agents", async function () {
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      await epochManager.connect(agent2).submitProposal(40, 5500, 0);
      await epochManager.connect(agent3).submitProposal(45, 7000, 2);

      const proposals = await epochManager.getEpochProposals(1);
      expect(proposals.length).to.equal(3);
    });

    it("should reject duplicate proposals from same agent", async function () {
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      await expect(
        epochManager.connect(agent1).submitProposal(40, 5000, 0)
      ).to.be.revertedWithCustomError(epochManager, "AlreadyProposed");
    });

    it("should reject proposals after epoch ends", async function () {
      // Submit a proposal first so proposalCount > 0, preventing auto-advance
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);

      // Now advance time past epoch end
      await time.increase(EPOCH_DURATION + 1);

      // Agent2 tries to propose in the expired epoch - should revert
      await expect(
        epochManager.connect(agent2).submitProposal(40, 5500, 0)
      ).to.be.revertedWithCustomError(epochManager, "EpochNotActive");
    });

    it("should track epoch agents", async function () {
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      await epochManager.connect(agent2).submitProposal(40, 5500, 0);

      const agents = await epochManager.getEpochAgents(1);
      expect(agents.length).to.equal(2);
      expect(agents[0]).to.equal(agent1.address);
      expect(agents[1]).to.equal(agent2.address);
    });

    it("should increment epochsParticipated", async function () {
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      expect(await epochManager.epochsParticipated(agent1.address)).to.equal(1);
    });
  });

  describe("Finalization", function () {
    beforeEach(async function () {
      // Submit proposals
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      await epochManager.connect(agent2).submitProposal(40, 5500, 0);
      await epochManager.connect(agent3).submitProposal(45, 7000, 2);
    });

    it("should finalize epoch with scores and select winner", async function () {
      // Scorer submits scores: agent2 wins with 8000
      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address, agent3.address],
        [5000, 8000, 6000]
      );

      const ep = await epochManager.epochs(1);
      expect(ep.finalized).to.be.true;
      expect(ep.winner).to.equal(agent2.address);
      expect(ep.winnerScore).to.equal(8000);
    });

    it("should apply winner's parameters to pool", async function () {
      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address, agent3.address],
        [5000, 8000, 6000]
      );

      // agent2's proposal was (40, 5500, 0)
      expect(await pool.feeBps()).to.equal(40);
      expect(await pool.curveBeta()).to.equal(5500);
      expect(await pool.curveMode()).to.equal(0);
    });

    it("should emit EpochFinalized event", async function () {
      await expect(
        epochManager.connect(scorer).finalizeEpoch(
          1,
          [agent1.address, agent2.address, agent3.address],
          [5000, 8000, 6000]
        )
      ).to.emit(epochManager, "EpochFinalized").withArgs(1, agent2.address, 8000);
    });

    it("should advance to next epoch after finalization", async function () {
      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address, agent3.address],
        [5000, 8000, 6000]
      );

      expect(await epochManager.currentEpochId()).to.equal(2);
    });

    it("should update lifetime stats", async function () {
      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address, agent3.address],
        [5000, 8000, 6000]
      );

      expect(await epochManager.totalScore(agent2.address)).to.equal(8000);
      expect(await epochManager.epochsWon(agent2.address)).to.equal(1);
      expect(await epochManager.totalScore(agent1.address)).to.equal(5000);
    });

    it("should reject finalization from non-scorer", async function () {
      await expect(
        epochManager.connect(agent1).finalizeEpoch(
          1,
          [agent1.address, agent2.address, agent3.address],
          [5000, 8000, 6000]
        )
      ).to.be.revertedWithCustomError(epochManager, "NotScorer");
    });

    it("should reject double finalization", async function () {
      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address, agent3.address],
        [5000, 8000, 6000]
      );

      await expect(
        epochManager.connect(scorer).finalizeEpoch(
          1,
          [agent1.address, agent2.address, agent3.address],
          [5000, 8000, 6000]
        )
      ).to.be.revertedWithCustomError(epochManager, "AlreadyFinalized");
    });

    it("should reject mismatched score count", async function () {
      await expect(
        epochManager.connect(scorer).finalizeEpoch(
          1,
          [agent1.address, agent2.address],
          [5000, 8000, 6000]
        )
      ).to.be.revertedWithCustomError(epochManager, "InvalidScoreCount");
    });
  });

  describe("Rewards", function () {
    beforeEach(async function () {
      // Fund epoch rewards
      await epochManager.setEpochReward(ethers.parseEther("0.1"));
      await owner.sendTransaction({ to: await epochManager.getAddress(), value: ethers.parseEther("1") });

      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      await epochManager.connect(agent2).submitProposal(40, 5500, 0);

      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address],
        [3000, 7000]
      );
    });

    it("should allow winner to claim reward", async function () {
      const balBefore = await ethers.provider.getBalance(agent2.address);
      const tx = await epochManager.connect(agent2).claimReward(1);
      const receipt = await tx.wait();
      const gasUsed = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice ?? tx.gasPrice ?? 0n);
      const balAfter = await ethers.provider.getBalance(agent2.address);

      expect(balAfter + gasUsed - balBefore).to.equal(ethers.parseEther("0.1"));
    });

    it("should emit RewardClaimed event", async function () {
      await expect(epochManager.connect(agent2).claimReward(1))
        .to.emit(epochManager, "RewardClaimed")
        .withArgs(1, agent2.address, ethers.parseEther("0.1"));
    });

    it("should reject claim from non-winner", async function () {
      await expect(
        epochManager.connect(agent1).claimReward(1)
      ).to.be.revertedWithCustomError(epochManager, "NothingToClaim");
    });

    it("should reject double claim", async function () {
      await epochManager.connect(agent2).claimReward(1);
      await expect(
        epochManager.connect(agent2).claimReward(1)
      ).to.be.revertedWithCustomError(epochManager, "NothingToClaim");
    });
  });

  describe("Multi-Epoch Flow", function () {
    it("should support sequential epochs", async function () {
      // Epoch 1
      await epochManager.connect(agent1).submitProposal(50, 6000, 1);
      await epochManager.connect(agent2).submitProposal(40, 5500, 0);

      await epochManager.connect(scorer).finalizeEpoch(
        1,
        [agent1.address, agent2.address],
        [3000, 7000]
      );

      expect(await epochManager.currentEpochId()).to.equal(2);

      // Epoch 2
      await epochManager.connect(agent1).submitProposal(45, 5800, 2);
      await epochManager.connect(agent3).submitProposal(35, 5000, 0);

      await epochManager.connect(scorer).finalizeEpoch(
        2,
        [agent1.address, agent3.address],
        [9000, 4000]
      );

      expect(await epochManager.currentEpochId()).to.equal(3);

      // Verify cumulative stats
      const [score1, wins1, parts1] = await epochManager.getAgentStats(agent1.address);
      expect(score1).to.equal(3000n + 9000n);
      expect(wins1).to.equal(1); // won epoch 2
      expect(parts1).to.equal(2); // participated in both
    });
  });
});
