// SPDX-License-Identifier: MIT
pragma solidity ^0.8.21;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

// @notice NFT di garanzia integrato con il contratto di gestione delle garanzie
contract WarrantyNFT is
    ERC721Upgradeable,
    AccessControlUpgradeable,
    PausableUpgradeable
{
    uint256 private _tokenCount;

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    event WarrantyIssued(
        uint256 indexed tokenId,
        uint64 issuedAt,
        uint64 expiryAt
    );

    // Funzione di inizializzazione (per contratti upgradeable)
    function initialize(address admin, address minter) public initializer {
        // Inizializza ERC721 con il nome e il simbolo del token
        __ERC721_init("WarrantyNFT", "WNFT");

        // Inizializza le funzionalità di AccessControl e Pausable
        __AccessControl_init();
        __Pausable_init();

        // Assegna i ruoli
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
    }

    function safeMint(
        address to,
        string calldata uri,
        uint64 duration
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        uint256 tokenId = _tokenCount + 1;
        _safeMint(to, tokenId);

        // Imposta l'URI per il token (potresti volerlo implementare con una mappa)
        _setTokenURI(tokenId, uri);

        _tokenCount++;

        emit WarrantyIssued(
            tokenId,
            uint64(block.timestamp),
            uint64(block.timestamp + duration)
        );
    }

    function multipleMint(
        address[] calldata to,
        string[] calldata uris,
        uint64[] calldata duration
    ) external onlyRole(MINTER_ROLE) whenNotPaused {
        require(
            to.length == uris.length && uris.length == duration.length,
            "Input array length mismatch"
        );

        for (uint256 i = 0; i < to.length; i++) {
            uint256 tokenId = _tokenCount + 1;
            _safeMint(to[i], tokenId);
            _setTokenURI(tokenId, uris[i]);

            _tokenCount++;

            emit WarrantyIssued(
                tokenId,
                uint64(block.timestamp),
                uint64(block.timestamp + duration[i])
            );
        }
    }

    function totalSupply() public view returns (uint256) {
        return _tokenCount;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    // Override supportsInterface per risolvere conflitto con AccessControl e ERC721
    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(ERC721Upgradeable, AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Meccanismo per gestire gli URI
    mapping(uint256 => string) private _tokenURIs;

    function _setTokenURI(uint256 tokenId, string memory uri) internal {
        _tokenURIs[tokenId] = uri;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }
}
