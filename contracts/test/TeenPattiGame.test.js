const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TeenPattiGame", function () {
  let token;
  let game;
  let owner;
  let treasury;
  let player1;
  let player2;
  let player3;

  beforeEach(async function () {
    [owner, treasury, player1, player2, player3] = await ethers.getSigners();

    // Deploy token
    const TeenPattiToken = await ethers.getContractFactory("TeenPattiToken");
    token = await TeenPattiToken.deploy(treasury.address);
    await token.waitForDeployment();

    // Deploy game
    const TeenPattiGame = await ethers.getContractFactory("TeenPattiGame");
    game = await TeenPattiGame.deploy(await token.getAddress(), treasury.address);
    await game.waitForDeployment();

    // Give tokens to players
    const tokenAmount = ethers.parseEther("10000");
    await token.mint(player1.address, tokenAmount);
    await token.mint(player2.address, tokenAmount);
    await token.mint(player3.address, tokenAmount);

    // Approve game contract
    await token.connect(player1).approve(await game.getAddress(), tokenAmount);
    await token.connect(player2).approve(await game.getAddress(), tokenAmount);
    await token.connect(player3).approve(await game.getAddress(), tokenAmount);
  });

  describe("Deployment", function () {
    it("Should set the right token", async function () {
      expect(await game.token()).to.equal(await token.getAddress());
    });

    it("Should set the right treasury", async function () {
      expect(await game.treasury()).to.equal(treasury.address);
    });

    it("Should set default rake fee", async function () {
      expect(await game.rakeFee()).to.equal(500); // 5%
    });
  });

  describe("Room Creation", function () {
    it("Should allow creating a room", async function () {
      const buyIn = ethers.parseEther("100");
      const maxPlayers = 4;

      const tx = await game.connect(player1).createRoom(buyIn, maxPlayers);
      const receipt = await tx.wait();

      // Find RoomCreated event
      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      expect(event).to.not.be.undefined;
    });

    it("Should transfer buy-in from creator", async function () {
      const buyIn = ethers.parseEther("100");
      const balanceBefore = await token.balanceOf(player1.address);

      await game.connect(player1).createRoom(buyIn, 4);

      const balanceAfter = await token.balanceOf(player1.address);
      expect(balanceAfter).to.equal(balanceBefore - buyIn);
    });

    it("Should revert if buy-in is zero", async function () {
      await expect(
        game.connect(player1).createRoom(0, 4)
      ).to.be.revertedWith("Buy-in must be positive");
    });

    it("Should revert if max players invalid", async function () {
      const buyIn = ethers.parseEther("100");

      await expect(
        game.connect(player1).createRoom(buyIn, 1)
      ).to.be.revertedWith("Invalid max players");

      await expect(
        game.connect(player1).createRoom(buyIn, 7)
      ).to.be.revertedWith("Invalid max players");
    });
  });

  describe("Joining Room", function () {
    let roomId;

    beforeEach(async function () {
      const buyIn = ethers.parseEther("100");
      const tx = await game.connect(player1).createRoom(buyIn, 4);
      const receipt = await tx.wait();

      // Extract roomId from event
      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = game.interface.parseLog(event);
      roomId = parsedEvent.args.roomId;
    });

    it("Should allow joining a room", async function () {
      await expect(game.connect(player2).joinRoom(roomId))
        .to.emit(game, "PlayerJoined");
    });

    it("Should transfer buy-in from joining player", async function () {
      const balanceBefore = await token.balanceOf(player2.address);
      const buyIn = ethers.parseEther("100");

      await game.connect(player2).joinRoom(roomId);

      const balanceAfter = await token.balanceOf(player2.address);
      expect(balanceAfter).to.equal(balanceBefore - buyIn);
    });

    it("Should increase pot when player joins", async function () {
      const detailsBefore = await game.getRoomDetails(roomId);

      await game.connect(player2).joinRoom(roomId);

      const detailsAfter = await game.getRoomDetails(roomId);
      expect(detailsAfter.pot).to.be.gt(detailsBefore.pot);
    });

    it("Should revert if player already joined", async function () {
      await game.connect(player2).joinRoom(roomId);

      await expect(
        game.connect(player2).joinRoom(roomId)
      ).to.be.revertedWith("Already joined this room");
    });

    it("Should revert if room is full", async function () {
      // Create room with max 2 players
      const buyIn = ethers.parseEther("100");
      const tx = await game.connect(player1).createRoom(buyIn, 2);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = game.interface.parseLog(event);
      const fullRoomId = parsedEvent.args.roomId;

      // Second player joins
      await game.connect(player2).joinRoom(fullRoomId);

      // Third player should fail
      await expect(
        game.connect(player3).joinRoom(fullRoomId)
      ).to.be.revertedWith("Room is full");
    });
  });

  describe("Starting Game", function () {
    let roomId;

    beforeEach(async function () {
      const buyIn = ethers.parseEther("100");
      const tx = await game.connect(player1).createRoom(buyIn, 4);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = game.interface.parseLog(event);
      roomId = parsedEvent.args.roomId;

      // Add second player
      await game.connect(player2).joinRoom(roomId);
    });

    it("Should allow creator to start game", async function () {
      await expect(game.connect(player1).startGame(roomId))
        .to.emit(game, "GameStarted");
    });

    it("Should allow owner to start game", async function () {
      await expect(game.connect(owner).startGame(roomId))
        .to.emit(game, "GameStarted");
    });

    it("Should revert if not enough players", async function () {
      // Create new room with only 1 player
      const buyIn = ethers.parseEther("100");
      const tx = await game.connect(player3).createRoom(buyIn, 4);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = game.interface.parseLog(event);
      const newRoomId = parsedEvent.args.roomId;

      await expect(
        game.connect(player3).startGame(newRoomId)
      ).to.be.revertedWith("Need at least 2 players");
    });
  });

  describe("Declaring Winner", function () {
    let roomId;

    beforeEach(async function () {
      const buyIn = ethers.parseEther("100");
      const tx = await game.connect(player1).createRoom(buyIn, 4);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = game.interface.parseLog(event);
      roomId = parsedEvent.args.roomId;

      await game.connect(player2).joinRoom(roomId);
      await game.connect(owner).startGame(roomId);
    });

    it("Should allow owner to declare winner", async function () {
      await expect(game.connect(owner).declareWinner(roomId, player1.address))
        .to.emit(game, "WinnerDeclared");
    });

    it("Should transfer winnings to winner", async function () {
      const balanceBefore = await token.balanceOf(player1.address);

      await game.connect(owner).declareWinner(roomId, player1.address);

      const balanceAfter = await token.balanceOf(player1.address);
      expect(balanceAfter).to.be.gt(balanceBefore);
    });

    it("Should collect rake to treasury", async function () {
      const treasuryBalanceBefore = await token.balanceOf(treasury.address);

      await game.connect(owner).declareWinner(roomId, player1.address);

      const treasuryBalanceAfter = await token.balanceOf(treasury.address);
      expect(treasuryBalanceAfter).to.be.gt(treasuryBalanceBefore);
    });

    it("Should update total rake collected", async function () {
      const rakeBefore = await game.totalRakeCollected();

      await game.connect(owner).declareWinner(roomId, player1.address);

      const rakeAfter = await game.totalRakeCollected();
      expect(rakeAfter).to.be.gt(rakeBefore);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update rake fee", async function () {
      await game.updateRakeFee(300);
      expect(await game.rakeFee()).to.equal(300);
    });

    it("Should revert if rake fee too high", async function () {
      await expect(
        game.updateRakeFee(1100)
      ).to.be.revertedWith("Rake fee too high");
    });

    it("Should allow owner to pause", async function () {
      await game.pause();
      expect(await game.paused()).to.equal(true);
    });

    it("Should prevent room creation when paused", async function () {
      await game.pause();

      await expect(
        game.connect(player1).createRoom(ethers.parseEther("100"), 4)
      ).to.be.revertedWithCustomError(game, "EnforcedPause");
    });
  });

  describe("Cash Game Settlement", function () {
    let roomId;

    beforeEach(async function () {
      const buyIn = ethers.parseEther("100");
      const tx = await game.connect(player1).createRoom(buyIn, 4);
      const receipt = await tx.wait();

      const event = receipt.logs.find(log => {
        try {
          return game.interface.parseLog(log).name === "RoomCreated";
        } catch {
          return false;
        }
      });

      const parsedEvent = game.interface.parseLog(event);
      roomId = parsedEvent.args.roomId;

      await game.connect(player2).joinRoom(roomId);
      await game.connect(player3).joinRoom(roomId);
      await game.connect(owner).startGame(roomId);
    });

    it("Should settle with proportional payouts", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [5000, 3000, 2000]; // 50%, 30%, 20%

      await expect(game.connect(owner).settleCashGame(roomId, players, finalChips))
        .to.emit(game, "CashGameSettled");
    });

    it("Should distribute tokens proportionally", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [6000, 3000, 1000]; // 60%, 30%, 10%

      const balance1Before = await token.balanceOf(player1.address);
      const balance2Before = await token.balanceOf(player2.address);
      const balance3Before = await token.balanceOf(player3.address);

      await game.connect(owner).settleCashGame(roomId, players, finalChips);

      const balance1After = await token.balanceOf(player1.address);
      const balance2After = await token.balanceOf(player2.address);
      const balance3After = await token.balanceOf(player3.address);

      // Player 1 should get ~60%, player 2 ~30%, player 3 ~10%
      const gain1 = balance1After - balance1Before;
      const gain2 = balance2After - balance2Before;
      const gain3 = balance3After - balance3Before;

      // Check proportions (allowing for rounding)
      expect(gain1).to.be.gt(gain2);
      expect(gain2).to.be.gt(gain3);
    });

    it("Should apply rake correctly", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [5000, 3000, 2000];

      const treasuryBefore = await token.balanceOf(treasury.address);

      await game.connect(owner).settleCashGame(roomId, players, finalChips);

      const treasuryAfter = await token.balanceOf(treasury.address);
      expect(treasuryAfter).to.be.gt(treasuryBefore);
    });

    it("Should handle equal chip distribution", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [3333, 3333, 3334]; // Equal split

      await expect(game.connect(owner).settleCashGame(roomId, players, finalChips))
        .to.emit(game, "CashGameSettled");
    });

    it("Should handle winner-takes-all scenario", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [10000, 0, 0]; // Winner has all chips

      const balance1Before = await token.balanceOf(player1.address);

      await game.connect(owner).settleCashGame(roomId, players, finalChips);

      const balance1After = await token.balanceOf(player1.address);
      expect(balance1After).to.be.gt(balance1Before);
    });

    it("Should revert if arrays mismatch", async function () {
      const players = [player1.address, player2.address];
      const finalChips = [5000, 3000, 2000]; // Mismatch

      await expect(
        game.connect(owner).settleCashGame(roomId, players, finalChips)
      ).to.be.revertedWith("Array length mismatch");
    });

    it("Should revert if total chips is zero", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [0, 0, 0];

      await expect(
        game.connect(owner).settleCashGame(roomId, players, finalChips)
      ).to.be.revertedWith("Total chips must be greater than zero");
    });

    it("Should revert if game not active", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [5000, 3000, 2000];

      // Settle once
      await game.connect(owner).settleCashGame(roomId, players, finalChips);

      // Try to settle again
      await expect(
        game.connect(owner).settleCashGame(roomId, players, finalChips)
      ).to.be.revertedWith("Game not active");
    });

    it("Should set winner to player with most chips", async function () {
      const players = [player1.address, player2.address, player3.address];
      const finalChips = [2000, 6000, 2000]; // Player 2 has most

      await game.connect(owner).settleCashGame(roomId, players, finalChips);

      const details = await game.getRoomDetails(roomId);
      expect(details.winner).to.equal(player2.address);
    });
  });
});
