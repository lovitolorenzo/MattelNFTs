// TESTNET
require("@nomicfoundation/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");

const dotenv = require("dotenv");

dotenv.config();
dotenv.config({ path: `.env.${process.env.ENV}` });

const { API_URL, DEPLOYER_PRIVATE_KEY } = process.env;

// Define the build task for compiling contracts
task("build", "Compile the contracts").setAction(async (_, { run }) => {
	await run("compile");
});

task("compile-base", "Compiles only base.sol").setAction(async (_, { run }) => {
	await run("compile", { contracts: ["contracts/base.sol"] });
});

module.exports = {
	solidity: {
		version: "0.8.28",
		settings: {
			optimizer: {
				enabled: true,
				runs: 200,
			},
		},
	},
	defaultNetwork: "ropsten",
	networks: {
		hardhat: {
			//blockGasLimit: 400000000000000,
		},
		ropsten: {
			url: process.env.API_URL,
			accounts: [`0x${process.env.DEPLOYER_PRIVATE_KEY}`],
		},
	},
};
