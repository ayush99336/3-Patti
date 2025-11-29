import React from 'react';
import { cn } from '@/lib/utils';

export default function PlayingCard({ rank, suit, faceDown = false, className }) {
  if (faceDown) {
    return (
      <div className={cn(
        'card relative w-14 h-20 md:w-16 md:h-24 rounded-lg shadow-xl overflow-hidden',
        className
      )}>
        <img
          src="/cards/back_of_card.jpg"
          alt="Card Back"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  // Map suit symbols/names to filenames if necessary
  // Assuming filenames are like "2h.jpg", "kc.jpg" etc.
  // rank: 2, 3, ..., 10, J, Q, K, A
  // suit: spades, hearts, diamonds, clubs (or symbols)

  // Helper to convert rank/suit to filename format
  const getCardFilename = (r, s) => {
    if (!r || !s) return 'back_of_card.jpg';

    const rankMap = { '10': '10', 'J': 'j', 'Q': 'q', 'K': 'k', 'A': 'a' };
    const suitMap = { 'spades': 's', 'hearts': 'h', 'diamonds': 'd', 'clubs': 'c', '♠': 's', '♥': 'h', '♦': 'd', '♣': 'c' };

    const rankCode = rankMap[r] || r.toString().toLowerCase();
    const suitCode = suitMap[s.toLowerCase()] || s.charAt(0).toLowerCase();

    return `${rankCode}${suitCode}.jpg`;
  };

  const filename = getCardFilename(rank, suit);

  return (
    <div className={cn(
      'card relative w-14 h-20 md:w-16 md:h-24 rounded-lg shadow-xl overflow-hidden bg-white',
      className
    )}>
      <img
        src={`/cards/${filename}`}
        alt={`${rank} of ${suit}`}
        className="w-full h-full object-contain"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = '/cards/back_of_card.jpg'; // Fallback
        }}
      />
    </div>
  );
}
