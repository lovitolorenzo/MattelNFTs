import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);

const { ethers, upgrades } = require("hardhat");
import { expect } from "chai";

async function deployWarrantyNFT() {
	const [admin, minter, user] = await ethers.getSigners();

	const WarrantyManager = await ethers.getContractFactory("WarrantyManager");
	const warrantyManager = await upgrades.deployProxy(WarrantyManager, [admin.address, minter.address], {
		initializer: "initialize",
	});
	await warrantyManager.deployed();

	const WarrantyNFT = await ethers.getContractFactory("WarrantyNFT");
	const warrantyNFT = await upgrades.deployProxy(
		WarrantyNFT,
		[admin.address, minter.address, warrantyManager.address],
		{
			initializer: "initialize",
		},
	);
	await warrantyNFT.deployed();

	return { warrantyNFT, warrantyManager, admin, minter, user };
}

describe("WarrantyNFT", function () {
	it("should initialize roles correctly", async function () {
		const { warrantyNFT, admin, minter } = await deployWarrantyNFT();

		expect(await warrantyNFT.hasRole(await warrantyNFT.DEFAULT_ADMIN_ROLE(), admin.address)).to.be.true;
		expect(await warrantyNFT.hasRole(await warrantyNFT.MINTER_ROLE(), minter.address)).to.be.true;
	});

	it("should mint an NFT with warranty", async function () {
		const { warrantyNFT, minter, user, warrantyManager } = await deployWarrantyNFT();

		const tx = await warrantyNFT.connect(minter).safeMint(
			user.address,
			"ipfs://tokenURI",
			31536000, // 1 year duration
			"Warranty1",
			"Description1",
			"image1.png",
		);
		await tx.wait();

		const tokenId = 1;
		const owner = await warrantyNFT.ownerOf(tokenId);
		expect(owner).to.equal(user.address);

		const warranty = await warrantyManager.getWarrantyInfo(tokenId);
		expect(warranty.startDate).to.be.gt(0);
		expect(warranty.isActive).to.be.true;
	});

	it("should batch mint multiple NFTs with warranties", async function () {
		const { warrantyNFT, minter, user, warrantyManager } = await deployWarrantyNFT();

		const to = [user.address, user.address];
		const uris = ["ipfs://tokenURI1", "ipfs://tokenURI2"];
		const names = ["Warranty1", "Warranty2"];
		const descriptions = ["Description1", "Description2"];
		const images = ["image1.png", "image2.png"];
		const duration = 31536000; // 1 year

		await warrantyNFT.connect(minter).multipleMint(to, uris, duration, names, descriptions, images);

		for (let i = 1; i <= to.length; i++) {
			const owner = await warrantyNFT.ownerOf(i);
			expect(owner).to.equal(user.address);

			const warranty = await warrantyManager.getWarrantyInfo(i);
			expect(warranty.startDate).to.be.gt(0);
			expect(warranty.isActive).to.be.true;
		}
	});

	it("should revert if non-minter tries to mint", async function () {
		const { warrantyNFT, user } = await deployWarrantyNFT();
		await expect(
			warrantyNFT
				.connect(user)
				.safeMint(user.address, "ipfs://tokenURI", 31536000, "Warranty", "Description", "image.png"),
		).to.be.rejectedWith("AccessControl: account");
	});

	it("should revert if input array lengths mismatch in batch mint", async function () {
		const { warrantyNFT, minter, user } = await deployWarrantyNFT();

		await expect(
			warrantyNFT
				.connect(minter)
				.multipleMint(
					[user.address],
					["ipfs://tokenURI1", "ipfs://tokenURI2"],
					31536000,
					["Warranty1"],
					["Description1", "Description2"],
					["image1.png"],
				),
		).to.be.rejectedWith("Input array length mismatch");
	});

	it("should revert if minting while paused", async function () {
		const { warrantyNFT, admin, minter, user } = await deployWarrantyNFT();
		await warrantyNFT.connect(admin).pause();

		await expect(
			warrantyNFT
				.connect(minter)
				.safeMint(user.address, "ipfs://tokenURI", 31536000, "Warranty", "Description", "image.png"),
		).to.be.rejectedWith("Pausable: paused");

		await warrantyNFT.connect(admin).unpause();
		const tx = await warrantyNFT
			.connect(minter)
			.safeMint(user.address, "ipfs://tokenURI", 31536000, "Warranty", "Description", "image.png");
		await tx.wait();
	});
});

describe("WarrantyNFT Fuzz Testing", async function () {
	let [admin, minter, user] = await ethers.getSigners();

	let WarrantyManager = await ethers.getContractFactory("WarrantyManager");
	let warrantyManager = await upgrades.deployProxy(WarrantyManager, [admin.address, minter.address], {
		initializer: "initialize",
	});
	let WarrantyNFT = await ethers.getContractFactory("WarrantyNFT");
	let warrantyNFT = await upgrades.deployProxy(WarrantyNFT, [admin.address, minter.address, warrantyManager.address], {
		initializer: "initialize",
	});
	await warrantyNFT.deployed();

	beforeEach(async () => {
		const [adminSigner, minterSigner, userSigner] = await ethers.getSigners();
		admin = adminSigner;
		minter = minterSigner;
		user = userSigner;

		// Deploy WarrantyManager and WarrantyNFT
		const WarrantyManager = await ethers.getContractFactory("WarrantyManager");
		warrantyManager = await WarrantyManager.deploy();
		await warrantyManager.deployed();

		const WarrantyNFT = await ethers.getContractFactory("WarrantyNFT");
		warrantyNFT = await WarrantyNFT.deploy(admin.address, minter.address, warrantyManager.address);
		await warrantyNFT.deployed();
	});

	it("should mint an NFT with random data", async function () {
		const mintTimes = Math.floor(Math.random() * 100);
		const randomDuration = Math.floor(Math.random() * 10000000); // Random duration
		const randomURI = "ipfs://randomURI" + Math.floor(Math.random() * 100000); // Random URI

		// Fuzz test: minting an NFT with random data
		for (let i = 0; i < mintTimes; i++) {
			const tx = await warrantyNFT.connect(minter).safeMint(user.address, randomURI, randomDuration);
			await tx.wait();

			const tokenId = await warrantyNFT.totalSupply();
			const owner = await warrantyNFT.ownerOf(tokenId);
			expect(owner).to.equal(user.address);

			const warranty = await warrantyManager.getWarrantyInfo(tokenId);
			expect(warranty.startDate).to.be.gt(0);
			expect(warranty.isActive).to.be.true;
		}
	});

	it("should batch mint NFTs with random data", async function () {
		const mintTimes = Math.floor(Math.random() * 100);

		const numTokens = Math.floor(Math.random() * 1000);
		const to = new Array(numTokens).fill(user.address);
		const uris = Array.from({ length: numTokens }, () => "ipfs://randomURI" + Math.floor(Math.random() * 100000));
		const durations = Array.from({ length: numTokens }, () => Math.floor(Math.random() * 10000000)); // Random durations

		// Fuzz test: batch minting with random data

		for (let i = 0; i < mintTimes; i++) {
			await warrantyNFT.connect(minter).multipleMint(to, uris, durations);

			for (let i = 1; i <= numTokens; i++) {
				const owner = await warrantyNFT.ownerOf(i);
				expect(owner).to.equal(user.address);

				const warranty = await warrantyManager.getWarrantyInfo(i);
				expect(warranty.startDate).to.be.gt(0);
				expect(warranty.isActive).to.be.true;
			}
		}
	});
});

describe("WarrantyNFT Invariant Testing", async function () {
	let [admin, minter, user] = await ethers.getSigners();

	let WarrantyManager = await ethers.getContractFactory("WarrantyManager");
	let warrantyManager = await upgrades.deployProxy(WarrantyManager, [admin.address, minter.address], {
		initializer: "initialize",
	});
	let WarrantyNFT = await ethers.getContractFactory("WarrantyNFT");
	let warrantyNFT = await upgrades.deployProxy(WarrantyNFT, [admin.address, minter.address, warrantyManager.address], {
		initializer: "initialize",
	});
	await warrantyNFT.deployed();

	beforeEach(async () => {
		const [adminSigner, minterSigner, userSigner] = await ethers.getSigners();
		admin = adminSigner;
		minter = minterSigner;
		user = userSigner;

		// Deploy WarrantyManager and WarrantyNFT
		const WarrantyManager = await ethers.getContractFactory("WarrantyManager");
		warrantyManager = await WarrantyManager.deploy();
		await warrantyManager.deployed();

		const WarrantyNFT = await ethers.getContractFactory("WarrantyNFT");
		warrantyNFT = await WarrantyNFT.deploy(admin.address, minter.address, warrantyManager.address);
		await warrantyNFT.deployed();
	});

	it("should never have totalSupply < 0", async function () {
		const totalSupplyBefore = await warrantyNFT.totalSupply();
		expect(totalSupplyBefore).to.be.at.least(0);

		// Fuzz test: minting multiple times
		const mintTimes = 10;
		for (let i = 0; i < mintTimes; i++) {
			const randomDuration = Math.floor(Math.random() * 10000000); // Random duration
			const randomURI = "ipfs://randomURI" + Math.floor(Math.random() * 100000); // Random URI
			await warrantyNFT.connect(minter).safeMint(user.address, randomURI, randomDuration);

			const totalSupplyAfter = await warrantyNFT.totalSupply();
			expect(totalSupplyAfter).to.be.at.least(0);
		}
	});

	it("should never have an unassigned owner for an NFT", async function () {
		// Fuzz test: minting and checking owner assignment
		const randomDuration = Math.floor(Math.random() * 10000000); // Random duration
		const randomURI = "ipfs://randomURI" + Math.floor(Math.random() * 100000); // Random URI

		await warrantyNFT.connect(minter).safeMint(user.address, randomURI, randomDuration);

		const tokenId = await warrantyNFT.totalSupply();
		const owner = await warrantyNFT.ownerOf(tokenId);
		expect(owner).to.not.equal(ethers.constants.AddressZero); // Ensure owner is not the zero address
	});
});

declare module "chai-as-promised";
