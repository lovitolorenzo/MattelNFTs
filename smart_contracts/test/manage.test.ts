import hre from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { expect } from "chai";

async function deployWarrantyManager() {
	const [admin, minter, user] = await ethers.getSigners();

	const WarrantyManager = await ethers.getContractFactory("WarrantyManager");
	const warrantyManager = await upgrades.deployProxy(WarrantyManager, [admin.address, minter.address], {
		initializer: "initialize",
	});
	await warrantyManager.deployed();

	return { warrantyManager, admin, minter, user };
}

describe("WarrantyManager", function () {
	it("should initialize roles correctly", async function () {
		const { warrantyManager, admin, minter } = await deployWarrantyManager();

		expect(await warrantyManager.hasRole(await warrantyManager.DEFAULT_ADMIN_ROLE(), admin.address)).equals(true);
		expect(await warrantyManager.hasRole(await warrantyManager.ADMIN_ROLE(), admin.address)).equals(true);
		expect(await warrantyManager.hasRole(await warrantyManager.MINTER_ROLE(), minter.address)).equals(true);
	});

	it("should issue a warranty", async function () {
		const { warrantyManager, minter } = await deployWarrantyManager();
		await warrantyManager.connect(minter).issueWarranty(1, 31536000, "Warranty1", "Description1", "image1.png"); // 1 year

		const warranty = await warrantyManager.getWarrantyInfo(1);
		expect(warranty.startDate).to.be.gt(0);
		expect(warranty.endDate).to.equal(warranty.startDate.add(31536000));
		expect(warranty.isActive).equals(true);
	});

	it("should revert when non-minter tries to issue a warranty", async function () {
		const { warrantyManager, user } = await deployWarrantyManager();
		await expect(
			warrantyManager.connect(user).issueWarranty(1, 31536000, "Warranty1", "Description1", "image1.png"),
		).to.be.rejectedWith("Not a minter");
	});

	it("should extend multiple warranties", async function () {
		const { warrantyManager, minter } = await deployWarrantyManager();

		// Issue warranties for tokens 1 and 2
		await warrantyManager.connect(minter).issueWarranty(1, 31536000, "Warranty1", "Description1", "image1.png");
		await warrantyManager.connect(minter).issueWarranty(2, 31536000, "Warranty2", "Description2", "image2.png");

		// Extend warranties
		const durations = [31536000, 31536000]; // Extend each by 1 year
		await warrantyManager.connect(minter).extendWarrantiesBatch([1, 2], durations);

		const warranty1 = await warrantyManager.getWarrantyEndDate(1);
		const warranty2 = await warrantyManager.getWarrantyEndDate(2);

		expect(warranty1).to.be.gt(31536000); // Extended by 1 year
		expect(warranty2).to.be.gt(31536000); // Extended by 1 year
	});

	it("should revert extension if array lengths mismatch", async function () {
		const { warrantyManager, minter } = await deployWarrantyManager();
		await expect(warrantyManager.connect(minter).extendWarrantiesBatch([1, 2], [31536000])).to.be.rejectedWith(
			"Mismatched arrays",
		);
	});

	it("should pause and unpause contract by admin", async function () {
		const { warrantyManager, admin, minter } = await deployWarrantyManager();

		await warrantyManager.connect(admin).pause();
		expect(await warrantyManager.paused()).equals(true);

		await expect(
			warrantyManager.connect(minter).issueWarranty(3, 31536000, "Warranty3", "Description3", "image3.png"),
		).to.be.rejectedWith("Pausable: paused");

		await warrantyManager.connect(admin).unpause();
		expect(await warrantyManager.paused()).equals(false);
	});

	it("should revert when non-admin tries to pause/unpause", async function () {
		const { warrantyManager, user } = await deployWarrantyManager();

		await expect(warrantyManager.connect(user).pause()).to.be.rejectedWith("Not an admin");
		await warrantyManager.pause();

		await expect(warrantyManager.connect(user).unpause()).to.be.rejectedWith("Not an admin");
	});

	it("should revert when issuing warranty on existing warranty", async function () {
		const { warrantyManager, minter } = await deployWarrantyManager();
		await warrantyManager.connect(minter).issueWarranty(1, 31536000, "Warranty1", "Description1", "image1.png");

		await expect(
			warrantyManager.connect(minter).issueWarranty(1, 31536000, "Warranty2", "Description2", "image2.png"),
		).to.be.rejectedWith("Warranty already issued");
	});

	it("should allow rollback of logic contract by admin", async function () {
		const { warrantyManager, admin } = await deployWarrantyManager();

		// Valid address for the new logic contract
		const newLogicAddress = ethers.Wallet.createRandom().address;
		await expect(warrantyManager.connect(admin).rollbackLogicContract(newLogicAddress)).to.be.fulfilled;
	});

	it("should revert rollback by non-admin or invalid address", async function () {
		const { warrantyManager, user, admin } = await deployWarrantyManager();

		// Revert if non-admin tries
		await expect(
			warrantyManager.connect(user).rollbackLogicContract(ethers.Wallet.createRandom().address),
		).to.be.rejectedWith("Not an admin");

		// Revert if address is invalid
		await expect(warrantyManager.connect(admin).rollbackLogicContract(ethers.constants.AddressZero)).to.be.rejectedWith(
			"Invalid address",
		);
	});

	it("should retrieve warranty details correctly", async function () {
		const { warrantyManager, minter } = await deployWarrantyManager();
		await warrantyManager.connect(minter).issueWarranty(1, 31536000, "Warranty1", "Description1", "image1.png");

		const startDate = await warrantyManager.getWarrantyStartDate(1);
		const endDate = await warrantyManager.getWarrantyEndDate(1);
		const isActive = await warrantyManager.isWarrantyActive(1);

		expect(startDate).to.be.gt(0);
		expect(endDate).to.be.equal(startDate.add(31536000));
		expect(isActive).equals(true);
	});
});
