import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useReadContract } from "wagmi";
import {
  Copy,
  Users,
  Play,
  Eye,
  DollarSign,
  X,
  ArrowLeft,
  Trophy,
  Coins,
  Loader2,
} from "lucide-react";
import Button from "@/components/Button";
import PlayerSeat from "@/components/PlayerSeat";
import { formatChips } from "@/lib/utils";
import { useContracts } from "@/hooks/useContracts";
import GameABI from "@/contracts/TeenPattiGame.json";
import addresses from "@/contracts/addresses.json";

export default function GameRoom({ socket }) {
  const { roomId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { startGame: blockchainStartGame, declareWinner } = useContracts();

  const [playerId, setPlayerId] = useState(location.state?.playerId || "");
  const [playerName, setPlayerName] = useState(
    location.state?.playerName || ""
  );
  const [blockchainRoomId] = useState(
    location.state?.blockchainRoomId || roomId
  );
  const [gameState, setGameState] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [showCards, setShowCards] = useState(false);
  const [betAmount, setBetAmount] = useState(0);
  const [message, setMessage] = useState("");
  const [showBetInput, setShowBetInput] = useState(false);
  const [selectedBetAmount, setSelectedBetAmount] = useState(null);
  const [startingGame, setStartingGame] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [winnerInfo, setWinnerInfo] = useState(null);

  // Use wagmi's useReadContract to fetch room details reactively
  const { data: blockchainRoomDetails, refetch: refetchRoomDetails } =
    useReadContract({
      address: addresses.baseSepolia?.TeenPattiGame,
      abi: GameABI.abi,
      functionName: "getRoomDetails",
      args: blockchainRoomId ? [blockchainRoomId] : undefined,
      query: {
        enabled: !!blockchainRoomId,
        refetchInterval: 10000, // Auto-refetch every 10 seconds
      },
    });

  // Log room details when they update
  useEffect(() => {
    if (blockchainRoomDetails) {
      console.log("✅ Room details updated:", {
        creator: blockchainRoomDetails[0],
        buyIn: blockchainRoomDetails[1]?.toString(),
        pot: blockchainRoomDetails[2]?.toString(),
        maxPlayers: blockchainRoomDetails[3]?.toString(),
        currentPlayers: blockchainRoomDetails[4]?.toString(),
        state: blockchainRoomDetails[5]?.toString(),
        winner: blockchainRoomDetails[6],
      });
    }
  }, [blockchainRoomDetails]);

  useEffect(() => {
    if (!socket || !playerId) {
      navigate("/");
      return;
    }

    // Listen for game state updates
    socket.on("playerJoined", async ({ gameState: newGameState }) => {
      setGameState(newGameState);
      setMessage("A player joined the room");
      setTimeout(() => setMessage(""), 3000);
      // Refresh blockchain data immediately
      if (refetchRoomDetails) refetchRoomDetails();
    });

    socket.on("gameStarted", async ({ gameState: newGameState }) => {
      setGameState(newGameState);
      setMessage("Game started! Place your bets.");
      setTimeout(() => setMessage(""), 3000);
      // Refresh blockchain data immediately
      if (refetchRoomDetails) refetchRoomDetails();
    });

    socket.on("yourCards", ({ cards }) => {
      setMyCards(cards);
    });

    socket.on("playerSawCards", ({ gameState: newGameState }) => {
      setGameState(newGameState);
    });

    socket.on(
      "actionPerformed",
      ({
        playerId: actionPlayerId,
        action,
        amount,
        gameState: newGameState,
      }) => {
        setGameState(newGameState);
        const player = newGameState.players.find(
          (p) => p.id === actionPlayerId
        );
        if (player) {
          if (action === "fold" || action === "pack") {
            setMessage(`${player.name} folded`);
          } else if (action === "bet" || action === "chaal") {
            setMessage(`${player.name} bet ${formatChips(amount)}`);
          }
          setTimeout(() => setMessage(""), 3000);
        }
      }
    );

    socket.on("turnChanged", ({ currentPlayerId, currentPlayerName }) => {
      if (currentPlayerId === playerId) {
        setMessage("It's your turn!");
      } else {
        setMessage(`${currentPlayerName}'s turn`);
      }
      setTimeout(() => setMessage(""), 3000);
    });

    socket.on("gameEnded", async ({ winner, pot, allCards, reason }) => {
      if (allCards) {
        // Show all cards at the end
        setShowCards(true);
      }

      setGameEnded(true);

      if (winner) {
        setWinnerInfo({ name: winner.name, pot, reason });
        setMessage(
          `${winner.name} wins ${formatChips(pot)} chips! ${reason || ""}`
        );

        // Declare winner on blockchain
        if (blockchainRoomId && winner.id) {
          await handleDeclareWinner(winner.id);
        }
      } else {
        setMessage(`Game ended. ${reason || ""}`);
      }
    });

    socket.on(
      "playerLeft",
      ({ playerName: leftPlayerName, gameState: newGameState }) => {
        setGameState(newGameState);
        setMessage(`${leftPlayerName} left the game`);
        setTimeout(() => setMessage(""), 3000);
      }
    );

    socket.on("error", ({ message: errorMessage }) => {
      setMessage(`Error: ${errorMessage}`);
      setTimeout(() => setMessage(""), 3000);
    });

    return () => {
      socket.off("playerJoined");
      socket.off("gameStarted");
      socket.off("yourCards");
      socket.off("playerSawCards");
      socket.off("actionPerformed");
      socket.off("turnChanged");
      socket.off("gameEnded");
      socket.off("playerLeft");
      socket.off("error");
    };
  }, [socket, playerId, navigate]);

  // GSAP Animations
  useEffect(() => {
    if (gameState?.gameStarted && !startingGame) {
      // Animate dealing cards
      // We can trigger this when gameStarted becomes true
      // But we need to be careful not to re-animate on every render
      // Ideally, we'd have a specific event or state transition
    }
  }, [gameState?.gameStarted]);

  // Listen for specific socket events for animations
  useEffect(() => {
    if (!socket) return;

    const handleGameStartedAnim = () => {
      // Shuffle Animation first
      const dealer = document.getElementById('dealer-hand-position'); // New anchor point
      if (!dealer) return;

      const dealerRect = dealer.getBoundingClientRect();

      // Create a temporary shuffling deck
      const shuffleCards = [];
      for (let i = 0; i < 5; i++) {
        const card = document.createElement('div');
        card.className = 'absolute w-16 h-24 bg-blue-900 border border-white rounded shadow-xl';
        card.style.backgroundImage = 'url("/cards/back_of_card.jpg")';
        card.style.backgroundSize = 'cover';
        card.style.left = `${dealerRect.left}px`;
        card.style.top = `${dealerRect.top}px`;
        document.body.appendChild(card);
        shuffleCards.push(card);
      }

      // Animate shuffling
      const tl = gsap.timeline({
        onComplete: () => {
          shuffleCards.forEach(c => c.remove());
          startDealing(); // Proceed to deal
        }
      });

      shuffleCards.forEach((card, i) => {
        tl.to(card, {
          x: (Math.random() - 0.5) * 40,
          y: (Math.random() - 0.5) * 10,
          rotation: (Math.random() - 0.5) * 15,
          duration: 0.1,
          yoyo: true,
          repeat: 3,
          ease: "power1.inOut"
        }, 0);
      });
    };

    const startDealing = () => {
      // Animate cards from DEALER to players
      const dealer = document.getElementById('dealer-hand-position');
      if (!dealer) return;

      const dealerRect = dealer.getBoundingClientRect();

      gameState?.players.forEach((player, index) => {
        const seat = document.getElementById(`player-seat-${index}`);
        if (!seat) return;

        const seatRect = seat.getBoundingClientRect();

        // Create flying card
        const card = document.createElement('div');
        card.className = 'fixed w-10 h-14 bg-blue-900 border border-white rounded z-50 shadow-xl';
        card.style.left = `${dealerRect.left}px`;
        card.style.top = `${dealerRect.top}px`;

        const img = document.createElement('img');
        img.src = '/cards/back_of_card.jpg';
        img.className = 'w-full h-full object-cover rounded';
        card.appendChild(img);

        document.body.appendChild(card);

        gsap.to(card, {
          left: seatRect.left + seatRect.width / 2 - 20,
          top: seatRect.top + seatRect.height / 2 - 30,
          rotation: 360 * 2,
          scale: 0.8,
          duration: 0.6,
          delay: index * 0.2,
          ease: "power2.out",
          onComplete: () => {
            card.remove();
            gsap.fromTo(seat, { scale: 1.1 }, { scale: 1, duration: 0.2 });
          }
        });
      });
    };

    const handleActionAnim = ({ playerId: actorId, action, amount }) => {
      if (action === 'bet' || action === 'chaal') {
        const playerIndex = gameState?.players.findIndex(p => p.id === actorId);
        if (playerIndex === -1) return;

        const seat = document.getElementById(`player-seat-${playerIndex}`);
        if (!seat) return;

        const seatRect = seat.getBoundingClientRect();

        // Get the chips-group element position
        const chipsGroup = document.getElementById('chips-group-pot');
        const targetRect = chipsGroup ? chipsGroup.getBoundingClientRect() : null;

        // Fallback to window center if chips-group not found
        const targetX = targetRect ? targetRect.left + targetRect.width / 2 : window.innerWidth / 2;
        const targetY = targetRect ? targetRect.top + targetRect.height / 2 : window.innerHeight / 2;

        // Use CHIP image
        const chip = document.createElement('img');
        chip.src = '/chip.png';
        chip.className = 'fixed w-8 h-8 z-50 drop-shadow-md';
        chip.style.left = `${seatRect.left + seatRect.width / 2}px`;
        chip.style.top = `${seatRect.top + seatRect.height / 2}px`;
        document.body.appendChild(chip);

        gsap.to(chip, {
          left: targetX,
          top: targetY,
          rotation: 720,
          duration: 0.6,
          ease: "power2.inOut",
          onComplete: () => {
            chip.remove();
          }
        });
      }
    };

    socket.on("gameStarted", handleGameStartedAnim);
    socket.on("actionPerformed", handleActionAnim);

    return () => {
      socket.off("gameStarted", handleGameStartedAnim);
      socket.off("actionPerformed", handleActionAnim);
    };
  }, [socket, gameState]);

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setMessage("Room ID copied to clipboard!");
    setTimeout(() => setMessage(""), 2000);
  };

  const handleStartGame = async () => {
    if (!blockchainRoomId) {
      setMessage("No blockchain room ID found");
      setTimeout(() => setMessage(""), 3000);
      return;
    }

    setStartingGame(true);
    setMessage("Starting game on blockchain...");

    try {
      // Call blockchain startGame function
      const result = await blockchainStartGame(blockchainRoomId);

      if (!result.success) {
        throw new Error(result.error || "Failed to start game on blockchain");
      }

      console.log("Game started on blockchain:", result.txHash);
      setMessage("Game started successfully! ✅");

      // Refresh blockchain data immediately after transaction
      await refetchRoomDetails();

      // Notify backend via Socket.IO (optional)
      if (socket) {
        socket.emit("startGame", {
          blockchainRoomId,
          txHash: result.txHash,
        });
      }

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Error starting game:", err);

      let errorMessage = err.message;
      if (err.message.includes("user rejected")) {
        errorMessage = "Transaction rejected by user";
      } else if (err.message.includes("Not authorized")) {
        errorMessage = "Only the room creator can start the game";
      } else if (err.message.includes("Game already started")) {
        errorMessage = "Game has already started";
      } else if (err.message.includes("Need at least 2 players")) {
        errorMessage = "Need at least 2 players to start";
      }

      setMessage(`Error: ${errorMessage}`);
      setTimeout(() => setMessage(""), 5000);
    } finally {
      setStartingGame(false);
    }
  };

  const handleDeclareWinner = async (winnerAddress) => {
    if (!blockchainRoomId) {
      console.error("No blockchain room ID found");
      return;
    }

    try {
      setMessage("Declaring winner on blockchain...");
      console.log("Declaring winner:", { blockchainRoomId, winnerAddress });

      const result = await declareWinner(blockchainRoomId, winnerAddress);

      if (!result.success) {
        throw new Error(
          result.error || "Failed to declare winner on blockchain"
        );
      }

      console.log("Winner declared on blockchain:", result.txHash);
      setMessage("Winner declared successfully! 🏆");

      // Refresh blockchain data immediately after transaction
      await refetchRoomDetails();

      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      console.error("Error declaring winner:", err);

      let errorMessage = err.message;
      if (err.message.includes("user rejected")) {
        errorMessage = "Transaction rejected by user";
      } else if (err.message.includes("Only backend")) {
        errorMessage = "Only the backend can declare winner";
      } else if (err.message.includes("Game not active")) {
        errorMessage = "Game is not active";
      }

      setMessage(`Error declaring winner: ${errorMessage}`);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleSeeCards = () => {
    setShowCards(true);
    socket.emit("seeCards");
  };

  const handleFold = () => {
    socket.emit("playerAction", { action: "pack" });
    setShowBetInput(false);
  };

  const handleBet = (amount = betAmount) => {
    if (amount <= 0) {
      setMessage("Please enter a valid bet amount");
      setTimeout(() => setMessage(""), 2000);
      return;
    }
    socket.emit("playerAction", { action: "chaal", amount });
    setShowBetInput(false);
    setBetAmount(0);
  };

  const handleShow = () => {
    // Request showdown - compare cards with all remaining players
    socket.emit("show");
  };

  const handleLeaveRoom = () => {
    socket.emit("leaveRoom");
    navigate("/");
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-orange-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-black/30 backdrop-blur-sm rounded-lg p-8 text-center">
            <Users className="w-16 h-16 text-white mx-auto mb-4 animate-pulse" />
            <h2 className="text-white text-2xl font-bold mb-4">
              Waiting for Players
            </h2>
            <div className="bg-white/10 rounded-lg p-4 mb-4">
              <p className="text-gray-300 text-sm mb-2">Room ID</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-white text-sm font-bold tracking-wider">
                  {roomId}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyRoomId}
                  className="text-white hover:bg-white/10"
                >
                  <Copy className="w-5 h-5" />
                </Button>
              </div>
            </div>
            <p className="text-gray-300 mb-4">
              Share this Room ID with your friends to join the game
            </p>
            <Button
              onClick={handleLeaveRoom}
              variant="outline"
              className="bg-white/10 text-white border-white/20 hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Leave Room
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const currentPlayer = gameState?.players.find((p) => p.id === playerId);
  const isMyTurn =
    gameState?.currentPlayerIndex !== undefined &&
    gameState?.players[gameState.currentPlayerIndex]?.id === playerId;

  // Use blockchain data to determine if game can start
  // Parse blockchain room details (array from contract)
  const roomCreator = blockchainRoomDetails?.[0];
  const roomBuyIn = blockchainRoomDetails?.[1];
  const roomPot = blockchainRoomDetails?.[2];
  const roomMaxPlayers = blockchainRoomDetails?.[3];
  const roomCurrentPlayers = blockchainRoomDetails?.[4];
  const roomState = blockchainRoomDetails?.[5];
  const roomWinner = blockchainRoomDetails?.[6];

  // Only room creator can start the game
  const isCreator =
    roomCreator &&
    playerId &&
    roomCreator.toLowerCase() === playerId.toLowerCase();

  const canStartGame =
    blockchainRoomDetails &&
    isCreator && // Must be the room creator
    Number(roomState) === 0 && // 0 = WAITING
    Number(roomCurrentPlayers) >= 2;

  // Calculate min and max bet
  const minBet = currentPlayer?.isBlind
    ? gameState.currentBet
    : gameState.currentBet * 2;
  const maxBet = currentPlayer?.isBlind
    ? gameState.currentBet * 2
    : gameState.currentBet * 4;

  // Position players around the table
  const getPlayerPosition = (index, total) => {
    if (total <= 2) {
      return index === 0 ? "bottom" : "top";
    }
    if (total === 3) {
      return ["bottom", "top", "top"][index];
    }
    if (total === 4) {
      return ["bottom", "left", "top", "right"][index];
    }
    if (total === 5) {
      return ["bottom", "left", "top", "top", "right"][index];
    }
    return ["bottom", "left", "left", "top", "right", "right"][index];
  };

  return (
    <div className="min-h-screen bg-[url('/background.jpg')] bg-cover bg-center pt-16">
      {/* Header - Sophisticated Design */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/60 via-black/40 to-transparent backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left Section */}
            <div className="flex items-center gap-4">
              <button
                onClick={handleLeaveRoom}
                className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>

              <div className="flex items-center gap-3">
                <div className="h-10 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>

                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-white text-sm font-bold tracking-wide">
                      {roomId.slice(0, 8)}...
                    </h2>
                    {isCreator && (
                      <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full text-yellow-400 text-[10px] font-bold tracking-wider flex items-center gap-1">
                        <span className="text-xs">👑</span> HOST
                      </span>
                    )}
                  </div>

                  {blockchainRoomDetails && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {Number(roomCurrentPlayers)}/{Number(roomMaxPlayers)}
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span className="flex items-center gap-1">
                        <Coins className="w-3 h-3 text-yellow-500" />
                        {roomBuyIn ? (Number(roomBuyIn) / 1e18).toFixed(0) : "0"} TPT
                      </span>
                      <span className="w-1 h-1 rounded-full bg-gray-600"></span>
                      <span className={`${Number(roomState) === 0 ? "text-yellow-400" : "text-green-400"}`}>
                        {Number(roomState) === 0 ? "⏳ Waiting" : Number(roomState) === 1 ? "🎮 Active" : Number(roomState) === 2 ? "✅ Finished" : "❌ Cancelled"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopyRoomId}
                className="h-9 px-4 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Copy ID</span>
              </button>

              {canStartGame && (
                <button
                  onClick={handleStartGame}
                  disabled={startingGame}
                  className="h-9 px-5 rounded-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 border border-green-400/30 text-white text-xs font-bold tracking-wide transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/20"
                >
                  {startingGame ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Starting...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" />
                      Start Game
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Message Banner - Sophisticated Floating Notification */}
      {message && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[60] animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="bg-black/80 backdrop-blur-xl border border-yellow-500/30 text-yellow-100 px-8 py-3 rounded-full shadow-[0_0_30px_rgba(234,179,8,0.2)] flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <span className="font-medium tracking-wide text-sm md:text-base">{message}</span>
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
          </div>
        </div>
      )}
      {/* ... (Header) ... */}

      {/* Game Table Container */}
      <div className="relative w-full h-[calc(100vh-64px)] flex items-center justify-center overflow-hidden perspective-[1000px]">

        {/* Dealer Girl */}
        <div className="absolute top-[-2%] left-1/2 -translate-x-1/2 z-0 w-40 h-40 md:w-56 md:h-56 pointer-events-none transition-all duration-500 z-50">
          <img
            src="/dealer.png"
            alt="Dealer"
            className="w-full h-full object-contain drop-shadow-2xl"
          />
          {/* Dealer Hand Position Anchor */}
          <div id="dealer-hand-position" className="absolute bottom-8 left-1/2 -translate-x-1/2 w-1 h-1"></div>
        </div>

        {/* Table Surface - Slightly Reduced Size */}
        <div className="relative w-[85vw] max-w-[1000px] aspect-[1.8/1] transform-style-3d rotate-x-[20deg] transition-transform duration-500 z-10">
          <img
            src="/table.jpg"
            alt="Poker Table"
            className="absolute inset-0 w-full h-full object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
          />

          {/* Pot in Center - Chips Group Image */}
          <div className="absolute top-[51%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-2">
            {/* Chips Group Image - Centered */}
            <div id="chips-group-pot" className="relative w-32 h-24">
              <img src="/chips-group.png" alt="Pot Chips" className="w-full h-full object-contain drop-shadow-xl" />
            </div>

            {/* POT Text Below */}
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-1 border border-yellow-500/30">
              <div className="text-yellow-100 font-bold text-lg shadow-black drop-shadow-md">
                POT: {formatChips(gameState.pot)}
              </div>
            </div>
          </div>
        </div>

        {/* Players Overlay */}
        <div className="absolute inset-0 pointer-events-none z-30">
          {gameState.players.map((player, index) => {
            const position = getPlayerPosition(
              index,
              gameState.players.length
            );
            const isCurrentTurn =
              gameState.gameStarted && gameState.currentPlayerIndex === index;
            const isDealer = gameState.dealerIndex === index;

            // REFINED POSITIONING LOGIC
            let style = {};

            // Hero (Bottom Center)
            if (index === 0) style = { bottom: '2%', left: '50%', transform: 'translateX(-50%)' };

            // Opponent Logic for 2 Players: Place at Top Right or Top Left, NOT beside
            else if (gameState.players.length === 2) {
              style = { top: '15%', right: '20%' }; // Top Right for 1v1
            }
            // Standard 6-max Logic
            else {
              if (index === 1) style = { bottom: '20%', left: '10%' };
              else if (index === 2) style = { top: '20%', left: '15%' };
              else if (index === 3) style = { top: '10%', left: '50%', transform: 'translateX(-50%)' }; // Top Center (if 6 players, might overlap dealer slightly but okay)
              else if (index === 4) style = { top: '20%', right: '15%' };
              else if (index === 5) style = { bottom: '20%', right: '10%' };
            }

            const playerCards = player.id === playerId ? myCards : [];
            const shouldShowCards = player.id === playerId && showCards;

            return (
              <div key={player.id} className="absolute pointer-events-auto" style={style} id={`player-seat-${index}`}>
                <PlayerSeat
                  player={player}
                  isCurrentPlayer={isCurrentTurn}
                  isDealer={isDealer}
                  cards={playerCards}
                  showCards={shouldShowCards}
                  position={position}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Sophisticated Action Panel */}
      {gameState.gameStarted && currentPlayer && !currentPlayer.isFolded && (
        <div className="absolute bottom-8 right-8 flex flex-col items-end gap-4 z-50">

          {/* Info Card */}
          <div className="bg-gradient-to-br from-gray-900/90 to-black/90 backdrop-blur-xl rounded-2xl p-5 border border-white/10 shadow-2xl min-w-[200px]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-xs font-bold tracking-widest uppercase">Your Stack</span>
              <span className="text-yellow-400 font-bold text-xl font-mono">{formatChips(currentPlayer.chips)}</span>
            </div>
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/20 to-transparent my-2"></div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400 text-xs font-bold tracking-widest uppercase">Table Bet</span>
              <span className="text-blue-400 font-bold text-lg font-mono">{formatChips(gameState.currentBet)}</span>
            </div>
          </div>

          {/* Controls Container */}
          <div className="flex flex-col gap-3 items-end">

            {/* Primary Actions Row */}
            <div className="flex gap-3">
              {isMyTurn && showCards && gameState?.players.filter((p) => !p.isFolded).length >= 2 && (
                <button onClick={handleShow} className="h-12 px-6 rounded-full bg-yellow-600 hover:bg-yellow-500 text-white font-bold shadow-lg border border-yellow-400 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                  <Eye size={18} /> SHOW
                </button>
              )}

              {isMyTurn && (
                <button onClick={handleFold} className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg border border-red-400 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                  <X size={18} /> FOLD
                </button>
              )}
            </div>

            {/* Betting Interface */}
            {isMyTurn && !showBetInput && (
              <div className="bg-black/60 backdrop-blur-md rounded-2xl p-3 border border-white/5 flex flex-col gap-3 items-end">

                {/* Amount Selector */}
                <div className="flex gap-2 bg-black/40 p-1 rounded-xl">
                  {[
                    { label: 'MIN', val: minBet, color: 'green' },
                    { label: 'MID', val: Math.floor((minBet + maxBet) / 2), color: 'blue' },
                    { label: 'MAX', val: maxBet, color: 'red' }
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      onClick={() => setSelectedBetAmount(opt.val)}
                      className={`
                                      w-14 h-10 rounded-lg flex flex-col items-center justify-center transition-all
                                      ${selectedBetAmount === opt.val
                          ? `bg-${opt.color}-600 text-white shadow-lg scale-105 ring-2 ring-${opt.color}-400`
                          : `bg-gray-800 text-gray-400 hover:bg-gray-700`}
                                  `}
                    >
                      <span className="text-[10px] font-bold">{opt.label}</span>
                      <span className="text-[10px]">{formatChips(opt.val)}</span>
                    </button>
                  ))}
                </div>

                {/* Big Action Button */}
                <button
                  onClick={() => handleBet(selectedBetAmount || minBet)}
                  className="w-full h-14 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl shadow-lg border-t border-green-400 flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <span className="text-white font-black text-xl tracking-wider">CHAAL</span>
                  <div className="bg-black/20 px-2 py-1 rounded text-sm font-mono text-green-100">
                    {formatChips(selectedBetAmount || minBet)}
                  </div>
                </button>
              </div>
            )}

            {/* Blind See Cards */}
            {!showCards && currentPlayer.isBlind && (
              <button onClick={handleSeeCards} className="h-12 px-8 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg border border-purple-400 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
                <Eye size={18} /> SEE CARDS
              </button>
            )}
          </div>
        </div>
      )}

      {!isMyTurn && (
        <div className="text-center text-gray-300 mt-4">
          Waiting for other players...
        </div>
      )}


      {/* Waiting for Game to Start */}
      {
        !gameState.gameStarted && (
          <div className="max-w-7xl mx-auto mt-4">
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-6 text-center">
              <Users className="w-12 h-12 text-white mx-auto mb-4" />
              <h3 className="text-white text-xl font-semibold mb-2">
                Waiting for players...
              </h3>
              <p className="text-gray-300">
                {gameState.players.length >= 2
                  ? 'Ready to start! Click "Start Game" to begin.'
                  : "Need at least 2 players to start the game."}
              </p>
            </div>
          </div>
        )
      }

      {/* Game Ended Overlay */}
      {
        gameEnded && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gradient-to-br from-yellow-600 to-orange-600 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl border-4 border-yellow-400">
              <div className="text-center">
                <Trophy className="w-24 h-24 text-white mx-auto mb-4 animate-bounce" />

                {winnerInfo ? (
                  <>
                    <h2 className="text-white text-4xl font-bold mb-2">
                      🎉 Winner! 🎉
                    </h2>
                    <p className="text-yellow-100 text-2xl font-semibold mb-2">
                      {winnerInfo.name}
                    </p>
                    <div className="bg-white/20 rounded-lg p-4 mb-4">
                      <p className="text-white text-sm mb-1">Prize Money</p>
                      <p className="text-yellow-200 text-3xl font-bold">
                        {formatChips(winnerInfo.pot)}
                      </p>
                    </div>
                    {winnerInfo.reason && (
                      <p className="text-yellow-100 text-sm mb-4">
                        {winnerInfo.reason}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <h2 className="text-white text-3xl font-bold mb-4">
                      Game Ended
                    </h2>
                    <p className="text-yellow-100 mb-4">
                      The game has concluded.
                    </p>
                  </>
                )}

                <Button
                  onClick={() => navigate("/")}
                  size="lg"
                  className="w-full bg-white text-orange-600 hover:bg-gray-100 font-bold text-lg"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Exit to Home
                </Button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
