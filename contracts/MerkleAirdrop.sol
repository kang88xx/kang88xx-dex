// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * MerkleAirdrop — multi-campaign, per-wallet ERC-20 airdrop with Merkle proofs.
 *
 * Self-contained (no imports) so it compiles in Remix or with plain solc.
 *
 * Flow:
 *   1. Admin builds a whitelist of (address, amount) pairs off-chain and
 *      computes a Merkle root (see lib/merkle.ts — encoding MUST match below).
 *   2. Admin approves this contract for `amount` of the reward token, then
 *      calls createCampaign(token, root, amount, endsAt) which pulls the
 *      tokens in and registers the campaign.
 *   3. Each whitelisted user calls claim(id, amount, proof) once and receives
 *      their tokens. Double-claims are blocked on-chain.
 *   4. Admin can sweep() unclaimed tokens back out (e.g. after the campaign
 *      ends) and pause/unpause with setActive().
 *
 * Leaf encoding (double-hashed, OpenZeppelin StandardMerkleTree style — guards
 * against second-preimage attacks because leaf preimages are 32 bytes while
 * internal nodes hash 64 bytes):
 *
 *     leaf = keccak256(bytes.concat(keccak256(abi.encode(account, amount))))
 *
 * Internal nodes use sorted-pair hashing:
 *
 *     parent = keccak256(a <= b ? (a,b) : (b,a))
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract MerkleAirdrop {
    address public owner;

    struct Campaign {
        address token;      // reward ERC-20
        bytes32 merkleRoot; // root over (account, amount) leaves
        uint256 funded;     // total tokens deposited on creation
        uint256 claimed;    // total tokens claimed so far
        uint64 endsAt;      // unix seconds; 0 = no expiry
        bool active;        // owner can pause
    }

    uint256 public campaignCount;
    mapping(uint256 => Campaign) public campaigns;
    // campaignId => account => already claimed
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event CampaignCreated(
        uint256 indexed id,
        address indexed token,
        bytes32 merkleRoot,
        uint256 funded,
        uint64 endsAt
    );
    event Claimed(uint256 indexed id, address indexed account, uint256 amount);
    event Swept(uint256 indexed id, address indexed to, uint256 amount);
    event ActiveSet(uint256 indexed id, bool active);
    event OwnerTransferred(address indexed from, address indexed to);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    /**
     * Create + fund a campaign. The caller (owner) must have approved this
     * contract for at least `amount` of `token` beforehand.
     */
    function createCampaign(
        address token,
        bytes32 merkleRoot,
        uint256 amount,
        uint64 endsAt
    ) external onlyOwner returns (uint256 id) {
        require(token != address(0), "token=0");
        require(merkleRoot != bytes32(0), "root=0");
        require(amount > 0, "amount=0");

        id = ++campaignCount;
        campaigns[id] = Campaign({
            token: token,
            merkleRoot: merkleRoot,
            funded: amount,
            claimed: 0,
            endsAt: endsAt,
            active: true
        });

        require(
            IERC20(token).transferFrom(msg.sender, address(this), amount),
            "fund failed"
        );
        emit CampaignCreated(id, token, merkleRoot, amount, endsAt);
    }

    /** Claim your allocation for a campaign. Reverts if already claimed. */
    function claim(uint256 id, uint256 amount, bytes32[] calldata proof) external {
        Campaign storage c = campaigns[id];
        require(c.merkleRoot != bytes32(0), "no campaign");
        require(c.active, "inactive");
        require(c.endsAt == 0 || block.timestamp <= c.endsAt, "ended");
        require(!hasClaimed[id][msg.sender], "already claimed");

        bytes32 leaf = keccak256(
            bytes.concat(keccak256(abi.encode(msg.sender, amount)))
        );
        require(_verify(proof, c.merkleRoot, leaf), "bad proof");

        // Effects before interaction (reentrancy-safe).
        hasClaimed[id][msg.sender] = true;
        c.claimed += amount;

        require(IERC20(c.token).transfer(msg.sender, amount), "transfer failed");
        emit Claimed(id, msg.sender, amount);
    }

    /** Owner reclaims still-unclaimed tokens for a campaign. */
    function sweep(uint256 id, address to) external onlyOwner {
        require(to != address(0), "to=0");
        Campaign storage c = campaigns[id];
        uint256 left = c.funded - c.claimed;
        require(left > 0, "nothing to sweep");

        c.active = false;
        c.funded = c.claimed; // prevent re-sweep
        require(IERC20(c.token).transfer(to, left), "transfer failed");
        emit Swept(id, to, left);
    }

    function setActive(uint256 id, bool active_) external onlyOwner {
        require(campaigns[id].merkleRoot != bytes32(0), "no campaign");
        campaigns[id].active = active_;
        emit ActiveSet(id, active_);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    /** Tokens still claimable for a campaign. */
    function remaining(uint256 id) external view returns (uint256) {
        Campaign storage c = campaigns[id];
        return c.funded - c.claimed;
    }

    function _verify(
        bytes32[] calldata proof,
        bytes32 root,
        bytes32 leaf
    ) internal pure returns (bool) {
        bytes32 h = leaf;
        for (uint256 i = 0; i < proof.length; i++) {
            bytes32 p = proof[i];
            h = h <= p
                ? keccak256(abi.encodePacked(h, p))
                : keccak256(abi.encodePacked(p, h));
        }
        return h == root;
    }
}
