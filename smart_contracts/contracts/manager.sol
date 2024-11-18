// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./nft.sol";

interface IVersionable {
    function version() external view returns (string memory);
}

interface IWarrantyManager {
    function issueWarranty(uint256 tokenId, uint64 duration) external;
}

contract WarrantyManagerV1 is
    IVersionable,
    AccessControl,
    Pausable,
    ReentrancyGuard,
    Initializable
{
    TransparentUpgradeableProxy public proxy;

    string private constant _version = "1.0.0";

    IERC721 public nftContract;
    address public proxyAddress;

    // Definizione dei ruoli
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint64 public constant MAX_WARRANTY_DURATION = 10 * 365 * 24 * 60 * 60;

    struct Warranty {
        uint64 startDate; // Ottimizzato con uint64 per ridurre spazio di storage
        uint64 endDate; // Ottimizzato con uint64 per ridurre spazio di storage
        bool isActive; // Booleano per minimizzare spazio di storage
    }

    mapping(uint256 => Warranty) private warranties;
    mapping(address => uint256[]) private ownerToTokenIds;

    event WarrantyIssued(
        uint256 indexed tokenId,
        uint64 startDate,
        uint64 endDate
    );
    event WarrantyExtended(uint256 indexed tokenId, uint64 newEndDate);
    event WarrantyDisabled(uint256 indexed tokenId);
    event WarrantyTransferred(
        uint256 indexed tokenId,
        address indexed previousOwner,
        address indexed newOwner
    );

    function initialize(
        address admin,
        address minter,
        address nftAddress,
        address _proxyAddress
    ) public initializer {
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        nftContract = IERC721(nftAddress);

        // Assegna l'indirizzo del proxy direttamente
        proxy = TransparentUpgradeableProxy(payable(_proxyAddress));
    }

    function issueWarranty(
        uint256 tokenId,
        uint64 duration
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(warranties[tokenId].startDate == 0, "Warranty already issued");
        require(
            duration <= MAX_WARRANTY_DURATION,
            "Duration exceeds maximum limit"
        );

        uint64 startDate = uint64(block.timestamp);
        uint64 endDate = startDate + duration;

        warranties[tokenId] = Warranty({
            startDate: startDate,
            endDate: endDate,
            isActive: true
        });

        ownerToTokenIds[msg.sender].push(tokenId); // Traccia il token per l'owner

        emit WarrantyIssued(tokenId, startDate, endDate);
    }

    function warrantyExists(uint256 tokenId) public view returns (bool) {
        return warranties[tokenId].startDate != 0;
    }

    function extendWarranty(
        uint256 tokenId,
        uint64 additionalDays
    ) public onlyRole(MINTER_ROLE) {
        require(warrantyExists(tokenId), "Warranty does not exist");
        uint64 newEndDate = warranties[tokenId].endDate + additionalDays;
        require(
            newEndDate <= MAX_WARRANTY_DURATION,
            "Duration exceeds maximum limit"
        );
        warranties[tokenId].endDate = newEndDate;
        emit WarrantyExtended(tokenId, newEndDate);
    }

    function disableWarranty(uint256 tokenId) external onlyRole(ADMIN_ROLE) {
        require(warrantyExists(tokenId), "Warranty does not exist");
        warranties[tokenId].isActive = false;
        emit WarrantyDisabled(tokenId);
    }

    function disableWarrantiesBatch(
        uint256[] calldata tokenIds
    ) external onlyRole(ADMIN_ROLE) {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            require(warrantyExists(tokenIds[i]), "Warranty does not exist");
            warranties[tokenIds[i]].isActive = false;
            emit WarrantyDisabled(tokenIds[i]);
        }
    }

    function extendWarrantiesBatch(
        uint256[] calldata tokenIds,
        uint64[] calldata durations
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(tokenIds.length == durations.length, "Mismatched arrays");

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            uint64 newEndDate = warranties[tokenId].endDate + durations[i];
            warranties[tokenId].endDate = newEndDate;

            emit WarrantyExtended(tokenId, newEndDate);
        }
    }

    function isWarrantyExpired(uint256 tokenId) public view returns (bool) {
        require(warrantyExists(tokenId), "Warranty does not exist");
        return block.timestamp > warranties[tokenId].endDate;
    }

    function version() external pure override returns (string memory) {
        return _version;
    }

    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function getWarrantyStartDate(
        uint256 tokenId
    ) external view returns (uint64) {
        return warranties[tokenId].startDate;
    }

    function getWarrantyEndDate(
        uint256 tokenId
    ) external view returns (uint64) {
        return warranties[tokenId].endDate;
    }

    function isWarrantyActive(uint256 tokenId) external view returns (bool) {
        return warranties[tokenId].isActive;
    }

    function getWarrantyInfo(
        uint256 tokenId
    ) external view returns (uint64 startDate, uint64 endDate, bool isActive) {
        Warranty memory warranty = warranties[tokenId];
        return (warranty.startDate, warranty.endDate, warranty.isActive);
    }

    function getTokenIdsByOwner(
        address owner
    ) external view returns (uint256[] memory) {
        return ownerToTokenIds[owner];
    }

    function transferWarranty(uint256 tokenId, address newOwner) external {
        require(
            nftContract.ownerOf(tokenId) == msg.sender,
            "Caller is not the owner of the NFT"
        );
        require(warrantyExists(tokenId), "Warranty does not exist");

        address previousOwner = nftContract.ownerOf(tokenId);

        nftContract.safeTransferFrom(previousOwner, newOwner, tokenId);

        // Trasferisci il token alla nuova proprietà
        for (uint256 i = 0; i < ownerToTokenIds[msg.sender].length; i++) {
            if (ownerToTokenIds[msg.sender][i] == tokenId) {
                // Rimuovi il token dal vecchio proprietario
                ownerToTokenIds[msg.sender][i] = ownerToTokenIds[msg.sender][
                    ownerToTokenIds[msg.sender].length - 1
                ];
                ownerToTokenIds[msg.sender].pop();
                break;
            }
        }

        ownerToTokenIds[newOwner].push(tokenId);

        emit WarrantyTransferred(tokenId, previousOwner, newOwner);
    }

    function getLogicContractVersion(
        address logicAddress
    ) external view returns (string memory) {
        return IVersionable(logicAddress).version();
    }

    function auditLogicContract(
        address stableLogicAddress
    ) external view onlyRole(DEFAULT_ADMIN_ROLE) {
        require(stableLogicAddress != address(0), "Invalid contract address");

        // Verifica che la versione del contratto logico sia quella prevista
        string memory contractVersion = IVersionable(stableLogicAddress)
            .version();

        string memory minVersion = "1.0.1";
        string memory maxVersion = "2.0.0";

        // Verifica che la versione sia compresa tra 1.0.1 e 2.0.0
        require(
            compareVersions(contractVersion, minVersion) >= 0 &&
                compareVersions(contractVersion, maxVersion) <= 0,
            "Contract version must be between 1.0.1 and 2.0.0"
        );
    }

    function compareVersions(
        string memory version1,
        string memory version2
    ) internal pure returns (int) {
        bytes memory v1 = bytes(version1);
        bytes memory v2 = bytes(version2);

        uint256 i = 0;
        uint256 j = 0;

        while (i < v1.length || j < v2.length) {
            uint256 num1 = 0;
            uint256 num2 = 0;

            while (i < v1.length && v1[i] != ".") {
                num1 = num1 * 10 + (uint8(v1[i]) - 48);
                i++;
            }

            while (j < v2.length && v2[j] != ".") {
                num2 = num2 * 10 + (uint8(v2[j]) - 48);
                j++;
            }

            if (num1 < num2) return -1;
            if (num1 > num2) return 1;

            i++;
            j++;
        }

        return 0;
    }

    function upgradeTo(
        address stableLogicAddress
    ) external onlyRole(ADMIN_ROLE) whenNotPaused nonReentrant {
        require(stableLogicAddress != address(0), "Invalid address");
        this.auditLogicContract(stableLogicAddress);

        // Chiamata diretta al contratto TransparentUpgradeableProxy
        (bool success, ) = address(proxy).call(
            abi.encodeWithSignature("upgradeTo(address)", stableLogicAddress)
        );

        require(success, "Upgrade failed");
    }

    function rollbackLogicContract(
        address stableLogicAddress
    ) external onlyRole(ADMIN_ROLE) whenNotPaused nonReentrant {
        require(stableLogicAddress != address(0), "Invalid address");

        // Chiamata diretta al contratto TransparentUpgradeableProxy
        (bool success, ) = address(proxy).call(
            abi.encodeWithSignature("upgradeTo(address)", stableLogicAddress)
        );

        require(success, "Upgrade failed");
    }
}
