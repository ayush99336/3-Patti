import React, { useEffect, useRef } from 'react';
import { User, Crown } from 'lucide-react';
import { cn, formatChips } from '@/lib/utils';
import PlayingCard from './PlayingCard';
import gsap from 'gsap';

export default function PlayerSeat({
  player,
  isCurrentPlayer,
  isDealer,
  cards = [],
  showCards = false,
  position = 'bottom',
  className
}) {
  const seatRef = useRef(null);
  const progressCircleRef = useRef(null);

  // Animation for turn timer
  useEffect(() => {
    if (isCurrentPlayer && progressCircleRef.current) {
      // Reset animation
      gsap.set(progressCircleRef.current, { strokeDashoffset: 0 });
      // Animate to empty (251 is approx circumference of r=40)
      gsap.to(progressCircleRef.current, {
        strokeDashoffset: 251,
        duration: 15,
        ease: "linear"
      });
    } else if (progressCircleRef.current) {
      gsap.killTweensOf(progressCircleRef.current);
      gsap.set(progressCircleRef.current, { strokeDashoffset: 0 });
    }
  }, [isCurrentPlayer]);

  const isHero = position === 'bottom';

  return (
    <div
      ref={seatRef}
      className={cn(
        'player-seat relative flex flex-col items-center gap-2',
        player.isFolded && 'opacity-50 grayscale',
        className
      )}
    >
      {/* Avatar Container */}
      <div className="relative">
        {/* Progress Ring (only visible when active turn) */}
        {isCurrentPlayer && (
          <svg className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-28 h-28 z-0 rotate-[-90deg]">
            <circle
              cx="56"
              cy="56"
              r="40"
              fill="transparent"
              stroke="#fbbf24" // yellow-400
              strokeWidth="4"
              strokeDasharray="251"
              strokeDashoffset="0"
              ref={progressCircleRef}
              className="drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]"
            />
          </svg>
        )}

        {/* Avatar Circle */}
        <div className={cn(
          'w-20 h-20 rounded-full border-4 overflow-hidden relative z-10 flex items-center justify-center shadow-2xl',
          isCurrentPlayer ? 'border-yellow-400' : 'border-gray-600',
          'bg-gray-900'
        )}>
          {/* Placeholder Avatar Image or Initial */}
          <div className="bg-gradient-to-br from-gray-800 to-black w-full h-full flex items-center justify-center">
            <User className="w-10 h-10 text-gray-400" />
          </div>

          {/* Dealer Button */}
          {isDealer && (
            <div className="absolute top-0 right-0 bg-white text-black rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs border border-yellow-500 shadow-md z-20">
              D
            </div>
          )}
        </div>

        {/* Status Badge (Folded) */}
        {player.isFolded && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-full bg-black/70">
            <span className="text-white font-bold text-xs">FOLD</span>
          </div>
        )}
      </div>

      {/* Player Info (Name & Chips) */}
      <div className="z-20 bg-black/80 backdrop-blur-md border border-gray-600 rounded-lg px-3 py-1 text-center min-w-[100px] shadow-lg -mt-4">
        <div className="text-white font-bold text-sm truncate max-w-[90px]">{player.name}</div>
        <div className="text-yellow-400 text-xs font-mono">{formatChips(player.chips)}</div>
      </div>

      {/* Cards */}
      {cards.length > 0 && (
        <div className={cn(
          "absolute flex gap-1 z-10 transition-all duration-300",
          isHero ? "-top-24 scale-110" : "top-8 -right-12 scale-75"
        )}>
          {cards.map((card, idx) => (
            <div key={idx} className={cn("shadow-2xl", isHero && "hover:-translate-y-4 transition-transform")}>
              <PlayingCard
                rank={showCards || isHero ? card.rank : null}
                suit={showCards || isHero ? card.suit : null}
                faceDown={!showCards && !isHero}
              />
            </div>
          ))}
        </div>
      )}

      {/* Current Bet Bubble */}
      {player.currentBet > 0 && (
        <div className="absolute -bottom-8 bg-yellow-500 text-black font-bold px-3 py-1 rounded-full text-xs shadow-md border border-yellow-300 z-30 animate-bounce">
          {formatChips(player.currentBet)}
        </div>
      )}

    </div>
  );
}
