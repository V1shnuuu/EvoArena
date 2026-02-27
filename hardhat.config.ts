import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x" + "0".repeat(64);
const BSC_TESTNET_RPC =
  process.env.BSC_TESTNET_RPC ||
  "https://data-seed-prebsc-1-s1.binance.org:8545/";
const BSC_MAINNET_RPC =
  process.env.BSC_MAINNET_RPC ||
  "https://bsc-dataseed1.binance.org/";
const BSCSCAN_API_KEY = process.env.BSCSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: false,
    },
  },
  networks: {
    hardhat: {},
    bscTestnet: {
      url: BSC_TESTNET_RPC,
      chainId: 97,
      accounts: [PRIVATE_KEY],
    },
    bscMainnet: {
      url: BSC_MAINNET_RPC,
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gasPrice: 3000000000, // 3 gwei
    },
  },
  etherscan: {
    apiKey: {
      bscTestnet: BSCSCAN_API_KEY,
      bsc: BSCSCAN_API_KEY,
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    coinmarketcap: process.env.CMC_API_KEY || "",
    token: "BNB",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  // solidity-coverage is included via hardhat-toolbox
};

export default config;
