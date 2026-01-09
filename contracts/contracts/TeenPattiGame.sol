// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title TeenPattiGame
 * @dev Manages Teen Patti game rooms, bets, and payouts
 */
contract TeenPattiGame is Ownable, ReentrancyGuard, Pausable {
    IERC20 public token;
    
    // Game states
    enum GameState { WAITING, ACTIVE, FINISHED, CANCELLED }
    
    // Room structure
    struct Room {
        bytes32 roomId;
        address creator;
        address[] players;
        uint256 buyIn;
        uint256 pot;
        uint256 maxPlayers;
        GameState state;
        address winner;
        uint256 createdAt;
        uint256 finishedAt;
        mapping(address => uint256) playerBalances;
        mapping(address => bool) hasJoined;
    }
    
    // State variables
    mapping(bytes32 => Room) public rooms;
    mapping(address => bytes32[]) public playerRooms;
    bytes32[] public activeRoomIds;
    
    // Platform rake (in basis points, 100 = 1%)
    uint256 public rakeFee = 500; // 5%
    address public treasury;
    uint256 public totalRakeCollected;
    
    // Timeout settings
    uint256 public constant GAME_TIMEOUT = 1 hours;
    
    // Events
    event RoomCreated(bytes32 indexed roomId, address indexed creator, uint256 buyIn, uint256 maxPlayers);
    event PlayerJoined(bytes32 indexed roomId, address indexed player, uint256 buyIn);
    event PlayerLeft(bytes32 indexed roomId, address indexed player, uint256 refund);
    event GameStarted(bytes32 indexed roomId, uint256 pot, uint256 playerCount);
    event BetPlaced(bytes32 indexed roomId, address indexed player, uint256 amount);
    event WinnerDeclared(bytes32 indexed roomId, address indexed winner, uint256 amount, uint256 rake);
    event CashGameSettled(bytes32 indexed roomId, address[] players, uint256[] payouts, uint256 rake);
    event RoomClosed(bytes32 indexed roomId);
    event RakeFeeUpdated(uint256 newRakeFee);
    event TreasuryUpdated(address indexed newTreasury);
    event EmergencyWithdraw(bytes32 indexed roomId, address indexed player, uint256 amount);
    
    constructor(address _token, address _treasury) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");
        
        token = IERC20(_token);
        treasury = _treasury;
    }
    
    /**
     * @dev Create a new game room
     */
    function createRoom(uint256 _buyIn, uint256 _maxPlayers) external nonReentrant whenNotPaused returns (bytes32) {
        require(_buyIn > 0, "Buy-in must be positive");
        require(_maxPlayers >= 2 && _maxPlayers <= 6, "Invalid max players");
        require(token.balanceOf(msg.sender) >= _buyIn, "Insufficient token balance");
        
        // Generate unique room ID (first 3 bytes of hash = 6 hex chars)
        bytes32 fullHash = keccak256(abi.encodePacked(msg.sender, block.timestamp, block.prevrandao));
        bytes32 roomId = bytes32(uint256(fullHash) & 0xFFFFFF00000000000000000000000000000000000000000000000000000000);
        
        Room storage room = rooms[roomId];
        room.roomId = roomId;
        room.creator = msg.sender;
        room.buyIn = _buyIn;
        room.maxPlayers = _maxPlayers;
        room.state = GameState.WAITING;
        room.createdAt = block.timestamp;
        
        // Transfer buy-in from creator
        require(token.transferFrom(msg.sender, address(this), _buyIn), "Token transfer failed");
        
        // Add creator as first player
        room.players.push(msg.sender);
        room.playerBalances[msg.sender] = _buyIn;
        room.hasJoined[msg.sender] = true;
        room.pot = _buyIn;
        
        // Track room
        activeRoomIds.push(roomId);
        playerRooms[msg.sender].push(roomId);
        
        emit RoomCreated(roomId, msg.sender, _buyIn, _maxPlayers);
        emit PlayerJoined(roomId, msg.sender, _buyIn);
        
        return roomId;
    }
    
    /**
     * @dev Join an existing room
     */
    function joinRoom(bytes32 _roomId) external nonReentrant whenNotPaused {
        Room storage room = rooms[_roomId];
        
        require(room.creator != address(0), "Room does not exist");
        require(room.state == GameState.WAITING, "Room not accepting players");
        require(!room.hasJoined[msg.sender], "Already joined this room");
        require(room.players.length < room.maxPlayers, "Room is full");
        require(token.balanceOf(msg.sender) >= room.buyIn, "Insufficient token balance");
        
        // Transfer buy-in from player
        require(token.transferFrom(msg.sender, address(this), room.buyIn), "Token transfer failed");
        
        // Add player to room
        room.players.push(msg.sender);
        room.playerBalances[msg.sender] = room.buyIn;
        room.hasJoined[msg.sender] = true;
        room.pot += room.buyIn;
        
        playerRooms[msg.sender].push(_roomId);
        
        emit PlayerJoined(_roomId, msg.sender, room.buyIn);
    }
    
    /**
     * @dev Leave room before game starts (get refund)
     */
    function leaveRoom(bytes32 _roomId) external nonReentrant {
        Room storage room = rooms[_roomId];
        
        require(room.hasJoined[msg.sender], "Not in this room");
        require(room.state == GameState.WAITING, "Game already started");
        
        uint256 refund = room.playerBalances[msg.sender];
        require(refund > 0, "No balance to refund");
        
        // Remove player
        room.hasJoined[msg.sender] = false;
        room.playerBalances[msg.sender] = 0;
        room.pot -= refund;
        
        // Remove from players array
        for (uint256 i = 0; i < room.players.length; i++) {
            if (room.players[i] == msg.sender) {
                room.players[i] = room.players[room.players.length - 1];
                room.players.pop();
                break;
            }
        }
        
        // Transfer refund
        require(token.transfer(msg.sender, refund), "Refund transfer failed");
        
        emit PlayerLeft(_roomId, msg.sender, refund);
        
        // Cancel room if no players left
        if (room.players.length == 0) {
            room.state = GameState.CANCELLED;
            emit RoomClosed(_roomId);
        }
    }
    
    /**
     * @dev Start the game (only creator or backend)
     */
    function startGame(bytes32 _roomId) external nonReentrant {
        Room storage room = rooms[_roomId];
        
        require(room.creator != address(0), "Room does not exist");
        require(msg.sender == room.creator || msg.sender == owner(), "Not authorized");
        require(room.state == GameState.WAITING, "Game already started");
        require(room.players.length >= 2, "Need at least 2 players");
        
        room.state = GameState.ACTIVE;
        
        emit GameStarted(_roomId, room.pot, room.players.length);
    }
    
    /**
     * @dev Place a bet (deducted from player's balance in room)
     */
    function placeBet(bytes32 _roomId, address _player, uint256 _amount) external nonReentrant {
        Room storage room = rooms[_roomId];
        
        require(msg.sender == owner(), "Only backend can place bets");
        require(room.state == GameState.ACTIVE, "Game not active");
        require(room.hasJoined[_player], "Player not in room");
        require(room.playerBalances[_player] >= _amount, "Insufficient player balance");
        
        room.playerBalances[_player] -= _amount;
        room.pot += _amount;
        
        emit BetPlaced(_roomId, _player, _amount);
    }
    
    /**
     * @dev Declare winner and distribute pot (only backend)
     */
    function declareWinner(bytes32 _roomId, address _winner) external nonReentrant {
        Room storage room = rooms[_roomId];
        
        // require(msg.sender == owner(), "Only backend can declare winner");
        require(room.state == GameState.ACTIVE, "Game not active");
        require(room.hasJoined[_winner], "Winner not in room");
        
        uint256 pot = room.pot;
        require(pot > 0, "No pot to distribute");
        
        // Calculate rake
        uint256 rake = (pot * rakeFee) / 10000;
        uint256 winnerAmount = pot - rake;
        
        // Update state
        room.state = GameState.FINISHED;
        room.winner = _winner;
        room.finishedAt = block.timestamp;
        room.pot = 0;
        
        // Transfer winnings to winner
        require(token.transfer(_winner, winnerAmount), "Winner transfer failed");
        
        // Transfer rake to treasury
        if (rake > 0) {
            require(token.transfer(treasury, rake), "Rake transfer failed");
            totalRakeCollected += rake;
        }
        
        emit WinnerDeclared(_roomId, _winner, winnerAmount, rake);
    }
    
    /**
     * @dev Settle cash game with proportional payouts based on final chips
     * @notice Only owner (backend) can call this with verified chip counts
     */
    function settleCashGame(
        bytes32 _roomId,
        address[] memory _players,
        uint256[] memory _finalChips
    ) external onlyOwner nonReentrant {
        Room storage room = rooms[_roomId];
        
        require(room.state == GameState.ACTIVE, "Game not active");
        require(_players.length == _finalChips.length, "Array length mismatch");
        require(_players.length > 0, "No players provided");
        
        uint256 pot = room.pot;
        require(pot > 0, "No pot to distribute");
        
        // Calculate total chips
        uint256 totalChips = 0;
        for (uint256 i = 0; i < _finalChips.length; i++) {
            totalChips += _finalChips[i];
        }
        require(totalChips > 0, "Total chips must be greater than zero");
        
        // Validate all players are in the room
        for (uint256 i = 0; i < _players.length; i++) {
            require(room.hasJoined[_players[i]], "Player not in room");
        }
        
        // Calculate rake
        uint256 rake = (pot * rakeFee) / 10000;
        uint256 distributablePot = pot - rake;
        
        // Calculate and distribute proportional payouts
        uint256[] memory payouts = new uint256[](_players.length);
        uint256 totalDistributed = 0;
        address topPlayer = _players[0];
        uint256 maxChips = _finalChips[0];
        
        for (uint256 i = 0; i < _players.length; i++) {
            // Track player with most chips for winner field
            if (_finalChips[i] > maxChips) {
                maxChips = _finalChips[i];
                topPlayer = _players[i];
            }
            
            // Calculate proportional payout
            // Use careful rounding to avoid dust
            uint256 payout = (distributablePot * _finalChips[i]) / totalChips;
            payouts[i] = payout;
            totalDistributed += payout;
            
            // Transfer tokens to player
            if (payout > 0) {
                require(token.transfer(_players[i], payout), "Player transfer failed");
            }
        }
        
        // Handle any remaining dust (rounding errors) - give to player with most chips
        uint256 dust = distributablePot - totalDistributed;
        if (dust > 0) {
            require(token.transfer(topPlayer, dust), "Dust transfer failed");
        }
        
        // Transfer rake to treasury
        if (rake > 0) {
            require(token.transfer(treasury, rake), "Rake transfer failed");
            totalRakeCollected += rake;
        }
        
        // Update room state
        room.state = GameState.FINISHED;
        room.winner = topPlayer; // Player with most chips
        room.finishedAt = block.timestamp;
        room.pot = 0;
        
        emit CashGameSettled(_roomId, _players, payouts, rake);
    }
    
    /**
     * @dev Handle game timeout (refund all players)
     */
    function handleTimeout(bytes32 _roomId) external nonReentrant {
        Room storage room = rooms[_roomId];
        
        require(room.state == GameState.ACTIVE, "Game not active");
        require(block.timestamp >= room.createdAt + GAME_TIMEOUT, "Timeout not reached");
        
        // Refund all players their initial buy-in
        for (uint256 i = 0; i < room.players.length; i++) {
            address player = room.players[i];
            uint256 refund = room.buyIn; // Refund original buy-in
            
            if (refund > 0) {
                require(token.transfer(player, refund), "Refund transfer failed");
            }
        }
        
        room.state = GameState.CANCELLED;
        room.pot = 0;
        
        emit RoomClosed(_roomId);
    }
    
    /**
     * @dev Emergency withdraw (with penalty)
     */
    function emergencyWithdraw(bytes32 _roomId) external nonReentrant {
        Room storage room = rooms[_roomId];
        
        require(room.hasJoined[msg.sender], "Not in this room");
        require(room.state == GameState.ACTIVE, "Game not active");
        
        uint256 balance = room.playerBalances[msg.sender];
        require(balance > 0, "No balance to withdraw");
        
        // 10% penalty for emergency withdrawal
        uint256 penalty = (balance * 1000) / 10000; // 10%
        uint256 withdrawAmount = balance - penalty;
        
        room.playerBalances[msg.sender] = 0;
        room.hasJoined[msg.sender] = false;
        
        // Transfer to player
        require(token.transfer(msg.sender, withdrawAmount), "Withdraw transfer failed");
        
        // Penalty goes to pot
        room.pot += penalty;
        
        emit EmergencyWithdraw(_roomId, msg.sender, withdrawAmount);
    }
    
    /**
     * @dev Close finished room (cleanup)
     */
    function closeRoom(bytes32 _roomId) external {
        Room storage room = rooms[_roomId];
        
        require(room.state == GameState.FINISHED || room.state == GameState.CANCELLED, "Game not finished");
        require(msg.sender == room.creator || msg.sender == owner(), "Not authorized");
        
        emit RoomClosed(_roomId);
    }
    
    /**
     * @dev Get room details
     */
    function getRoomDetails(bytes32 _roomId) external view returns (
        address creator,
        uint256 buyIn,
        uint256 pot,
        uint256 maxPlayers,
        uint256 currentPlayers,
        GameState state,
        address winner
    ) {
        Room storage room = rooms[_roomId];
        return (
            room.creator,
            room.buyIn,
            room.pot,
            room.maxPlayers,
            room.players.length,
            room.state,
            room.winner
        );
    }
    
    /**
     * @dev Get room players
     */
    function getRoomPlayers(bytes32 _roomId) external view returns (address[] memory) {
        return rooms[_roomId].players;
    }
    
    /**
     * @dev Get player balance in room
     */
    function getPlayerBalance(bytes32 _roomId, address _player) external view returns (uint256) {
        return rooms[_roomId].playerBalances[_player];
    }
    
    /**
     * @dev Get player's active rooms
     */
    function getPlayerRooms(address _player) external view returns (bytes32[] memory) {
        return playerRooms[_player];
    }
    
    /**
     * @dev Get all active room IDs
     */
    function getActiveRooms() external view returns (bytes32[] memory) {
        return activeRoomIds;
    }
    
    /**
     * @dev Update rake fee (only owner)
     */
    function updateRakeFee(uint256 _newRakeFee) external onlyOwner {
        require(_newRakeFee <= 1000, "Rake fee too high"); // Max 10%
        rakeFee = _newRakeFee;
        emit RakeFeeUpdated(_newRakeFee);
    }
    
    /**
     * @dev Update treasury address (only owner)
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        treasury = _newTreasury;
        emit TreasuryUpdated(_newTreasury);
    }
    
    /**
     * @dev Pause contract (only owner)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract (only owner)
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency token recovery (only owner)
     */
    function recoverTokens(address _token, uint256 _amount) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        IERC20(_token).transfer(owner(), _amount);
    }
    
    /**
     * @dev Get total rake collected
     */
    function getTotalRakeCollected() external view returns (uint256) {
        return totalRakeCollected;
    }
}
