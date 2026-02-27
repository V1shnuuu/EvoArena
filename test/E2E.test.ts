import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * End-to-End Integration Test
 *
 * Tests the full lifecycle: deploy → register → liquidity → swap →
 * parameter update → epoch competition → slashing → deregister
 */
describe("E2E Integration", function () {
  let pool: any;
  let controller: any;
  let epochManager: any;
  let timeLock: any;
  let tokenA: any;
  let tokenB: any;
  let owner: SignerWithAddress;
  let agent1: SignerWithAddress;
  let agent2: SignerWithAddress;
  let lp: SignerWithAddress;
  let trader: SignerWithAddress;
  let scorer: SignerWithAddress;

  const INITIAL_SUPPLY = ethers.parseEther("1000000");
  const MIN_BOND = ethers.parseEther("0.01");
  const COOLDOWN = 300;
  const EPOCH_DURATION = 3600;
  const EPOCH_REWARD = ethers.parseEther("0.1");

  before(async function () {
    [owner, agent1, agent2, lp, trader, scorer] = await ethers.getSigners();

    // Deploy tokens
    const TokenFactory = await ethers.getContractFactory("EvoToken");
    tokenA = await TokenFactory.deploy("Token A", "TKA", INITIAL_SUPPLY, owner.address);
    tokenB = await TokenFactory.deploy("Token B", "TKB", INITIAL_SUPPLY, owner.address);

    // Deploy pool
    const PoolFactory = await ethers.getContractFactory("EvoPool");
    pool = await PoolFactory.deploy(
      await tokenA.getAddress(), await tokenB.getAddress(),
      30, 5000, owner.address
    );

    // Deploy controller
    const ControllerFactory = await ethers.getContractFactory("AgentController");
    controller = await ControllerFactory.deploy(
      await pool.getAddress(), MIN_BOND, COOLDOWN, 50, 2000, owner.address
    );

    // Deploy epoch manager
    const EpochManagerFactory = await ethers.getContractFactory("EpochManager");
    epochManager = await EpochManagerFactory.deploy(
      await pool.getAddress(), await controller.getAddress(),
      EPOCH_DURATION, scorer.address, owner.address
    );

    // Set epoch reward
    await epochManager.setEpochReward(EPOCH_REWARD);

    // Deploy timelock
    const TimeLockFactory = await ethers.getContractFactory("TimeLock");
    timeLock = await TimeLockFactory.deploy(86400, owner.address);

    // Link controller to pool
    await pool.setController(await controller.getAddress());

    // Link epoch manager to pool
    await pool.setEpochManager(await epochManager.getAddress());

    // Set treasury
    await pool.setTreasury(owner.address);

    // Fund epoch manager for rewards
    await owner.sendTransaction({
      to: await epochManager.getAddress(),
      value: ethers.parseEther("1"),
    });

    // Distribute tokens
    const poolAddr = await pool.getAddress();
    for (const user of [lp, trader]) {
      await tokenA.transfer(user.address, ethers.parseEther("100000"));
      await tokenB.transfer(user.address, ethers.parseEther("100000"));
      await tokenA.connect(user).approve(poolAddr, ethers.MaxUint256);
      await tokenB.connect(user).approve(poolAddr, ethers.MaxUint256);
    }
  });

  it("Step 1: LP adds initial liquidity", async function () {
    const amount = ethers.parseEther("10000");
    await pool.connect(lp).addLiquidity(amount, amount);

    const [r0, r1] = await pool.getReserves();
    expect(r0).to.equal(amount);
    expect(r1).to.equal(amount);
    expect(await pool.balanceOf(lp.address)).to.be.gt(0);
  });

  it("Step 2: Trader executes swaps", async function () {
    await pool.connect(trader).swap(true, ethers.parseEther("100"), 0);
    await pool.connect(trader).swap(false, ethers.parseEther("50"), 0);

    expect(await pool.tradeCount()).to.equal(2);
    expect(await pool.cumulativeVolume0()).to.be.gt(0);
  });

  it("Step 3: Agents register with bond", async function () {
    await controller.connect(agent1).registerAgent({ value: MIN_BOND });
    await controller.connect(agent2).registerAgent({ value: MIN_BOND });

    expect(await controller.getAgentCount()).to.equal(2);

    const info1 = await controller.getAgentInfo(agent1.address);
    expect(info1.active).to.be.true;
    expect(info1.bondAmount).to.equal(MIN_BOND);
  });

  it("Step 4: Agent1 submits parameter update", async function () {
    await controller.connect(agent1).submitParameterUpdate(40, 5500, 0);

    expect(await pool.feeBps()).to.equal(40);
    expect(await pool.curveBeta()).to.equal(5500);
  });

  it("Step 5: TWAP oracle accumulates prices", async function () {
    const p0Before = await pool.price0CumulativeLast();
    await time.increase(60);
    await pool.connect(trader).swap(true, ethers.parseEther("10"), 0);
    const p0After = await pool.price0CumulativeLast();
    expect(p0After).to.be.gt(p0Before);
  });

  it("Step 6: Protocol fee accumulates and gets collected", async function () {
    await pool.setProtocolFee(1000); // 10% of swap fee
    await pool.connect(trader).swap(true, ethers.parseEther("200"), 0);

    const accum = await pool.protocolFeeAccum0();
    expect(accum).to.be.gt(0);

    const balBefore = await tokenA.balanceOf(owner.address);
    await pool.collectProtocolFees();
    expect(await tokenA.balanceOf(owner.address)).to.be.gt(balBefore);
    expect(await pool.protocolFeeAccum0()).to.equal(0);
  });

  it("Step 7: Agents submit epoch proposals", async function () {
    await epochManager.connect(agent1).submitProposal(45, 6000, 1);
    await epochManager.connect(agent2).submitProposal(35, 5200, 0);

    const agents = await epochManager.getEpochAgents(1);
    expect(agents.length).to.equal(2);
  });

  it("Step 8: Scorer finalizes epoch and winner receives reward", async function () {
    await time.increase(EPOCH_DURATION + 1);

    await epochManager.connect(scorer).finalizeEpoch(
      1,
      [agent1.address, agent2.address],
      [9000, 7500]
    );

    const data = await epochManager.epochs(1);
    expect(data.winner).to.equal(agent1.address);
    expect(data.finalized).to.be.true;

    // Winner claims reward
    const balBefore = await ethers.provider.getBalance(agent1.address);
    const tx = await epochManager.connect(agent1).claimReward(1);
    const receipt = await tx.wait();
    const gas = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice);
    const balAfter = await ethers.provider.getBalance(agent1.address);
    expect(balAfter + gas - balBefore).to.equal(EPOCH_REWARD);
  });

  it("Step 9: LP token is transferable (ERC-20)", async function () {
    const lpBal = await pool.balanceOf(lp.address);
    expect(lpBal).to.be.gt(0);

    const transferAmt = lpBal / 10n;
    await pool.connect(lp).transfer(trader.address, transferAmt);
    expect(await pool.balanceOf(trader.address)).to.equal(transferAmt);
  });

  it("Step 10: Agent bond top-up and slashing", async function () {
    await controller.connect(agent1).topUpBond({ value: ethers.parseEther("0.05") });
    const infoAfterTopUp = await controller.getAgentInfo(agent1.address);
    expect(infoAfterTopUp.bondAmount).to.equal(MIN_BOND + ethers.parseEther("0.05"));

    // Slash half
    const slashAmt = ethers.parseEther("0.03");
    await controller.slashAgent(agent1.address, slashAmt, "test slash");
    const infoAfterSlash = await controller.getAgentInfo(agent1.address);
    expect(infoAfterSlash.bondAmount).to.equal(MIN_BOND + ethers.parseEther("0.05") - slashAmt);
  });

  it("Step 11: Agent deregisters and withdraws bond", async function () {
    const balBefore = await ethers.provider.getBalance(agent2.address);
    const tx = await controller.connect(agent2).deregisterAgent();
    const receipt = await tx.wait();
    const gas = BigInt(receipt!.gasUsed) * BigInt(receipt!.gasPrice);
    const balAfter = await ethers.provider.getBalance(agent2.address);

    expect(balAfter + gas - balBefore).to.equal(MIN_BOND);
    const info = await controller.getAgentInfo(agent2.address);
    expect(info.active).to.be.false;
  });

  it("Step 12: LP removes liquidity and receives tokens", async function () {
    const lpBal = await pool.balanceOf(lp.address);
    const balA = await tokenA.balanceOf(lp.address);
    const balB = await tokenB.balanceOf(lp.address);

    await pool.connect(lp).removeLiquidity(lpBal);

    expect(await tokenA.balanceOf(lp.address)).to.be.gt(balA);
    expect(await tokenB.balanceOf(lp.address)).to.be.gt(balB);
    expect(await pool.balanceOf(lp.address)).to.equal(0);
  });

  it("Step 13: TimeLock queues and executes governance action", async function () {
    // Transfer controller ownership to timelock
    await controller.transferOwnership(await timeLock.getAddress());

    const eta = (await time.latest()) + 86400 + 100;
    const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("0.1")]);

    await timeLock.queueTransaction(
      await controller.getAddress(), 0, "setMinBond(uint256)", data, eta
    );

    await time.increaseTo(eta);

    await timeLock.executeTransaction(
      await controller.getAddress(), 0, "setMinBond(uint256)", data, eta
    );

    expect(await controller.minBond()).to.equal(ethers.parseEther("0.1"));
  });
});
