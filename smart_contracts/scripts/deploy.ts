const { ethers, upgrades } = require("hardhat");

async function main() {
	// Recupera i signers
	const [admin, minter] = await ethers.getSigners();

	// Recupera i contratti da deployare
	const WarrantyManager = await ethers.getContractFactory("WarrantyManagerV1");
	const WarrantyNFT = await ethers.getContractFactory("WarrantyNFT");

	console.log("Deploying WarrantyNFT...");

	// Deploy del contratto WarrantyNFT
	const warrantyNFT = await WarrantyNFT.deploy();
	await warrantyNFT.deployed();

	console.log("WarrantyNFT deployed to:", warrantyNFT.address);

	console.log("Deploying WarrantyManagerV1...");

	// Deploy del contratto WarrantyManagerV1 con l'indirizzo del contratto WarrantyNFT
	const warrantyManager = await upgrades.deployProxy(
		WarrantyManager,
		[admin.address, minter.address, warrantyNFT.address],
		{
			initializer: "initialize", // Funzione di inizializzazione
		},
	);

	console.log("WarrantyManagerV1 deployed to:", warrantyManager.address);

	// Verifica che il contratto sia stato correttamente deployato
	await warrantyManager.deployed();

	// Eventuali altre azioni da eseguire dopo il deploy, come assegnare ruoli
	console.log("Assigning roles...");
	await warrantyManager.grantRole(await warrantyManager.ADMIN_ROLE(), admin.address);
	await warrantyManager.grantRole(await warrantyManager.MINTER_ROLE(), minter.address);

	console.log("Roles assigned successfully.");
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error);
		process.exit(1);
	});
