import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-network-helpers";

describe("TimeLock", function () {
  let timeLock: any;
  let controller: any;
  let pool: any;
  let tokenA: any;
  let tokenB: any;
  let owner: SignerWithAddress;
  let outsider: SignerWithAddress;

  const DELAY = 86400; // 24 hours
  const INITIAL_SUPPLY = ethers.parseEther("1000000");

  beforeEach(async function () {
    [owner, outsider] = await ethers.getSigners();

    const TokenFactory = await ethers.getContractFactory("EvoToken");
    tokenA = await TokenFactory.deploy("Token A", "TKA", INITIAL_SUPPLY, owner.address);
    tokenB = await TokenFactory.deploy("Token B", "TKB", INITIAL_SUPPLY, owner.address);

    const PoolFactory = await ethers.getContractFactory("EvoPool");
    pool = await PoolFactory.deploy(
      await tokenA.getAddress(),
      await tokenB.getAddress(),
      30,
      5000,
      owner.address
    );

    const ControllerFactory = await ethers.getContractFactory("AgentController");
    controller = await ControllerFactory.deploy(
      await pool.getAddress(),
      ethers.parseEther("0.01"),
      300,
      50,
      2000,
      owner.address // will transfer ownership to timelock
    );

    const TimeLockFactory = await ethers.getContractFactory("TimeLock");
    timeLock = await TimeLockFactory.deploy(DELAY, owner.address);

    // Transfer controller ownership to timelock
    await controller.transferOwnership(await timeLock.getAddress());
  });

  describe("Deployment", function () {
    it("should set correct delay", async function () {
      expect(await timeLock.delay()).to.equal(DELAY);
    });

    it("should reject delay below minimum", async function () {
      const TimeLockFactory = await ethers.getContractFactory("TimeLock");
      await expect(
        TimeLockFactory.deploy(3600, owner.address) // 1 hour < 24 hours
      ).to.be.revertedWithCustomError(timeLock, "DelayOutOfRange");
    });

    it("should reject delay above maximum", async function () {
      const TimeLockFactory = await ethers.getContractFactory("TimeLock");
      await expect(
        TimeLockFactory.deploy(8 * 86400, owner.address) // 8 days > 7 days
      ).to.be.revertedWithCustomError(timeLock, "DelayOutOfRange");
    });
  });

  describe("Queue & Execute", function () {
    it("should queue a transaction", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1")]);

      await expect(
        timeLock.queueTransaction(
          await controller.getAddress(),
          0,
          "setMinBond(uint256)",
          data,
          eta
        )
      ).to.emit(timeLock, "TransactionQueued");
    });

    it("should execute a queued transaction after delay", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const newMinBond = ethers.parseEther("1");
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [newMinBond]);

      await timeLock.queueTransaction(
        await controller.getAddress(),
        0,
        "setMinBond(uint256)",
        data,
        eta
      );

      // Fast-forward past the delay
      await time.increaseTo(eta);

      await timeLock.executeTransaction(
        await controller.getAddress(),
        0,
        "setMinBond(uint256)",
        data,
        eta
      );

      expect(await controller.minBond()).to.equal(newMinBond);
    });

    it("should reject execution before eta", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1")]);

      await timeLock.queueTransaction(
        await controller.getAddress(),
        0,
        "setMinBond(uint256)",
        data,
        eta
      );

      await expect(
        timeLock.executeTransaction(
          await controller.getAddress(),
          0,
          "setMinBond(uint256)",
          data,
          eta
        )
      ).to.be.revertedWithCustomError(timeLock, "TimelockNotReached");
    });

    it("should reject execution after grace period", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1")]);

      await timeLock.queueTransaction(
        await controller.getAddress(),
        0,
        "setMinBond(uint256)",
        data,
        eta
      );

      // Fast-forward past grace period (3 days)
      await time.increaseTo(eta + 3 * 86400 + 1);

      await expect(
        timeLock.executeTransaction(
          await controller.getAddress(),
          0,
          "setMinBond(uint256)",
          data,
          eta
        )
      ).to.be.revertedWithCustomError(timeLock, "TimelockExpired");
    });
  });

  describe("Cancel", function () {
    it("should cancel a queued transaction", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1")]);

      await timeLock.queueTransaction(
        await controller.getAddress(),
        0,
        "setMinBond(uint256)",
        data,
        eta
      );

      await expect(
        timeLock.cancelTransaction(
          await controller.getAddress(),
          0,
          "setMinBond(uint256)",
          data,
          eta
        )
      ).to.emit(timeLock, "TransactionCanceled");
    });

    it("should reject canceling non-queued transaction", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1")]);

      await expect(
        timeLock.cancelTransaction(
          await controller.getAddress(),
          0,
          "setMinBond(uint256)",
          data,
          eta
        )
      ).to.be.revertedWithCustomError(timeLock, "TransactionNotQueued");
    });
  });

  describe("Access Control", function () {
    it("should reject queue from non-owner", async function () {
      const eta = (await time.latest()) + DELAY + 100;
      const data = ethers.AbiCoder.defaultAbiCoder().encode(["uint256"], [ethers.parseEther("1")]);

      await expect(
        timeLock.connect(outsider).queueTransaction(
          await controller.getAddress(),
          0,
          "setMinBond(uint256)",
          data,
          eta
        )
      ).to.be.revertedWithCustomError(timeLock, "OwnableUnauthorizedAccount");
    });
  });
});
