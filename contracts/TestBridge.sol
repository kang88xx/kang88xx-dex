// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * TestBridge — minimal lock/release token bridge for TESTNETS only.
 *
 * One instance is deployed per chain (BSC testnet + opBNB testnet), each
 * holding a reserve of the bridged token (our TestToken USDT). Flow:
 *
 *   1. User calls bridgeOut(amount, dstChainId) on the SOURCE chain.
 *      Tokens move user → this contract (lock) and BridgeOut is emitted.
 *   2. The app's relayer (a Next.js API route holding the relayer key)
 *      verifies that tx on the source chain, derives a unique transferId
 *      from (srcChainId, txHash, logIndex), and calls release() on the
 *      DESTINATION chain's bridge, which pays out from its reserve.
 *
 * Replay safety lives on-chain: release() marks transferId as processed,
 * so resubmitting the same source tx can never pay twice. The relayer
 * reads the payout amount from the verified BridgeOut event — never from
 * user input.
 *
 * Self-contained (no imports) so it compiles with the repo's solc script.
 * NOT for mainnet: the relayer is a trusted single key by design.
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TestBridge {
    address public owner;
    address public relayer;
    IERC20 public immutable token;

    /** Monotonic id per outgoing transfer — for explorers/debugging. */
    uint64 public outNonce;

    /** transferId → already released? (set once, never cleared) */
    mapping(bytes32 => bool) public processed;

    bool private locked; // reentrancy guard

    event BridgeOut(
        address indexed from,
        uint256 amount,
        uint64 indexed dstChainId,
        uint64 nonce
    );
    event BridgeIn(bytes32 indexed transferId, address indexed to, uint256 amount);
    event RelayerChanged(address indexed relayer);

    constructor(address _token, address _relayer) {
        require(_token != address(0), "token=0");
        require(_relayer != address(0), "relayer=0");
        owner = msg.sender;
        relayer = _relayer;
        token = IERC20(_token);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier nonReentrant() {
        require(!locked, "reentrancy");
        locked = true;
        _;
        locked = false;
    }

    /** Lock `amount` here; the relayer pays out on `dstChainId`. */
    function bridgeOut(uint256 amount, uint64 dstChainId) external nonReentrant {
        require(amount > 0, "amount=0");
        require(dstChainId != block.chainid, "dst=src");
        require(token.transferFrom(msg.sender, address(this), amount), "transfer failed");
        emit BridgeOut(msg.sender, amount, dstChainId, outNonce++);
    }

    /** Relayer-only: pay out a verified source-chain transfer from reserves. */
    function release(bytes32 transferId, address to, uint256 amount) external nonReentrant {
        require(msg.sender == relayer, "not relayer");
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        require(!processed[transferId], "processed");
        processed[transferId] = true;
        require(token.transfer(to, amount), "transfer failed");
        emit BridgeIn(transferId, to, amount);
    }

    /** Max amount this side can currently pay out. */
    function reserve() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function setRelayer(address _relayer) external onlyOwner {
        require(_relayer != address(0), "relayer=0");
        relayer = _relayer;
        emit RelayerChanged(_relayer);
    }

    /** Owner can withdraw reserves (top-up mistakes, rebalancing, sunset). */
    function withdraw(address to, uint256 amount) external onlyOwner {
        require(token.transfer(to, amount), "transfer failed");
    }
}
