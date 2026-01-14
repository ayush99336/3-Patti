import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SettlementService {
    constructor() {
        this.provider = null;
        this.wallet = null;
        this.gameContract = null;
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🔐 Initializing settlement service with owner wallet...');

            // Validate required environment variables
            if (!process.env.OWNER_PRIVATE_KEY) {
                console.warn('⚠️  OWNER_PRIVATE_KEY not set - settlement service disabled');
                return false;
            }

            if (!process.env.GAME_CONTRACT_ADDRESS) {
                console.warn('⚠️  GAME_CONTRACT_ADDRESS not set - settlement service disabled');
                return false;
            }

            const rpcUrl = process.env.RPC_URL || 'https://sepolia.base.org';

            // Setup provider and wallet
            this.provider = new ethers.JsonRpcProvider(rpcUrl);
            this.wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, this.provider);

            // Test connection
            const network = await this.provider.getNetwork();
            const balance = await this.provider.getBalance(this.wallet.address);

            console.log(`✅ Connected to network: ${network.name} (Chain ID: ${network.chainId})`);
            console.log(`💰 Owner wallet: ${this.wallet.address}`);
            console.log(`💵 Balance: ${ethers.formatEther(balance)} ETH`);

            if (balance === 0n) {
                console.warn('⚠️  Warning: Owner wallet has 0 balance! Cannot send transactions.');
            }

            // Load contract ABI and initialize
            const gameABI = this.loadABI('TeenPattiGame');
            this.gameContract = new ethers.Contract(
                process.env.GAME_CONTRACT_ADDRESS,
                gameABI,
                this.wallet // Connected with wallet for write operations
            );

            console.log(`✅ Game contract loaded: ${process.env.GAME_CONTRACT_ADDRESS}`);

            this.initialized = true;
            console.log('🎉 Settlement service initialized successfully');
            return true;

        } catch (error) {
            console.error('❌ Failed to initialize settlement service:', error.message);
            return false;
        }
    }

    loadABI(contractName) {
        try {
            const abiPath = path.join(__dirname, 'abis', `${contractName}.json`);
            const abiFile = fs.readFileSync(abiPath, 'utf8');
            const artifact = JSON.parse(abiFile);
            return artifact.abi;
        } catch (error) {
            console.error(`Failed to load ABI for ${contractName}:`, error.message);
            throw error;
        }
    }

    /**
     * Settle a cash game with proportional payouts
     * @param {string} roomId - The blockchain room ID
     * @param {Array} playerChips - Array of {id: address, chips: number}
     * @returns {Promise<{success: boolean, txHash?: string, error?: string}>}
     */
    async settleCashGame(roomId, playerChips) {
        if (!this.initialized) {
            return { success: false, error: 'Settlement service not initialized' };
        }

        try {
            // Validate inputs
            if (!roomId || !playerChips || playerChips.length === 0) {
                return { success: false, error: 'Invalid input parameters' };
            }

            // Validate chip counts
            const hasInvalidChips = playerChips.some((pc) => {
                const chips = pc.chips;
                return (
                    !pc.id ||
                    typeof chips !== 'number' ||
                    !Number.isFinite(chips) ||
                    chips < 0 ||
                    !Number.isInteger(chips)
                );
            });

            if (hasInvalidChips) {
                console.error('Invalid chip amounts detected:', playerChips);
                return { success: false, error: 'Invalid chip amounts - must be positive integers' };
            }

            // Extract players and chips
            const players = playerChips.map(pc => pc.id);
            const finalChips = playerChips.map(pc => Math.floor(pc.chips));

            console.log('💰 Settling cash game:', {
                roomId,
                players: players.length,
                totalChips: finalChips.reduce((a, b) => a + b, 0)
            });

            // Send transaction
            const tx = await this.gameContract.settleCashGame(roomId, players, finalChips);
            console.log(`📤 Settlement transaction sent: ${tx.hash}`);

            // Wait for confirmation
            const receipt = await tx.wait();
            console.log(`✅ Settlement confirmed in block ${receipt.blockNumber}`);

            // Parse events to get payout details
            const payouts = this.parseSettlementEvent(receipt);

            return {
                success: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                payouts
            };

        } catch (error) {
            console.error('❌ Settlement failed:', error);

            let errorMessage = error.message;
            if (error.message.includes('Game not active')) {
                errorMessage = 'Game is not active or already settled';
            } else if (error.message.includes('insufficient funds')) {
                errorMessage = 'Insufficient funds for gas fees';
            }

            return { success: false, error: errorMessage };
        }
    }

    parseSettlementEvent(receipt) {
        try {
            const cashGameSettledEvent = receipt.logs
                .map(log => {
                    try {
                        return this.gameContract.interface.parseLog(log);
                    } catch (e) {
                        return null;
                    }
                })
                .find(event => event && event.name === 'CashGameSettled');

            if (cashGameSettledEvent) {
                return {
                    players: cashGameSettledEvent.args.players,
                    payouts: cashGameSettledEvent.args.payouts.map(p => p.toString()),
                    rake: cashGameSettledEvent.args.rake.toString()
                };
            }
        } catch (error) {
            console.warn('Could not parse settlement event:', error.message);
        }
        return null;
    }

    isInitialized() {
        return this.initialized;
    }

    getWalletAddress() {
        return this.wallet ? this.wallet.address : null;
    }
}

// Singleton instance
const settlementService = new SettlementService();

export default settlementService;
