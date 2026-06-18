// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

contract SettlementEscrow {
    enum EscrowStatus {
        Created,
        Released,
        Refunded
    }

    struct Escrow {
        address requester;
        address provider;
        address token;
        uint256 amount;
        bytes32 proofHash;
        uint64 expiresAt;
        EscrowStatus status;
    }

    uint256 public nextEscrowId = 1;
    mapping(uint256 escrowId => Escrow escrow) public escrows;

    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed requester,
        address indexed provider,
        address token,
        uint256 amount,
        bytes32 proofHash,
        uint64 expiresAt
    );
    event EscrowReleased(
        uint256 indexed escrowId,
        address indexed requester,
        address indexed provider,
        bytes32 proofHash,
        uint256 amount
    );
    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed requester,
        address indexed provider,
        uint256 amount
    );

    error InvalidProvider();
    error SameRequesterAndProvider();
    error InvalidToken();
    error InvalidAmount();
    error InvalidExpiry();
    error EscrowNotFound();
    error EscrowClosed();
    error NotRequester();
    error NotExpired();
    error ProofMismatch();
    error TransferFailed();

    function createEscrow(
        address provider,
        address token,
        uint256 amount,
        bytes32 proofHash,
        uint64 expiresAt
    ) external returns (uint256 escrowId) {
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert SameRequesterAndProvider();
        if (token == address(0)) revert InvalidToken();
        if (amount == 0) revert InvalidAmount();
        if (expiresAt <= block.timestamp) revert InvalidExpiry();

        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            requester: msg.sender,
            provider: provider,
            token: token,
            amount: amount,
            proofHash: proofHash,
            expiresAt: expiresAt,
            status: EscrowStatus.Created
        });

        if (!IERC20(token).transferFrom(msg.sender, address(this), amount)) {
            revert TransferFailed();
        }

        emit EscrowCreated(escrowId, msg.sender, provider, token, amount, proofHash, expiresAt);
    }

    function releaseAfterProof(uint256 escrowId, bytes32 proofHash) external {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.requester == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Created) revert EscrowClosed();
        if (msg.sender != escrow.requester) revert NotRequester();
        if (proofHash != escrow.proofHash) revert ProofMismatch();

        escrow.status = EscrowStatus.Released;

        if (!IERC20(escrow.token).transfer(escrow.provider, escrow.amount)) {
            revert TransferFailed();
        }

        emit EscrowReleased(
            escrowId,
            escrow.requester,
            escrow.provider,
            proofHash,
            escrow.amount
        );
    }

    function refundAfterExpiry(uint256 escrowId) external {
        Escrow storage escrow = escrows[escrowId];
        if (escrow.requester == address(0)) revert EscrowNotFound();
        if (escrow.status != EscrowStatus.Created) revert EscrowClosed();
        if (msg.sender != escrow.requester) revert NotRequester();
        if (block.timestamp < escrow.expiresAt) revert NotExpired();

        escrow.status = EscrowStatus.Refunded;

        if (!IERC20(escrow.token).transfer(escrow.requester, escrow.amount)) {
            revert TransferFailed();
        }

        emit EscrowRefunded(escrowId, escrow.requester, escrow.provider, escrow.amount);
    }
}
