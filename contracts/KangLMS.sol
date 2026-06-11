// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * KangLMS — "Last Man Standing" betting game with an ERC-20 token (KANG).
 *
 * Players bet KANG. Each bet splits into burn / treasury / prize pool and
 * extends the round timer. When the timer expires, the LAST bettor wins the
 * prize pool. Design distilled from the audited XphereLMS reference
 * (github.com/hyunilhlee/xphere-lms) with its security-review fixes kept:
 *
 *   • Pull-payment prizes (F3): settle() CREDITS the winner; tokens leave only
 *     via claim(). A failed transfer can never block round progression.
 *   • Sole-bettor refund through the same path (F2): a round that expires with
 *     fewer than 2 unique players refunds its only bettor — never stranded.
 *   • Owner withdrawals can never touch liabilities (F2): outstanding credits
 *     plus the live prize pool are always fully backed.
 *   • Lazy round start: a round's clock starts at its FIRST bet, not before.
 *   • Reentrancy-guarded, effects-before-interaction throughout.
 *
 * Simplifications vs the reference (deliberate, for this game's scale):
 * no price oracle / USD-anchored minBet, no bet tiers — flat owner-set
 * minBet and timer config instead.
 *
 * Timer model (mirrors the site's demo game): the first bet starts the clock
 * at `startDuration`; every later bet ADDS `betExtension`, capped so the
 * remaining time never exceeds `maxRemaining`.
 *
 * Self-contained (no imports) so it compiles in Remix or with plain solc.
 */
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract KangLMS {
    address public owner;
    IERC20 public immutable token;

    /// Fee destinations — fixed at deploy (anti-rug: not owner-modifiable).
    address public immutable treasury;
    address public immutable burnWallet;

    // ---------- Config (owner-tunable, bounded) ----------

    uint16 public burnBps = 500; // 5%
    uint16 public treasuryBps = 1500; // 15% — prize gets the remainder (80%)
    uint256 public minBet = 1e18; // 1 KANG
    uint64 public startDuration = 180; // first bet starts a 3m clock
    uint64 public betExtension = 60; // each bet adds 60s…
    uint64 public maxRemaining = 300; // …capped at 5m remaining
    bool public paused;

    // ---------- State ----------

    struct Round {
        uint256 prizePool;
        uint256 totalBurned;
        uint64 deadline; // 0 = not started (waiting for first bet)
        address lastBettor;
        uint32 betCount;
        uint32 uniquePlayers;
        bool settled;
    }

    uint256 public currentRoundId; // starts at 0; settle() rolls it forward
    uint256 public totalEverBurned;
    mapping(uint256 => Round) public rounds;
    mapping(uint256 => mapping(address => bool)) public hasParticipated;

    /// Prize/refund owed per address — withdraw via claim() (pull-payment).
    mapping(address => uint256) public pendingPrize;
    uint256 public totalPendingPrize;

    bool private _locked;

    // ---------- Events ----------

    event BetPlaced(
        uint256 indexed roundId,
        address indexed bettor,
        uint256 amount,
        uint256 prizePool,
        uint64 newDeadline
    );
    event RoundSettled(uint256 indexed id, address indexed winner, uint256 prize);
    event PrizeCredited(
        uint256 indexed roundId,
        address indexed recipient,
        uint256 amount,
        bool isRefund
    );
    event PrizeClaimed(address indexed recipient, uint256 amount);
    event ConfigUpdated(string param);
    event PausedSet(bool isPaused);
    event TokenWithdrawn(address indexed to, uint256 amount);
    event OwnerTransferred(address indexed from, address indexed to);

    constructor(address _token, address _treasury, address _burnWallet) {
        require(_token != address(0), "token=0");
        require(_treasury != address(0), "treasury=0");
        require(_burnWallet != address(0), "burn=0");
        owner = msg.sender;
        token = IERC20(_token);
        treasury = _treasury;
        burnWallet = _burnWallet;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier nonReentrant() {
        require(!_locked, "reentrancy");
        _locked = true;
        _;
        _locked = false;
    }

    // ---------- Game ----------

    /**
     * Settle the current round if its deadline has passed: credit the pot
     * (winner, or refund a sole bettor) and roll to the next round. Runs
     * automatically inside bet() and claim(), so the game flows from round
     * to round without anyone sending an explicit settle tx. Makes no
     * external calls — safe inside the nonReentrant entry points.
     */
    function _settleExpired() internal returns (bool) {
        Round storage r = rounds[currentRoundId];
        if (r.deadline == 0 || block.timestamp <= r.deadline || r.settled) {
            return false;
        }

        r.settled = true;
        address recipient = r.lastBettor;
        uint256 amount = r.prizePool;
        r.prizePool = 0;
        bool hasWinner = r.uniquePlayers >= 2 && recipient != address(0);

        if (recipient != address(0) && amount > 0) {
            pendingPrize[recipient] += amount;
            totalPendingPrize += amount;
            emit PrizeCredited(currentRoundId, recipient, amount, !hasWinner);
        }
        emit RoundSettled(
            currentRoundId,
            hasWinner ? recipient : address(0),
            hasWinner ? amount : 0
        );

        currentRoundId++;
        return true;
    }

    /**
     * Place a bet in the current round. Caller must have approved this
     * contract for at least `amount`. The first bet of a round starts its
     * clock; later bets extend it (capped at maxRemaining). If the previous
     * round expired, it is settled HERE — this bet opens the next round.
     */
    function bet(uint256 amount) external nonReentrant {
        require(!paused, "paused");
        _settleExpired();
        Round storage r = rounds[currentRoundId];
        require(!r.settled, "settled");
        require(amount >= minBet, "below minBet");

        require(
            token.transferFrom(msg.sender, address(this), amount),
            "transfer failed"
        );

        uint256 burnAmount = (amount * burnBps) / 10000;
        uint256 treasuryAmount = (amount * treasuryBps) / 10000;
        uint256 prizeAmount = amount - burnAmount - treasuryAmount;

        r.totalBurned += burnAmount;
        totalEverBurned += burnAmount;
        r.prizePool += prizeAmount;

        if (!hasParticipated[currentRoundId][msg.sender]) {
            hasParticipated[currentRoundId][msg.sender] = true;
            r.uniquePlayers++;
        }
        r.lastBettor = msg.sender;
        r.betCount++;

        if (r.deadline == 0) {
            r.deadline = uint64(block.timestamp) + startDuration;
        } else {
            uint256 remaining = r.deadline - block.timestamp + betExtension;
            if (remaining > maxRemaining) remaining = maxRemaining;
            r.deadline = uint64(block.timestamp + remaining);
        }

        require(token.transfer(burnWallet, burnAmount), "burn failed");
        require(token.transfer(treasury, treasuryAmount), "treasury failed");

        emit BetPlaced(currentRoundId, msg.sender, amount, r.prizePool, r.deadline);
    }

    /**
     * Manually settle the current round after its deadline — anyone may
     * call. Usually unnecessary: bet() and claim() settle automatically.
     */
    function settle(uint256 roundId) external nonReentrant {
        require(roundId == currentRoundId, "not current round");
        require(_settleExpired(), "not expired");
    }

    /**
     * Withdraw everything credited to the caller. If the current round just
     * expired, it is settled first — so the winner claims their fresh pot in
     * ONE tx (and the next round opens). Deliberately NOT gated by `paused`
     * — a winner can always claim. Balance-capped: any shortfall stays
     * claimable later instead of reverting.
     */
    function claim() external nonReentrant {
        _settleExpired();
        uint256 owed = pendingPrize[msg.sender];
        require(owed > 0, "nothing to claim");

        uint256 available = token.balanceOf(address(this));
        uint256 pay = owed > available ? available : owed;
        require(pay > 0, "no contract balance");

        pendingPrize[msg.sender] = owed - pay;
        totalPendingPrize -= pay;
        require(token.transfer(msg.sender, pay), "transfer failed");
        emit PrizeClaimed(msg.sender, pay);
    }

    // ---------- Owner ----------

    /// Fee split in bps; prize gets the remainder. Bounded like the reference
    /// so the owner can never starve the prize pool.
    function setFeeSplit(uint16 _burnBps, uint16 _treasuryBps) external onlyOwner {
        require(_burnBps <= 2000, "burn > 20%");
        require(_treasuryBps <= 2000, "treasury > 20%");
        burnBps = _burnBps;
        treasuryBps = _treasuryBps;
        emit ConfigUpdated("feeSplit");
    }

    function setMinBet(uint256 _minBet) external onlyOwner {
        require(_minBet > 0, "minBet=0");
        minBet = _minBet;
        emit ConfigUpdated("minBet");
    }

    function setTimer(
        uint64 _startDuration,
        uint64 _betExtension,
        uint64 _maxRemaining
    ) external onlyOwner {
        require(_startDuration >= 30 && _betExtension >= 5, "too short");
        require(_maxRemaining >= _startDuration, "cap < start");
        startDuration = _startDuration;
        betExtension = _betExtension;
        maxRemaining = _maxRemaining;
        emit ConfigUpdated("timer");
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit PausedSet(_paused);
    }

    /**
     * Withdraw EXCESS tokens only (sent here by mistake / dust). Must be
     * paused, and can never reduce the balance below liabilities =
     * outstanding credits + the live round's prize pool.
     */
    function withdrawToken(uint256 amount) external onlyOwner {
        require(paused, "must be paused");
        require(amount > 0, "amount=0");
        uint256 bal = token.balanceOf(address(this));
        uint256 liabilities = totalPendingPrize + rounds[currentRoundId].prizePool;
        require(bal >= liabilities, "liabilities exceed balance");
        require(amount <= bal - liabilities, "would touch liabilities");
        require(token.transfer(owner, amount), "transfer failed");
        emit TokenWithdrawn(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "owner=0");
        emit OwnerTransferred(owner, newOwner);
        owner = newOwner;
    }

    // ---------- Views ----------

    /// Full info for the live round (id + struct fields in one call).
    function currentRound()
        external
        view
        returns (
            uint256 id,
            uint256 prizePool,
            uint256 totalBurned,
            uint64 deadline,
            address lastBettor,
            uint32 betCount,
            uint32 uniquePlayers,
            bool settled
        )
    {
        Round storage r = rounds[currentRoundId];
        return (
            currentRoundId,
            r.prizePool,
            r.totalBurned,
            r.deadline,
            r.lastBettor,
            r.betCount,
            r.uniquePlayers,
            r.settled
        );
    }
}
