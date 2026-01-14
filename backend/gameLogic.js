// Teen Patti Game Logic

// Card ranks and suits
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

// Hand rankings (higher is better)
const HAND_RANKINGS = {
  HIGH_CARD: 0,
  PAIR: 1,
  COLOR: 2,
  SEQUENCE: 3,
  PURE_SEQUENCE: 4,
  TRIO: 5
};

export class Card {
  constructor(rank, suit) {
    this.rank = rank;
    this.suit = suit;
  }

  getValue() {
    return RANKS.indexOf(this.rank);
  }
}

export class Deck {
  constructor() {
    this.cards = [];
    this.reset();
  }

  reset() {
    this.cards = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        this.cards.push(new Card(rank, suit));
      }
    }
    this.shuffle();
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal() {
    return this.cards.pop();
  }
}

export class Player {
  constructor(id, name, socketId, chips = 1000000) {
    this.id = id;
    this.name = name;
    this.socketId = socketId;
    this.cards = [];
    this.chips = chips;
    this.currentBet = 0;
    this.totalBet = 0;
    this.isActive = true;
    this.isFolded = false;
    this.isBlind = true;
    this.hasSeenCards = false;
  }

  addCard(card) {
    this.cards.push(card);
  }

  seeCards() {
    this.hasSeenCards = true;
    this.isBlind = false;
  }

  fold() {
    this.isFolded = true;
    this.isActive = false;
  }

  bet(amount) {
    const betAmount = Math.min(amount, this.chips);
    this.chips -= betAmount;
    this.currentBet = betAmount;
    this.totalBet += betAmount;
    return betAmount;
  }

  reset() {
    this.cards = [];
    this.currentBet = 0;
    this.totalBet = 0;
    this.isActive = true;
    this.isFolded = false;
    this.isBlind = true;
    this.hasSeenCards = false;
  }
}

export class Game {
  constructor(roomId, minPlayers = 2, maxPlayers = 6) {
    this.roomId = roomId;
    this.players = [];
    this.deck = new Deck();
    this.pot = 0;
    this.currentBet = 0;
    this.minBet = 10;
    this.currentPlayerIndex = 0;
    this.dealerIndex = 0;
    this.gameStarted = false;
    this.minPlayers = minPlayers;
    this.maxPlayers = maxPlayers;
    this.roundNumber = 0;
  }

  addPlayer(player) {
    if (this.players.length >= this.maxPlayers) {
      return false;
    }
    this.players.push(player);
    return true;
  }

  removePlayer(playerId) {
    const index = this.players.findIndex(p => p.id === playerId);
    if (index !== -1) {
      this.players.splice(index, 1);
      return true;
    }
    return false;
  }

  getPlayer(playerId) {
    return this.players.find(p => p.id === playerId);
  }

  canStartGame() {
    return this.players.length >= this.minPlayers && !this.gameStarted;
  }

  startGame() {
    if (!this.canStartGame()) {
      return false;
    }

    this.gameStarted = true;
    this.deck.reset();
    this.pot = 0;
    this.currentBet = this.minBet;
    this.roundNumber = 0;

    // Reset all players
    this.players.forEach(player => player.reset());

    // Deal 3 cards to each player
    for (let i = 0; i < 3; i++) {
      this.players.forEach(player => {
        player.addCard(this.deck.deal());
      });
    }

    // Collect ante from all players
    this.players.forEach(player => {
      const ante = player.bet(this.minBet);
      this.pot += ante;
    });

    // Set first player after dealer
    this.currentPlayerIndex = (this.dealerIndex + 1) % this.players.length;

    return true;
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getActivePlayers() {
    return this.players.filter(p => p.isActive && !p.isFolded);
  }

  nextPlayer() {
    // Safety check: ensure there are active players
    const activePlayers = this.getActivePlayers();
    if (activePlayers.length <= 1) {
      // Game should end; attempting to advance turn is a logic error
      throw new Error(`Cannot advance turn: only ${activePlayers.length} active player(s) remain. Game should have ended.`);
    }

    let count = 0;
    do {
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      count++;
      if (count > this.players.length) {
        console.error('nextPlayer: No active players found! This should not happen.');
        throw new Error('No active non-folded players found');
      }
    } while (this.players[this.currentPlayerIndex].isFolded);

    this.roundNumber++;
  }

  playerAction(playerId, action, amount = 0) {
    const player = this.getPlayer(playerId);
    if (!player || player.id !== this.getCurrentPlayer().id) {
      return { success: false, error: 'Not your turn' };
    }

    switch (action) {
      case 'fold':
        player.fold();
        this.nextPlayer();
        return { success: true };

      case 'see':
        player.seeCards();
        return { success: true };

      case 'bet':
      case 'chaal':
        // Logic to determine valid bet range
        // 1. Current Bet is always tracked in "Seen" units (effectively). 
        //    If a Blind player bets 10, currentBet becomes 10.
        //    If a Seen player matches, they must bet 20.
        //    If a Seen player raises, they might bet 40.

        // However, the standard usually implies:
        // - Blind player bets X.
        // - Next Blind player must bet X (or 2X to raise).
        // - Next Seen player must bet 2X (to match) or 4X (to raise).

        // Let's simplify:
        // currentBet is the amount the LAST player put in.
        // We need to know if the LAST player was Blind or Seen to normalize the "stake".

        // Actually, a simpler model used in many apps:
        // `currentBet` stores the value for a SEEN player.
        // If a Blind player plays, they pay `currentBet / 2`.
        // If a Seen player plays, they pay `currentBet`.

        // Let's stick to the existing variable `currentBet` representing the "table stake" for a SEEN player.
        // If the pot starts with 10 (boot), `currentBet` is 10 (Seen equivalent).
        // Blind player pays 5. Seen player pays 10.

        // BUT, the current implementation seems to store the raw amount.
        // Let's fix it to be robust:

        // "currentBet" = The amount a SEEN player must pay to call/chaal.
        // If a Blind player is playing, they pay half of "currentBet".

        // Let's refactor `startGame` to set `currentBet` = `minBet`.
        // And `minBet` is usually the boot amount.
        // So if boot is 10. `currentBet` = 10.
        // Blind player pays 5? Or is boot treated as a Blind bet?
        // Usually Boot = 1 unit. Blind = 1 unit. Seen = 2 units.

        // Let's assume `currentBet` is the amount a SEEN player needs to put.

        // Pot Limit Check (Standard Teen Patti Rule: 1024x Boot)
        const POT_LIMIT = this.minBet * 1024;
        if (this.pot >= POT_LIMIT) {
          return { success: false, error: 'Pot limit reached. You must Show.' };
        }

        let requiredAmount = this.currentBet;
        if (player.isBlind) {
          requiredAmount = this.currentBet / 2;
        }

        // Allow raise (double the stake)
        const minBet = requiredAmount;
        const maxBet = requiredAmount * 2;

        // Verify amount
        // Allow "All-In" if chips < minBet but > 0
        if (player.chips < minBet) {
          if (amount !== player.chips) {
            return { success: false, error: `You must go ShowDown or All-In with ${player.chips}` };
          }
          // All-in logic: Side pots would be needed for true correctness, 
          // but for now we just let them bet what they have.
          // We do NOT update currentBet because they couldn't match the stake.
        } else {
          if (amount !== minBet && amount !== maxBet) {
            return { success: false, error: `Invalid bet amount. You must bet ${minBet} (Chaal) or ${maxBet} (Raise).` };
          }

          // Update Table Stake (currentBet) only if it's a valid raise/call
          let newSeenStake = amount;
          if (player.isBlind) {
            newSeenStake = amount * 2;
          }
          this.currentBet = Math.max(this.currentBet, newSeenStake);
        }

        const betAmount = player.bet(amount);
        this.pot += betAmount;
        this.nextPlayer();
        return { success: true };

      case 'pack':
        player.fold();
        this.nextPlayer();
        return { success: true };

      default:
        return { success: false, error: 'Invalid action' };
    }
  }

  checkWinner() {
    const activePlayers = this.getActivePlayers();

    if (activePlayers.length === 1) {
      return activePlayers[0];
    }

    if (activePlayers.length === 0) {
      return null;
    }

    return null;
  }

  compareHands(player1, player2) {
    const hand1 = this.evaluateHand(player1.cards);
    const hand2 = this.evaluateHand(player2.cards);

    if (hand1.rank !== hand2.rank) {
      return hand1.rank > hand2.rank ? player1 : player2;
    }

    // Compare high cards
    for (let i = 0; i < hand1.values.length; i++) {
      if (hand1.values[i] !== hand2.values[i]) {
        return hand1.values[i] > hand2.values[i] ? player1 : player2;
      }
    }

    return null; // Tie
  }

  evaluateHand(cards) {
    const sortedCards = [...cards].sort((a, b) => b.getValue() - a.getValue());
    const values = sortedCards.map(c => c.getValue());
    const suits = sortedCards.map(c => c.suit);

    // Check for Trio (Three of a kind)
    if (values[0] === values[1] && values[1] === values[2]) {
      return { rank: HAND_RANKINGS.TRIO, values };
    }

    // Check for sequence
    const sequenceResult = this.isSequence(values);
    const isFlush = suits[0] === suits[1] && suits[1] === suits[2];

    // Pure Sequence (Straight Flush)
    if (sequenceResult.isSequence && isFlush) {
      return { rank: HAND_RANKINGS.PURE_SEQUENCE, values: sequenceResult.compareValues };
    }

    // Sequence (Straight)
    if (sequenceResult.isSequence) {
      return { rank: HAND_RANKINGS.SEQUENCE, values: sequenceResult.compareValues };
    }

    // Color (Flush)
    if (isFlush) {
      return { rank: HAND_RANKINGS.COLOR, values };
    }

    // Pair - properly order values for comparison (pair cards first, then kicker)
    if (values[0] === values[1]) {
      // Pair at top: [K, K, 2] -> keep as is
      return { rank: HAND_RANKINGS.PAIR, values: [values[0], values[1], values[2]] };
    } else if (values[1] === values[2]) {
      // Pair at bottom: [K, 5, 5] -> rearrange to [5, 5, K]
      return { rank: HAND_RANKINGS.PAIR, values: [values[1], values[2], values[0]] };
    } else if (values[0] === values[2]) {
      // Pair at ends: [K, 5, K] -> rearrange to [K, K, 5]
      return { rank: HAND_RANKINGS.PAIR, values: [values[0], values[2], values[1]] };
    }

    // High Card
    return { rank: HAND_RANKINGS.HIGH_CARD, values };
  }

  isSequence(values) {
    // Check for A-2-3 (special case - LOWEST sequence in Teen Patti)
    // Values are sorted descending: A=12, 3=1, 2=0
    if (values[0] === 12 && values[1] === 1 && values[2] === 0) {
      // Return adjusted values to make A-2-3 compare as lowest sequence
      // Use -1 values so it's lower than 2-3-4 (values [1,0,-1])
      return {
        isSequence: true,
        compareValues: [-1, -1, -1]  // Makes it lowest for comparison
      };
    }

    // Check for regular sequence (K-Q-J, Q-J-10, etc.)
    if (values[0] === values[1] + 1 && values[1] === values[2] + 1) {
      return { isSequence: true, compareValues: values };
    }

    return { isSequence: false, compareValues: values };
  }

  endGame(winner) {
    if (winner) {
      winner.chips += this.pot;
    }

    this.gameStarted = false;
    this.dealerIndex = (this.dealerIndex + 1) % this.players.length;

    return {
      winner: winner ? winner.id : null,
      pot: this.pot,
      playerChips: this.players.map(p => ({ id: p.id, chips: p.chips }))
    };
  }

  getGameState() {
    return {
      roomId: this.roomId,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        currentBet: p.currentBet,
        totalBet: p.totalBet,
        isFolded: p.isFolded,
        isBlind: p.isBlind,
        hasSeenCards: p.hasSeenCards,
        cardCount: p.cards.length
      })),
      pot: this.pot,
      currentBet: this.currentBet,
      currentPlayerIndex: this.currentPlayerIndex,
      gameStarted: this.gameStarted,
      roundNumber: this.roundNumber
    };
  }

  getPlayerCards(playerId) {
    const player = this.getPlayer(playerId);
    return player ? player.cards : [];
  }
}
