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

module.exports = {
	solidity: {
		compilers: [
			{
				version: "0.8.21",

				settings: {
					optimizer: {
						enabled: true,

						runs: 200,
					},
				},
			},
			{
				version: "0.8.17",

				settings: {
					optimizer: {
						enabled: true,

						runs: 200,
					},
				},
			},
			{
				version: "0.8.13",

				settings: {
					optimizer: {
						enabled: true,

						runs: 200,
					},
				},
			},
			{
				version: "0.4.17",

				settings: {
					optimizer: {
						enabled: true,

						runs: 200,
					},
				},
			},
		],
		settings: {
			optimizer: {
				enabled: true,
				runs: 1,
			},
		},
	},
	defaultNetwork: "ropsten",
	networks: {
		hardhat: {
			//blockGasLimit: 400000000000000,
		},
		ropsten: {
			url: API_URL,
			accounts: [`0x${DEPLOYER_PRIVATE_KEY}`],
		},
	},
};
