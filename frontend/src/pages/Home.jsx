import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gamepad2,
  Users,
  Trophy,
  Sparkles,
  Zap,
  Shield,
  Coins,
  Play,
  Crown,
} from "lucide-react";
import Button from "@/components/Button";
import WalletConnect from "@/components/WalletConnect";
import TokenBalance from "@/components/TokenBalance";
import BuyTokensModal from "@/components/BuyTokensModal";
import CreateRoomModal from "@/components/CreateRoomModal";
import JoinRoomModal from "@/components/JoinRoomModal";
import { useWallet } from "@/hooks/useWallet.jsx";

export default function Home({ socket }) {
  const navigate = useNavigate();
  const { isConnected, account } = useWallet();
  const [error, setError] = useState("");
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showJoinRoom, setShowJoinRoom] = useState(false);

  function handleCreateRoomSuccess(socketRoomId, blockchainRoomId) {
    console.log("Room created:", { socketRoomId, blockchainRoomId });
    setShowCreateRoom(false);

    if (blockchainRoomId) {
      navigate(`/room/${blockchainRoomId}`, {
        state: {
          playerId: account,
          playerName: account.slice(0, 6),
          blockchainRoomId,
        },
      });
    }
  }

  function handleJoinRoomSuccess(socketRoomId, blockchainRoomId) {
    console.log("Room joined:", { socketRoomId, blockchainRoomId });
    setShowJoinRoom(false);

    if (blockchainRoomId) {
      navigate(`/room/${blockchainRoomId}`, {
        state: {
          playerId: account,
          playerName: account.slice(0, 6),
          blockchainRoomId,
        },
      });
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Blurred Background Image */}
      <div
        className="absolute inset-0 bg-[url('/background.jpg')] bg-cover bg-center bg-no-repeat"
        style={{ filter: "blur(8px)", transform: "scale(1.1)" }}
      ></div>

      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-black/40"></div>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-yellow-600/5 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* Navbar */}
      <nav className="relative z-20 bg-black/30 backdrop-blur-md border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <div className="flex items-center">
              {/* <div className=" w-14 rounded-lg">
                <img src="logo.png" className='w-10 h-10'/>
              </div> */}
              <h1 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400">
                TEEN PATTI
              </h1>
            </div>

            {/* Wallet Connect */}
            <div className="flex items-center gap-4">
              <WalletConnect />
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="max-w-6xl w-full">
          {/* Header with Casino Style */}
          <div className="text-center mb-4">
            <div className="relative inline-block">
              <div className="flex items-center justify-center gap-4 mb-2">
                <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-yellow-200 to-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
                  TEEN PATTI
                </h1>
              </div>

              <div className="relative">
                <p className="text-2xl font-bold text-white">
                  🎰 The Ultimate Card Game Experience 🎰
                </p>
                <p className="text-lg text-purple-300 mt-2 font-semibold">
                  Play • Win • Dominate
                </p>
              </div>
            </div>
          </div>

          <div className="font-bold text-white text-xl underline mb-5 underline-offset-4">
            Features
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
            <div className="group relative bg-gradient-to-br from-blue-600/20 to-blue-800/20 backdrop-blur-md rounded-2xl p-6 border border-blue-500/30 hover:border-blue-400/60 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-400/0 to-blue-600/0 group-hover:from-blue-400/10 group-hover:to-blue-600/10 rounded-2xl transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-blue-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-blue-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  Multiplayer
                </h3>
                <p className="text-blue-200 text-sm">2-6 Players</p>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-yellow-600/20 to-yellow-800/20 backdrop-blur-md rounded-2xl p-6 border border-yellow-500/30 hover:border-yellow-400/60 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(250,204,21,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/0 to-yellow-600/0 group-hover:from-yellow-400/10 group-hover:to-yellow-600/10 rounded-2xl transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-yellow-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  Real-time
                </h3>
                <p className="text-yellow-200 text-sm">Live Sync</p>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-purple-600/20 to-purple-800/20 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-400/0 to-purple-600/0 group-hover:from-purple-400/10 group-hover:to-purple-600/10 rounded-2xl transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-purple-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Zap className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">
                  Fast Paced
                </h3>
                <p className="text-purple-200 text-sm">Quick Games</p>
              </div>
            </div>

            <div className="group relative bg-gradient-to-br from-green-600/20 to-green-800/20 backdrop-blur-md rounded-2xl p-6 border border-green-500/30 hover:border-green-400/60 transition-all duration-300 hover:scale-105 hover:shadow-[0_0_30px_rgba(34,197,94,0.3)]">
              <div className="absolute inset-0 bg-gradient-to-br from-green-400/0 to-green-600/0 group-hover:from-green-400/10 group-hover:to-green-600/10 rounded-2xl transition-all duration-300"></div>
              <div className="relative">
                <div className="bg-green-500/20 w-16 h-16 rounded-xl flex items-center justify-center mb-4 mx-auto group-hover:scale-110 transition-transform">
                  <Shield className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-white font-bold text-lg mb-2">Secure</h3>
                <p className="text-green-200 text-sm">Blockchain</p>
              </div>
            </div>
          </div>

          <div className="relative bg-gradient-to-br from-slate-800/40 to-slate-900/40 backdrop-blur-lg rounded-3xl border border-white/10 shadow-2xl overflow-hidden mb-8">
            {/* Decorative gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 via-transparent to-blue-600/5 pointer-events-none"></div>

            <div className="relative p-8">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">
                  Ready to Play?
                </h2>
                <p className="text-gray-400">Choose your path to victory</p>
              </div>

              {/* Wallet Connection Required */}
              {!isConnected ? (
                <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 backdrop-blur-sm text-white px-6 py-4 rounded-2xl text-center">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-blue-400" />
                  <p className="font-bold text-lg mb-2">Connect Your Wallet</p>
                  <p className="text-sm text-gray-300">
                    Secure blockchain authentication required to play
                  </p>
                </div>
              ) : (
                <>
                  {/* Error Message */}
                  {error && (
                    <div className="bg-red-600/20 border border-red-500/50 backdrop-blur-sm text-red-200 px-4 py-3 rounded-xl mb-6">
                      {error}
                    </div>
                  )}

                  <div className="grid md:grid-cols-2 gap-6">
                    {/* Create Room Card */}
                    <div className="group relative bg-gradient-to-br from-blue-600/10 to-blue-800/10 rounded-2xl p-6 border border-blue-500/30 hover:border-blue-400/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(59,130,246,0.2)]">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/10 to-blue-600/10 group-hover:from-blue-400/5 group-hover:to-blue-600/5 rounded-2xl transition-all duration-300"></div>
                      <div className="relative">
                        <div className="flex items-center justify-center mb-4">
                          <div className="bg-blue-500/20 p-4 rounded-xl">
                            <Play className="w-10 h-10 text-blue-400" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 text-center">Create Room</h3>
                        <p className="text-sm text-gray-400 mb-4 text-center">Start a new game on the blockchain</p>
                        <Button
                          onClick={() => setShowCreateRoom(true)}
                          disabled={!isConnected}
                          className="w-full"
                          size="lg"
                        >
                          <Gamepad2 className="w-5 h-5" />
                          Create New Game
                        </Button>
                        <p className="text-xs text-gray-500 text-center mt-3">
                          💎 Set your buy-in and max players
                        </p>
                      </div>
                    </div>

                    {/* Join Room Card */}
                    <div className="group relative bg-gradient-to-br from-purple-600/10 to-purple-800/10 rounded-2xl p-6 border border-purple-500/30 hover:border-purple-400/60 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 to-purple-600/10 group-hover:from-purple-400/5 group-hover:to-purple-600/5 rounded-2xl transition-all duration-300"></div>
                      <div className="relative">
                        <div className="flex items-center justify-center mb-4">
                          <div className="bg-purple-500/20 p-4 rounded-xl">
                            <Users className="w-10 h-10 text-purple-400" />
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2 text-center">Join Room</h3>
                        <p className="text-sm text-gray-400 mb-4 text-center">Enter an existing game room</p>
                        <Button
                          onClick={() => setShowJoinRoom(true)}
                          disabled={!isConnected}
                          variant="secondary"
                          className="w-full"
                          size="lg"
                        >
                          <Users className="w-5 h-5" />
                          Join Existing Game
                        </Button>
                        <p className="text-xs text-gray-500 text-center mt-3">
                          🎯 Enter room ID to join
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <div className="flex justify-between items-end mt-5">
                {isConnected && (
                  <div className="flex items-center gap-3 flex-wrap justify-center">
                    <TokenBalance />
                    <Button
                      onClick={() => setShowBuyTokens(true)}
                      className="text-sm bg-gradient-to-r from-yellow-600 to-orange-600"
                    >
                      <Coins className="w-4 h-4" />
                      Buy Tokens
                    </Button>
                  </div>
                )}

                {/* Connection Status */}
                <div className="mt-6 text-center">
                  {socket ? (
                    <div className="inline-flex items-center gap-2 bg-green-600/20 border border-green-500/30 px-4 py-2 rounded-full">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      <span className="text-green-300 text-sm font-semibold">
                        Server Connected
                      </span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-red-600/20 border border-red-500/30 px-4 py-2 rounded-full">
                      <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                      <span className="text-red-300 text-sm font-semibold">
                        Connecting...
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* How to Play - Accordion Style */}
          <details className="group bg-gradient-to-br from-slate-800/60 to-slate-900/60 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
            <summary className="cursor-pointer p-6 text-white font-bold text-xl flex items-center justify-between hover:bg-white/5 transition-colors">
              <span className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-400" />
                How to Play Teen Patti
              </span>
              <span className="text-2xl group-open:rotate-180 transition-transform">
                ▼
              </span>
            </summary>
            <div className="p-6 pt-0 text-gray-300 space-y-4">
              <div className="bg-blue-600/10 border border-blue-500/20 rounded-xl p-4">
                <p className="font-semibold text-blue-300 mb-2">
                  🎯 Objective:
                </p>
                <p className="text-sm">
                  Have the best 3-card hand or be the last player standing.
                </p>
              </div>

              <div className="bg-yellow-600/10 border border-yellow-500/20 rounded-xl p-4">
                <p className="font-semibold text-yellow-300 mb-3">
                  🏆 Hand Rankings (High to Low):
                </p>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">1.</span>
                    <span>
                      <strong className="text-white">Trio/Trail</strong> - Three
                      cards of same rank (AAA is highest)
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">2.</span>
                    <span>
                      <strong className="text-white">Pure Sequence</strong> -
                      Three consecutive cards of same suit
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">3.</span>
                    <span>
                      <strong className="text-white">Sequence</strong> - Three
                      consecutive cards of different suits
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">4.</span>
                    <span>
                      <strong className="text-white">Color/Flush</strong> -
                      Three cards of same suit
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">5.</span>
                    <span>
                      <strong className="text-white">Pair</strong> - Two cards
                      of same rank
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-yellow-400 font-bold">6.</span>
                    <span>
                      <strong className="text-white">High Card</strong> -
                      Highest single card wins
                    </span>
                  </li>
                </ul>
              </div>

              <div className="bg-purple-600/10 border border-purple-500/20 rounded-xl p-4">
                <p className="font-semibold text-purple-300 mb-2">
                  🎮 Gameplay:
                </p>
                <p className="text-sm">
                  Players can play <strong className="text-white">blind</strong>{" "}
                  (without seeing cards) or{" "}
                  <strong className="text-white">seen</strong> (after viewing).
                  Blind players bet half the amount of seen players. Continue
                  betting until only one player remains or players show their
                  cards.
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>

      {/* Buy Tokens Modal */}
      <BuyTokensModal
        isOpen={showBuyTokens}
        onClose={() => setShowBuyTokens(false)}
        onSuccess={() => {
          setShowBuyTokens(false);
          // Token balance will auto-refresh
        }}
      />

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={showCreateRoom}
        onClose={() => setShowCreateRoom(false)}
        onSuccess={handleCreateRoomSuccess}
        socket={socket}
      />

      {/* Join Room Modal */}
      <JoinRoomModal
        isOpen={showJoinRoom}
        onClose={() => setShowJoinRoom(false)}
        onSuccess={handleJoinRoomSuccess}
        socket={socket}
      />
    </div>
  );
}
