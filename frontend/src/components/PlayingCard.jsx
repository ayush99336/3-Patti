import React from 'react';
import { cn } from '@/lib/utils';

export default function PlayingCard({ rank, suit, faceDown = false, className }) {
  // Get card image filename
  const getCardImage = () => {
    if (faceDown || !rank || !suit) {
      return '/cards/back_of_card.jpg';
    }

    // Normalize suit to single character
    const suitMap = {
      'hearts': 'h', 'h': 'h', '♥': 'h',
      'diamonds': 'd', 'd': 'd', '♦': 'd',
      'clubs': 'c', 'c': 'c', '♣': 'c',
      'spades': 's', 's': 's', '♠': 's'
    };

    const normalizedSuit = suit ? suit.toLowerCase() : '';
    const suitChar = suitMap[normalizedSuit] || normalizedSuit.charAt(0);

    // Normalize rank
    const rankMap = {
      'A': 'a', 'a': 'a', '1': 'a', 'ace': 'a',
      'J': 'j', 'j': 'j', 'jack': 'j',
      'Q': 'q', 'q': 'q', 'queen': 'q',
      'K': 'k', 'k': 'k', 'king': 'k',
      '10': '10', '2': '2', '3': '3', '4': '4',
      '5': '5', '6': '6', '7': '7', '8': '8', '9': '9'
    };

    const rankStr = rank ? rank.toString() : '';
    const rankChar = rankMap[rankStr] || rankMap[rankStr.toLowerCase()] || rankStr.toLowerCase();

    // Build filename: rank + suit + .png (e.g., "ah.png", "10d.png")
    return `/cards/${rankChar}${suitChar}.png`;
  };

  const cardImage = getCardImage();

  return (
    <div className={cn(
      'card relative w-20 h-28 md:w-24 md:h-36 rounded-xl shadow-xl overflow-hidden select-none bg-white',
      className
    )}>
      <img
        src={cardImage}
        alt={faceDown ? 'Card back' : `${rank} of ${suit}`}
        className="w-full h-full object-cover"
        style={{
          imageRendering: 'high-quality', // Hint for browser to use better scaling
          transform: 'translateZ(0)', // Force GPU layer to reduce jitter/aliasing
          backfaceVisibility: 'hidden',
        }}
        onError={(e) => {
          // Fallback to card back if image fails to load
          console.error(`Failed to load card image: ${cardImage}`);
          e.target.src = '/cards/back_of_card.jpg';
        }}
      />
    </div>
  );
}
