import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("AgentController", function () {
  let pool: any;
  let controller: any;
  let tokenA: any;
  let tokenB: any;
  let owner: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let outsider: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const INITIAL_FEE = 30n;
  const INITIAL_BETA = 5000n;
  const MIN_BOND = ethers.parseEther("0.01");
  const COOLDOWN = 300; // 5 minutes
  const MAX_FEE_DELTA = 50;  // 50 bps max change
  const MAX_BETA_DELTA = 2000; // 0.2 scaled 1e4

  beforeEach(async function () {
    [owner, agent1, agent2, outsider] = await ethers.getSigners();

    // Deploy tokens
    const TokenFactory = await ethers.getContractFactory("EvoToken");
    tokenA = await TokenFactory.deploy("Token A", "TKA", INITIAL_SUPPLY, owner.address);
    tokenB = await TokenFactory.deploy("Token B", "TKB", INITIAL_SUPPLY, owner.address);

    // Deploy pool
    const PoolFactory = await ethers.getContractFactory("EvoPool");
    pool = await PoolFactory.deploy(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      INITIAL_FEE,
      INITIAL_BETA,
      owner.address
    );

    // Deploy controller
    const ControllerFactory = await ethers.getContractFactory("AgentController");
    controller = await ControllerFactory.deploy(
      await pool.getAddress(),
      MIN_BOND,
      COOLDOWN,
      MAX_FEE_DELTA,
      MAX_BETA_DELTA,
      owner.address
    );

    // Link controller to pool
    await pool.setController(await controller.getAddress());
  });

  describe("Agent Registration", function () {
    it("should register agent with valid bond", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.active).to.be.true;
      expect(info.bondAmount).to.equal(MIN_BOND);
      expect(info.agentAddress).to.equal(agent1.address);
    });

    it("should reject bond below minimum", async function () {
      await expect(
        controller.connect(agent1).registerAgent({ value: MIN_BOND - 1n })
      ).to.be.revertedWithCustomError(controller, "BondTooLow");
    });

    it("should reject double registration", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await expect(
        controller.connect(agent1).registerAgent({ value: MIN_BOND })
      ).to.be.revertedWithCustomError(controller, "AlreadyRegistered");
    });

    it("should emit AgentRegistered event", async function () {
      await expect(controller.connect(agent1).registerAgent({ value: MIN_BOND }))
        .to.emit(controller, "AgentRegistered")
        .withArgs(agent1.address, MIN_BOND);
    });

    it("should track agent count", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await controller.connect(agent2).registerAgent({ value: MIN_BOND });
      expect(await controller.getAgentCount()).to.equal(2);
    });
  });

  describe("Parameter Updates", function () {
    beforeEach(async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
    });

    it("should allow valid parameter update", async function () {
      const newFee = INITIAL_FEE + 20n; // within delta 50
      const newBeta = INITIAL_BETA + 1000n; // within delta 2000

      await controller.connect(agent1).submitParameterUpdate(newFee, newBeta, 0);

      expect(await pool.feeBps()).to.equal(newFee);
      expect(await pool.curveBeta()).to.equal(newBeta);
    });

    it("should allow switching curve mode", async function () {
      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE, INITIAL_BETA, 1);
      expect(await pool.curveMode()).to.equal(1); // Defensive
    });

    it("should reject unregistered agent", async function () {
      await expect(
        controller.connect(outsider).submitParameterUpdate(30, 5000, 0)
      ).to.be.revertedWithCustomError(controller, "NotRegistered");
    });

    it("should reject fee delta exceeding limit", async function () {
      const tooHighFee = INITIAL_FEE + BigInt(MAX_FEE_DELTA) + 1n;
      await expect(
        controller.connect(agent1).submitParameterUpdate(tooHighFee, INITIAL_BETA, 0)
      ).to.be.revertedWithCustomError(controller, "DeltaExceedsLimit");
    });

    it("should reject beta delta exceeding limit", async function () {
      const tooHighBeta = INITIAL_BETA + BigInt(MAX_BETA_DELTA) + 1n;
      await expect(
        controller.connect(agent1).submitParameterUpdate(INITIAL_FEE, tooHighBeta, 0)
      ).to.be.revertedWithCustomError(controller, "DeltaExceedsLimit");
    });

    it("should reject fee decrease beyond delta limit", async function () {
      // First move fee up
      await controller.connect(agent1).submitParameterUpdate(
        INITIAL_FEE + BigInt(MAX_FEE_DELTA),
        INITIAL_BETA,
        0
      );
      await time.increase(COOLDOWN + 1);

      // Now try to drop it too far in one step
      await expect(
        controller.connect(agent1).submitParameterUpdate(0, INITIAL_BETA, 0)
      ).to.be.revertedWithCustomError(controller, "DeltaExceedsLimit");
    });

    it("should reject fee above MAX_FEE_BPS", async function () {
      await expect(
        controller.connect(agent1).submitParameterUpdate(501, INITIAL_BETA, 0)
      ).to.be.revertedWithCustomError(controller, "FeeTooHigh");
    });

    it("should reject invalid curve mode", async function () {
      await expect(
        controller.connect(agent1).submitParameterUpdate(INITIAL_FEE, INITIAL_BETA, 3)
      ).to.be.revertedWithCustomError(controller, "InvalidCurveMode");
    });

    it("should enforce cooldown between updates", async function () {
      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 10n, INITIAL_BETA, 0);

      // Immediate second update should fail
      await expect(
        controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 20n, INITIAL_BETA, 0)
      ).to.be.revertedWithCustomError(controller, "CooldownActive");
    });

    it("should allow update after cooldown expires", async function () {
      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 10n, INITIAL_BETA, 0);

      await time.increase(COOLDOWN + 1);

      // Should succeed now
      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 20n, INITIAL_BETA, 0);
      expect(await pool.feeBps()).to.equal(INITIAL_FEE + 20n);
    });

    it("should emit AgentUpdateProposed event", async function () {
      await expect(
        controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 5n, INITIAL_BETA + 100n, 2)
      ).to.emit(controller, "AgentUpdateProposed");
    });
  });

  describe("Slashing", function () {
    beforeEach(async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
    });

    it("should allow owner to slash agent", async function () {
      const slashAmount = MIN_BOND / 2n;
      const ownerBalBefore = await ethers.provider.getBalance(owner.address);

      await controller.slashAgent(agent1.address, slashAmount, "malicious update");

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.bondAmount).to.equal(MIN_BOND - slashAmount);
    });

    it("should emit AgentSlashed event", async function () {
      await expect(
        controller.slashAgent(agent1.address, MIN_BOND / 2n, "test slash")
      ).to.emit(controller, "AgentSlashed");
    });

    it("should reject slash from non-owner", async function () {
      await expect(
        controller.connect(outsider).slashAgent(agent1.address, 1, "attack")
      ).to.be.revertedWithCustomError(controller, "OwnableUnauthorizedAccount");
    });

    it("should reject slash exceeding bond", async function () {
      await expect(
        controller.slashAgent(agent1.address, MIN_BOND + 1n, "overkill")
      ).to.be.revertedWithCustomError(controller, "InsufficientSlashAmount");
    });

    it("should reject slash on unregistered agent", async function () {
      await expect(
        controller.slashAgent(outsider.address, 1, "unknown")
      ).to.be.revertedWithCustomError(controller, "NotRegistered");
    });
  });

  describe("Pause / Unpause", function () {
    it("should block registration when paused", async function () {
      await controller.pause();
      await expect(
        controller.connect(agent1).registerAgent({ value: MIN_BOND })
      ).to.be.revertedWithCustomError(controller, "Paused");
    });

    it("should block parameter updates when paused", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await controller.pause();

      await expect(
        controller.connect(agent1).submitParameterUpdate(INITIAL_FEE, INITIAL_BETA, 0)
      ).to.be.revertedWithCustomError(controller, "Paused");
    });

    it("should resume after unpause", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await controller.pause();
      await controller.unpause();

      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 5n, INITIAL_BETA, 0);
      expect(await pool.feeBps()).to.equal(INITIAL_FEE + 5n);
    });
  });

  describe("Admin", function () {
    it("should allow owner to update config", async function () {
      await controller.setMinBond(ethers.parseEther("1"));
      expect(await controller.minBond()).to.equal(ethers.parseEther("1"));

      await controller.setCooldown(600);
      expect(await controller.cooldownSeconds()).to.equal(600);

      await controller.setMaxFeeDelta(100);
      expect(await controller.maxFeeDelta()).to.equal(100);

      await controller.setMaxBetaDelta(3000);
      expect(await controller.maxBetaDelta()).to.equal(3000);
    });

    it("should reject admin calls from non-owner", async function () {
      await expect(
        controller.connect(outsider).setMinBond(1)
      ).to.be.revertedWithCustomError(controller, "OwnableUnauthorizedAccount");
    });
  });

  describe("Deregistration", function () {
    it("should allow agent to deregister and withdraw bond", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      const balBefore = await ethers.provider.getBalance(agent1.address);

      const tx = await controller.connect(agent1).deregisterAgent();
      const receipt = await tx.wait();
      const gasUsed = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice ?? tx.gasPrice ?? 0n);
      const balAfter = await ethers.provider.getBalance(agent1.address);

      // Bond should be returned minus gas
      expect(balAfter + gasUsed - balBefore).to.equal(MIN_BOND);

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.active).to.be.false;
      expect(info.bondAmount).to.equal(0);
    });

    it("should emit AgentDeregistered event", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await expect(controller.connect(agent1).deregisterAgent())
        .to.emit(controller, "AgentDeregistered")
        .withArgs(agent1.address, MIN_BOND);
    });

    it("should reject deregister from non-registered agent", async function () {
      await expect(
        controller.connect(outsider).deregisterAgent()
      ).to.be.revertedWithCustomError(controller, "NotRegistered");
    });

    it("should reject parameter updates after deregister", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await controller.connect(agent1).deregisterAgent();
      await expect(
        controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 5n, INITIAL_BETA, 0)
      ).to.be.revertedWithCustomError(controller, "NotRegistered");
    });
  });

  describe("Bond Top-Up", function () {
    it("should allow agent to top up bond", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      const topUp = ethers.parseEther("0.05");
      await controller.connect(agent1).topUpBond({ value: topUp });

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.bondAmount).to.equal(MIN_BOND + topUp);
    });

    it("should emit BondTopUp event", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      const topUp = ethers.parseEther("0.02");
      await expect(controller.connect(agent1).topUpBond({ value: topUp }))
        .to.emit(controller, "BondTopUp")
        .withArgs(agent1.address, topUp, MIN_BOND + topUp);
    });

    it("should reject zero amount top-up", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      await expect(
        controller.connect(agent1).topUpBond({ value: 0 })
      ).to.be.revertedWithCustomError(controller, "ZeroAmount");
    });

    it("should reject top-up from non-registered agent", async function () {
      await expect(
        controller.connect(outsider).topUpBond({ value: MIN_BOND })
      ).to.be.revertedWithCustomError(controller, "NotRegistered");
    });
  });

  describe("Update Tracking", function () {
    it("should track update count per agent", async function () {
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
      expect(await controller.updateCount(agent1.address)).to.equal(0);

      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 5n, INITIAL_BETA, 0);
      expect(await controller.updateCount(agent1.address)).to.equal(1);

      // Wait for cooldown
      await ethers.provider.send("evm_increaseTime", [COOLDOWN + 1]);
      await ethers.provider.send("evm_mine", []);

      await controller.connect(agent1).submitParameterUpdate(INITIAL_FEE + 10n, INITIAL_BETA, 0);
      expect(await controller.updateCount(agent1.address)).to.equal(2);
    });
  });

  describe("ERC-20 Token Bonding", function () {
    let bondTokenERC20: any;

    beforeEach(async function () {
      // Deploy a bond token
      const TokenFactory = await ethers.getContractFactory("EvoToken");
      bondTokenERC20 = await TokenFactory.deploy("Bond Token", "BND", INITIAL_SUPPLY, owner.address);

      // Set bond token on controller
      await controller.setBondToken(await bondTokenERC20.getAddress());

      // Give agent1 some bond tokens
      await bondTokenERC20.transfer(agent1.address, ethers.parseEther("1000"));
      await bondTokenERC20.connect(agent1).approve(await controller.getAddress(), ethers.MaxUint256);

      // Register agent
      await controller.connect(agent1).registerAgent({ value: MIN_BOND });
    });

    it("should allow token bond deposit", async function () {
      const amount = ethers.parseEther("100");
      await controller.connect(agent1).depositTokenBond(amount);

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.tokenBondAmount).to.equal(amount);
    });

    it("should emit TokenBondDeposited event", async function () {
      const amount = ethers.parseEther("50");
      await expect(controller.connect(agent1).depositTokenBond(amount))
        .to.emit(controller, "TokenBondDeposited")
        .withArgs(agent1.address, amount, amount);
    });

    it("should accumulate multiple token bond deposits", async function () {
      await controller.connect(agent1).depositTokenBond(ethers.parseEther("50"));
      await controller.connect(agent1).depositTokenBond(ethers.parseEther("30"));

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.tokenBondAmount).to.equal(ethers.parseEther("80"));
    });

    it("should reject zero token bond deposit", async function () {
      await expect(
        controller.connect(agent1).depositTokenBond(0)
      ).to.be.revertedWithCustomError(controller, "ZeroAmount");
    });

    it("should reject token bond deposit from unregistered agent", async function () {
      await bondTokenERC20.transfer(outsider.address, ethers.parseEther("100"));
      await bondTokenERC20.connect(outsider).approve(await controller.getAddress(), ethers.MaxUint256);

      await expect(
        controller.connect(outsider).depositTokenBond(ethers.parseEther("10"))
      ).to.be.revertedWithCustomError(controller, "NotRegistered");
    });

    it("should reject token withdrawal while active", async function () {
      await controller.connect(agent1).depositTokenBond(ethers.parseEther("100"));

      await expect(
        controller.connect(agent1).withdrawTokenBond()
      ).to.be.revertedWithCustomError(controller, "StillActive");
    });

    it("should allow token withdrawal after deregistration", async function () {
      const amount = ethers.parseEther("100");
      await controller.connect(agent1).depositTokenBond(amount);

      // Deregister (returns BNB bond)
      await controller.connect(agent1).deregisterAgent();

      const balBefore = await bondTokenERC20.balanceOf(agent1.address);
      await controller.connect(agent1).withdrawTokenBond();
      const balAfter = await bondTokenERC20.balanceOf(agent1.address);

      expect(balAfter - balBefore).to.equal(amount);

      const info = await controller.getAgentInfo(agent1.address);
      expect(info.tokenBondAmount).to.equal(0);
    });

    it("should reject withdrawal with zero token bond", async function () {
      await controller.connect(agent1).deregisterAgent();

      await expect(
        controller.connect(agent1).withdrawTokenBond()
      ).to.be.revertedWithCustomError(controller, "ZeroAmount");
    });

    it("should allow owner to set bond token", async function () {
      const TokenFactory = await ethers.getContractFactory("EvoToken");
      const newToken = await TokenFactory.deploy("New Bond", "NBT", INITIAL_SUPPLY, owner.address);

      await controller.setBondToken(await newToken.getAddress());
      expect(await controller.bondToken()).to.equal(await newToken.getAddress());
    });

    it("should reject setBondToken from non-owner", async function () {
      await expect(
        controller.connect(outsider).setBondToken(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(controller, "OwnableUnauthorizedAccount");
    });
  });
});
