import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { Game, Player } from "./gameLogic.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ["http://localhost:5173", "https://3-patti-nu.vercel.app/"],
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

// Store active games
const games = new Map();

// Store player socket mappings
const playerSockets = new Map();

app.get("/health", (req, res) => {
  res.json({ status: "ok", activeGames: games.size });
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Create a new game room
  socket.on("createRoom", ({ playerName }) => {
    const roomId = uuidv4().substring(0, 6).toUpperCase();
    const playerId = uuidv4();

    const game = new Game(roomId);
    const player = new Player(playerId, playerName, socket.id);

    game.addPlayer(player);
    games.set(roomId, game);
    playerSockets.set(socket.id, { playerId, roomId });

    socket.join(roomId);

    socket.emit("roomCreated", {
      roomId,
      playerId,
      gameState: game.getGameState(),
    });

    console.log(`Room ${roomId} created by ${playerName}`);
  });

  // Create room with blockchain integration
  socket.on(
    "createRoomWithBlockchain",
    ({
      blockchainRoomId,
      buyIn,
      maxPlayers,
      creator,
      txHash,
      tokenBalance,
      buyInTokens,
    }) => {
      console.log("Creating blockchain room:", blockchainRoomId);

      // Use blockchain room ID as the game room ID
      const roomId = blockchainRoomId;
      const playerId = creator; // Use wallet address as player ID
      const playerName = creator.slice(0, 6); // Short address as name

      const game = new Game(roomId);
      game.blockchainRoomId = blockchainRoomId;
      game.buyIn = buyIn;
      game.maxPlayers = maxPlayers;
      game.txHash = txHash;
      // Persist numeric buy-in tokens to drive off-chain chip amounts
      const parsedBuyInTokens =
        typeof buyInTokens === "number" && isFinite(buyInTokens)
          ? buyInTokens
          : typeof buyIn === "string"
            ? parseFloat(buyIn)
            : 0;
      game.buyInTokens = parsedBuyInTokens > 0 ? parsedBuyInTokens : 0;

      // Start chips equal to room buy-in (tokens). Fallbacks avoid using wallet balance.
      const playerChips =
        game.buyInTokens > 0 ? Math.floor(game.buyInTokens) : 1000;
      const player = new Player(playerId, playerName, socket.id, playerChips);
      player.walletAddress = creator;

      game.addPlayer(player);
      games.set(roomId, game);
      playerSockets.set(socket.id, { playerId, roomId });

      socket.join(roomId);

      socket.emit("roomCreated", {
        roomId,
        playerId,
        gameState: game.getGameState(),
      });

      console.log(
        `Blockchain room ${roomId} created by ${creator} (tx: ${txHash})`
      );
    }
  );

  // Join an existing game room
  socket.on("joinRoom", ({ roomId, playerName }) => {
    const game = games.get(roomId);

    if (!game) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    if (game.players.length >= game.maxPlayers) {
      socket.emit("error", { message: "Room is full" });
      return;
    }

    if (game.gameStarted) {
      socket.emit("error", { message: "Game already in progress" });
      return;
    }

    const playerId = uuidv4();
    const player = new Player(playerId, playerName, socket.id);

    game.addPlayer(player);
    playerSockets.set(socket.id, { playerId, roomId });

    socket.join(roomId);

    socket.emit("roomJoined", {
      roomId,
      playerId,
      gameState: game.getGameState(),
    });

    // Notify all players in the room
    io.to(roomId).emit("playerJoined", {
      player: {
        id: playerId,
        name: playerName,
        chips: player.chips,
      },
      gameState: game.getGameState(),
    });

    console.log(`${playerName} joined room ${roomId}`);
  });

  // Join room with blockchain integration
  socket.on(
    "joinRoomWithBlockchain",
    ({ blockchainRoomId, player, txHash, tokenBalance, buyInTokens }) => {
      console.log("Joining blockchain room:", blockchainRoomId);

      const roomId = blockchainRoomId;
      const game = games.get(roomId);

      if (!game) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      // Check if player already joined
      const existingPlayer = game.players.find(
        (p) => p.walletAddress === player
      );
      if (existingPlayer) {
        // Player already in game, just reconnect
        playerSockets.set(socket.id, { playerId: existingPlayer.id, roomId });
        socket.join(roomId);

        socket.emit("roomJoined", {
          roomId,
          playerId: existingPlayer.id,
          gameState: game.getGameState(),
        });

        // If game is in progress, send cards
        if (game.gameStarted) {
          socket.emit("yourCards", {
            cards: game.getPlayerCards(existingPlayer.id),
          });
        }

        console.log(`${player} reconnected to room ${roomId}`);
        return;
      }

      const playerId = player; // Use wallet address as player ID
      const playerName = player.slice(0, 6); // Short address as name

      // Start chips equal to room buy-in (tokens). Prefer stored value, then payload.
      const playerChips =
        typeof game.buyInTokens === "number" && game.buyInTokens > 0
          ? Math.floor(game.buyInTokens)
          : typeof buyInTokens === "number" && buyInTokens > 0
            ? Math.floor(buyInTokens)
            : 1000;
      const newPlayer = new Player(
        playerId,
        playerName,
        socket.id,
        playerChips
      );
      newPlayer.walletAddress = player;

      game.addPlayer(newPlayer);
      playerSockets.set(socket.id, { playerId, roomId });

      socket.join(roomId);

      socket.emit("roomJoined", {
        roomId,
        playerId,
        gameState: game.getGameState(),
      });

      // Notify all players in the room
      io.to(roomId).emit("playerJoined", {
        player: {
          id: playerId,
          name: playerName,
          chips: newPlayer.chips,
          walletAddress: player,
        },
        gameState: game.getGameState(),
      });

      console.log(`${player} joined blockchain room ${roomId} (tx: ${txHash})`);
    }
  );

  // Start the game
  socket.on("startGame", ({ blockchainRoomId, txHash } = {}) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.roomId);
    if (!game) return;

    if (!game.canStartGame()) {
      socket.emit("error", {
        message: "Cannot start game. Need at least 2 players.",
      });
      return;
    }

    game.startGame();

    // Send game state to all players
    io.to(playerInfo.roomId).emit("gameStarted", {
      gameState: game.getGameState(),
    });

    // Send cards to each player privately
    game.players.forEach((player) => {
      const playerSocket = Array.from(playerSockets.entries()).find(
        ([_, info]) => info.playerId === player.id
      );

      if (playerSocket) {
        io.to(playerSocket[0]).emit("yourCards", {
          cards: game.getPlayerCards(player.id),
        });
      }
    });

    // Notify whose turn it is
    const currentPlayer = game.getCurrentPlayer();
    io.to(playerInfo.roomId).emit("turnChanged", {
      currentPlayerId: currentPlayer.id,
      currentPlayerName: currentPlayer.name,
    });

    console.log(`Game started in room ${playerInfo.roomId}`);
  });

  // Player sees their cards
  socket.on("seeCards", () => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.roomId);
    if (!game) return;

    const player = game.getPlayer(playerInfo.playerId);
    if (!player) return;

    player.seeCards();

    io.to(playerInfo.roomId).emit("playerSawCards", {
      playerId: player.id,
      gameState: game.getGameState(),
    });

    // Send cards to player (safety net in case they missed them)
    socket.emit("yourCards", {
      cards: game.getPlayerCards(player.id),
    });
  });

  // Player action (bet, fold, etc.)
  socket.on("playerAction", ({ action, amount }) => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.roomId);
    if (!game) return;

    const result = game.playerAction(playerInfo.playerId, action, amount);

    if (!result.success) {
      socket.emit("error", { message: result.error });
      return;
    }

    // Broadcast the action to all players
    io.to(playerInfo.roomId).emit("actionPerformed", {
      playerId: playerInfo.playerId,
      action,
      amount,
      gameState: game.getGameState(),
    });

    // Check for winner
    const winner = game.checkWinner();
    if (winner) {
      const gameResult = game.endGame(winner);

      io.to(playerInfo.roomId).emit("gameEnded", {
        winner: {
          id: winner.id,
          name: winner.name,
        },
        pot: gameResult.pot,
        gameState: game.getGameState(),
      });

      console.log(
        `Game ended in room ${playerInfo.roomId}. Winner: ${winner.name}`
      );
    } else {
      // Notify whose turn it is
      const currentPlayer = game.getCurrentPlayer();
      io.to(playerInfo.roomId).emit("turnChanged", {
        currentPlayerId: currentPlayer.id,
        currentPlayerName: currentPlayer.name,
      });
    }
  });

  // Request sideshow (compare cards with previous player)
  // Request sideshow (compare cards with previous player)
  /*
  socket.on("requestSideshow", ({ targetPlayerId }) => {
     // ...
  });
  */

  // Accept or reject sideshow
  // Accept or reject sideshow
  /*
  socket.on("sideshowResponse", ({ requesterId, accepted }) => {
    // ... (existing code)
  });
  */

  // Show cards (final reveal)
  // Show cards (final reveal)
  socket.on("show", () => {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.roomId);
    if (!game) return;

    const activePlayers = game.getActivePlayers();

    if (activePlayers.length !== 2) {
      socket.emit("error", { message: "Need exactly 2 players for show" });
      return;
    }

    // Find the winner by comparing all active players
    let winner = activePlayers[0];
    for (let i = 1; i < activePlayers.length; i++) {
      const compareResult = game.compareHands(winner, activePlayers[i]);
      if (compareResult && compareResult.id === activePlayers[i].id) {
        winner = activePlayers[i];
      }
    }

    if (winner) {
      const gameResult = game.endGame(winner);

      // Reveal all cards FIRST
      const allCards = {};
      game.players.forEach((p) => {
        allCards[p.id] = game.getPlayerCards(p.id);
      });

      // 1. Notify everyone that showdown is happening and reveal cards
      io.to(playerInfo.roomId).emit("showdownStarted", {
        allCards,
        gameState: game.getGameState(),
      });

      console.log(`Showdown in room ${playerInfo.roomId}. Winner: ${winner.name}`);

      // 2. Wait for 4 seconds to let players see the cards
      setTimeout(() => {
        io.to(playerInfo.roomId).emit("gameEnded", {
          winner: {
            id: winner.id,
            name: winner.name,
          },
          pot: gameResult.pot,
          allCards, // Send again just in case
          reason: "Show",
          gameState: game.getGameState(),
        });
      }, 4000);
    }
  });

  // Leave room
  socket.on("leaveRoom", () => {
    handlePlayerDisconnect(socket);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    handlePlayerDisconnect(socket);
  });

  function handlePlayerDisconnect(socket) {
    const playerInfo = playerSockets.get(socket.id);
    if (!playerInfo) return;

    const game = games.get(playerInfo.roomId);
    if (!game) return;

    const player = game.getPlayer(playerInfo.playerId);
    if (!player) return;

    game.removePlayer(playerInfo.playerId);
    playerSockets.delete(socket.id);

    // Notify other players
    io.to(playerInfo.roomId).emit("playerLeft", {
      playerId: playerInfo.playerId,
      playerName: player.name,
      gameState: game.getGameState(),
    });

    // If game is in progress and player leaves, end the game
    if (game.gameStarted) {
      const winner = game.checkWinner();
      if (winner) {
        const gameResult = game.endGame(winner);

        io.to(playerInfo.roomId).emit("gameEnded", {
          winner: {
            id: winner.id,
            name: winner.name,
          },
          pot: gameResult.pot,
          reason: "Player left",
          gameState: game.getGameState(),
        });
      }
    }

    // Delete game if no players left
    if (game.players.length === 0) {
      games.delete(playerInfo.roomId);
      console.log(`Room ${playerInfo.roomId} deleted (no players)`);
    }
  }
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`Teen Patti server running on port ${PORT}`);
});
