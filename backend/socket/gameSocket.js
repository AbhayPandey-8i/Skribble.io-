import Room from "../models/room.js";
import words from "../data/words.js";

const activeWords = new Map();
const pendingWordChoices = new Map();
const gameStates = new Map();
const roundTimers = new Map();
const remainingSeconds = new Map();
const correctGuessers = new Map();
const endingTurns = new Set();
const hintStates = new Map();
const drawingHistory = new Map();

const getPlayers = (room) => {
  return room.players.map((player) => ({
    playerId: player.playerId,
    username: player.username,
    isHost: player.isHost,
    isReady: player.isReady,
    isConnected: player.isConnected,
    score: player.score || 0,
  }));
};

const sendPlayersUpdate = (io, room) => {
  io.to(room.roomCode).emit("room:players", {
    players: getPlayers(room),
  });
};

const getPlayerSocket = (io, roomCode, playerId) => {
  return [...io.sockets.sockets.values()].find(
    (connectedSocket) =>
      connectedSocket.data.playerId === playerId &&
      connectedSocket.data.roomCode === roomCode,
  );
};

const getRandomWords = (count) => {
  const shuffledWords = [...new Set(words)].sort(() => Math.random() - 0.5);

  return shuffledWords.slice(0, Math.min(count, shuffledWords.length));
};

const getHintPattern = (word, revealedIndexes) => {
  return word
    .split("")
    .map((letter, index) => {
      if (letter === " ") return " ";

      return revealedIndexes.includes(index) ? letter : "_";
    })
    .join(" ");
};

const revealHint = (word, revealedIndexes) => {
  const availableIndexes = word
    .split("")
    .map((letter, index) => ({ letter, index }))
    .filter(
      ({ letter, index }) => letter !== " " && !revealedIndexes.includes(index),
    )
    .map(({ index }) => index);

  if (availableIndexes.length === 0) {
    return revealedIndexes;
  }

  const randomIndex = Math.floor(Math.random() * availableIndexes.length);

  return [...revealedIndexes, availableIndexes[randomIndex]];
};

const clearRoundTimer = (roomCode) => {
  const timer = roundTimers.get(roomCode);

  if (timer) {
    clearInterval(timer);
    roundTimers.delete(roomCode);
  }

  remainingSeconds.delete(roomCode);
};

const clearDrawingHistory = (roomCode) => {
  drawingHistory.set(roomCode, []);
};

const clearTurnData = (roomCode) => {
  activeWords.delete(roomCode);
  pendingWordChoices.delete(roomCode);
  correctGuessers.delete(roomCode);
  hintStates.delete(roomCode);
  endingTurns.delete(roomCode);
};

const cleanupGameRoom = (roomCode) => {
  clearRoundTimer(roomCode);

  activeWords.delete(roomCode);
  pendingWordChoices.delete(roomCode);
  gameStates.delete(roomCode);
  correctGuessers.delete(roomCode);
  endingTurns.delete(roomCode);
  hintStates.delete(roomCode);
  drawingHistory.delete(roomCode);
};

const updateHint = (io, roomCode, secondsLeft) => {
  const hintState = hintStates.get(roomCode);

  if (!hintState || hintState.hintsToReveal <= 0) return;

  if (hintState.hintsRevealed >= hintState.hintsToReveal) {
    return;
  }

  const nextHintNumber = hintState.hintsRevealed + 1;

  const threshold =
    (hintState.drawTime * (hintState.hintsToReveal + 1 - nextHintNumber)) /
    (hintState.hintsToReveal + 1);

  if (secondsLeft > threshold) return;

  hintState.revealedLetters = revealHint(
    hintState.word,
    hintState.revealedLetters,
  );

  hintState.hintsRevealed += 1;

  io.to(roomCode).emit("hint:update", {
    pattern: getHintPattern(hintState.word, hintState.revealedLetters),
    hintsRevealed: hintState.hintsRevealed,
    totalHints: hintState.hintsToReveal,
  });
};

const startPlayerTurn = async (io, roomCode) => {
  try {
    clearRoundTimer(roomCode);
    clearDrawingHistory(roomCode);
    clearTurnData(roomCode);

    io.to(roomCode).emit("drawing:clear");

    const room = await Room.findOne({ roomCode });
    const game = gameStates.get(roomCode);

    if (!room || !game || room.status !== "playing") {
      return;
    }

    // Only connected players can take a drawing turn.
    const connectedGamePlayers = game.playerIds.filter((playerId) =>
      room.players.some(
        (player) => player.playerId === playerId && player.isConnected,
      ),
    );

    if (connectedGamePlayers.length < 2) {
      room.status = "waiting";
      room.currentRound = 0;
      room.currentDrawerId = null;

      room.players.forEach((player) => {
        player.isReady = false;
        player.score = 0;
      });

      await room.save();

      cleanupGameRoom(roomCode);

      io.to(roomCode).emit("game:returned-to-lobby", {
        message:
          "Not enough connected players remain. The game has returned to the lobby.",
      });

      sendPlayersUpdate(io, room);
      return;
    }

    // Advance to the next round after everyone has had a turn.
    if (game.turnIndex >= game.playerIds.length) {
      if (game.roundNumber >= Number(room.settings.rounds)) {
        room.status = "finished";
        room.currentDrawerId = null;

        await room.save();

        const finalPlayers = getPlayers(room).sort((a, b) => b.score - a.score);

        let currentRank = 1;

        const rankings = finalPlayers.map((player, index) => {
          if (index > 0 && player.score < finalPlayers[index - 1].score) {
            currentRank = index + 1;
          }

          return {
            ...player,
            rank: currentRank,
          };
        });

        cleanupGameRoom(roomCode);

        io.to(roomCode).emit("game:finished", {
          message: "Game finished!",
          rankings,
          totalRounds: Number(room.settings.rounds),
        });

        sendPlayersUpdate(io, room);
        return;
      }

      game.roundNumber += 1;
      game.turnIndex = 0;
    }

    const drawerId = game.playerIds[game.turnIndex];

    const drawer = room.players.find((player) => player.playerId === drawerId);

    // Skip players who left or disconnected.
    if (!drawer || !drawer.isConnected) {
      game.turnIndex += 1;
      await startPlayerTurn(io, roomCode);
      return;
    }

    room.currentRound = game.roundNumber;
    room.currentDrawerId = drawerId;

    await room.save();

    const requestedCount = Number(room.settings.wordCount) || 3;

    const choices = getRandomWords(Math.max(2, Math.min(5, requestedCount)));

    if (choices.length < 2) {
      io.to(roomCode).emit("game:error", {
        message: "Not enough words are available.",
      });

      return;
    }

    pendingWordChoices.set(roomCode, {
      drawerId,
      choices,
    });

    io.to(roomCode).emit("round:started", {
      phase: "choosing",
      roundNumber: game.roundNumber,
      totalRounds: Number(room.settings.rounds),
      drawer: {
        playerId: drawer.playerId,
        username: drawer.username,
      },
      drawTime: Number(room.settings.drawTime),
    });

    const drawerSocket = getPlayerSocket(io, roomCode, drawerId);

    if (drawerSocket) {
      drawerSocket.emit("word:choices", {
        words: choices,
      });
    }

    sendPlayersUpdate(io, room);
  } catch (error) {
    console.error("Start player turn error:", error.message);
  }
};

const endPlayerTurn = async (io, roomCode) => {
  if (endingTurns.has(roomCode)) return;

  endingTurns.add(roomCode);
  clearRoundTimer(roomCode);

  try {
    const room = await Room.findOne({ roomCode });
    const game = gameStates.get(roomCode);

    if (!room || !game || room.status !== "playing") {
      endingTurns.delete(roomCode);
      return;
    }

    const word = activeWords.get(roomCode) || null;

    io.to(roomCode).emit("turn:ended", {
      word,
      roundNumber: game.roundNumber,
      drawerId: room.currentDrawerId,
    });

    game.turnIndex += 1;

    await startPlayerTurn(io, roomCode);
  } catch (error) {
    endingTurns.delete(roomCode);
    console.error("End player turn error:", error.message);
  }
};

const startRoundTimer = (io, roomCode, drawTime) => {
  clearRoundTimer(roomCode);

  let secondsLeft = Math.max(1, Number(drawTime) || 80);

  remainingSeconds.set(roomCode, secondsLeft);

  io.to(roomCode).emit("timer:update", {
    secondsLeft,
  });

  const timer = setInterval(async () => {
    secondsLeft -= 1;
    remainingSeconds.set(roomCode, secondsLeft);

    if (secondsLeft > 0) {
      updateHint(io, roomCode, secondsLeft);

      io.to(roomCode).emit("timer:update", {
        secondsLeft,
      });

      return;
    }

    clearRoundTimer(roomCode);

    io.to(roomCode).emit("timer:update", {
      secondsLeft: 0,
    });

    await endPlayerTurn(io, roomCode);
  }, 1000);

  roundTimers.set(roomCode, timer);
};

const sendGameResults = (socket, room) => {
  const sortedPlayers = getPlayers(room).sort((a, b) => b.score - a.score);

  let currentRank = 1;

  const rankings = sortedPlayers.map((player, index) => {
    if (index > 0 && player.score < sortedPlayers[index - 1].score) {
      currentRank = index + 1;
    }

    return {
      ...player,
      rank: currentRank,
    };
  });

  socket.emit("game:finished", {
    rankings,
    totalRounds: Number(room.settings.rounds),
  });
};

/*
 * Called by roomSocket.js when a player leaves.
 * This is a server-side function, not a client socket event.
 */

/*
 * Add a newly joined player to an ongoing game.
 * The current drawing turn and timer are not interrupted.
 */
export const handleGamePlayerJoined = async (roomCode, playerId) => {
  try {
    const room = await Room.findOne({ roomCode });

    if (!room || room.status !== "playing") {
      return;
    }

    const game = gameStates.get(roomCode);

    if (!game) {
      console.error(
        `Cannot add player ${playerId}: game state for ${roomCode} is unavailable.`,
      );

      return;
    }

    // Prevent duplicate entries in the turn order.
    if (game.playerIds.includes(playerId)) {
      return;
    }

    const player = room.players.find((item) => item.playerId === playerId);

    if (!player || !player.isConnected) {
      return;
    }

    if (game.playerIds.length >= room.settings.maxPlayers) {
      return;
    }

    // Add the new player at the end of the turn order.
    game.playerIds.push(playerId);

    console.log(
      `${player.username} joined the ongoing game in room ${roomCode}.`,
    );
  } catch (error) {
    console.error("Add player to ongoing game error:", error.message);
  }
};

export const handleGamePlayerLeft = async (
  io,
  roomCode,
  playerId,
  roomEmpty = false,
) => {
  if (roomEmpty) {
    cleanupGameRoom(roomCode);
    return;
  }

  const room = await Room.findOne({ roomCode });

  if (!room) {
    cleanupGameRoom(roomCode);
    return;
  }

  const game = gameStates.get(roomCode);

  // Stop the game if fewer than two connected players remain.
  if (
    room.status === "playing" &&
    room.players.filter((player) => player.isConnected).length < 2
  ) {
    room.status = "waiting";
    room.currentRound = 0;
    room.currentDrawerId = null;

    room.players.forEach((player) => {
      player.isReady = false;
      player.score = 0;
    });

    await room.save();

    cleanupGameRoom(roomCode);

    io.to(roomCode).emit("game:returned-to-lobby", {
      message: "Not enough players remain. The game has returned to the lobby.",
    });

    sendPlayersUpdate(io, room);
    return;
  }

  if (!game) return;

  const playerIndex = game.playerIds.indexOf(playerId);

  if (playerIndex === -1) return;

  const wasDrawer = room.currentDrawerId === playerId;

  // Remove the departing player from the turn order.
  game.playerIds.splice(playerIndex, 1);

  // Adjust the turn index when an earlier player leaves.
  if (playerIndex < game.turnIndex) {
    game.turnIndex -= 1;
  }

  // If the drawer left, immediately advance to the next turn.
  if (!wasDrawer) return;

  clearRoundTimer(roomCode);

  const word = activeWords.get(roomCode) || null;

  io.to(roomCode).emit("turn:ended", {
    word,
    roundNumber: game.roundNumber,
    drawerId: playerId,
  });

  clearTurnData(roomCode);
  clearDrawingHistory(roomCode);

  io.to(roomCode).emit("drawing:clear");

  if (game.playerIds.length === 0) {
    cleanupGameRoom(roomCode);
    return;
  }

  await startPlayerTurn(io, roomCode);
};

const gameSocket = (io) => {
  io.on("connection", (socket) => {
    // Restore the game and drawing after a page refresh.
    socket.on("game:restore", async () => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) return;

        const room = await Room.findOne({ roomCode });

        if (!room) return;

        const player = room.players.find((item) => item.playerId === playerId);

        if (!player) return;

        if (room.status === "waiting") return;

        if (room.status === "finished") {
          sendGameResults(socket, room);
          return;
        }

        const game = gameStates.get(roomCode);

        if (!game) {
          socket.emit("game:error", {
            message:
              "The game state is unavailable. The server may have restarted.",
          });

          return;
        }

        const drawer = room.players.find(
          (item) => item.playerId === room.currentDrawerId,
        );

        if (!drawer) return;

        const pending = pendingWordChoices.get(roomCode);
        const word = activeWords.get(roomCode);

        const phase = word ? "drawing" : pending ? "choosing" : null;

        if (!phase) return;

        socket.emit("game:started", {
          message: "Game restored.",
          roomCode,
          status: room.status,
          currentRound: room.currentRound,
          totalRounds: Number(room.settings.rounds),
          players: getPlayers(room),
        });

        socket.emit("round:started", {
          phase,
          roundNumber: game.roundNumber,
          totalRounds: Number(room.settings.rounds),
          drawer: {
            playerId: drawer.playerId,
            username: drawer.username,
          },
          drawTime: Number(room.settings.drawTime),
        });

        if (phase === "choosing" && playerId === drawer.playerId) {
          socket.emit("word:choices", {
            words: pending.choices,
          });
        }

        if (phase === "drawing") {
          if (playerId === drawer.playerId) {
            socket.emit("word:selected", { word });
          }

          const hintState = hintStates.get(roomCode);

          if (hintState) {
            socket.emit("hint:update", {
              pattern: getHintPattern(
                hintState.word,
                hintState.revealedLetters,
              ),
              hintsRevealed: hintState.hintsRevealed,
              totalHints: hintState.hintsToReveal,
            });
          }

          socket.emit("timer:update", {
            secondsLeft:
              remainingSeconds.get(roomCode) ?? Number(room.settings.drawTime),
          });
        }

        socket.emit("drawing:restore", {
          history: drawingHistory.get(roomCode) || [],
        });
      } catch (error) {
        console.error("Game restore error:", error.message);

        socket.emit("game:error", {
          message: "Failed to restore the game.",
        });
      }
    });

    // Update a player's ready status in the lobby.
    socket.on("room:ready", async ({ isReady } = {}) => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) {
          socket.emit("game:error", {
            message: "Join a room first.",
          });

          return;
        }

        if (typeof isReady !== "boolean") {
          socket.emit("game:error", {
            message: "isReady must be true or false.",
          });

          return;
        }

        const room = await Room.findOne({ roomCode });

        if (!room || room.status !== "waiting") {
          socket.emit("game:error", {
            message: "Room is unavailable or the game has started.",
          });

          return;
        }

        const player = room.players.find((item) => item.playerId === playerId);

        if (!player || !player.isConnected) {
          socket.emit("game:error", {
            message: "Player not found or not connected.",
          });

          return;
        }

        player.isReady = isReady;

        await room.save();
        sendPlayersUpdate(io, room);
      } catch (error) {
        console.error("Ready event error:", error.message);

        socket.emit("game:error", {
          message: "Failed to update ready status.",
        });
      }
    });

    // Start a game from the lobby.
    socket.on("game:start", async () => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) {
          socket.emit("game:error", {
            message: "Join a room first.",
          });

          return;
        }

        const room = await Room.findOne({ roomCode });

        if (!room || room.status !== "waiting") {
          socket.emit("game:error", {
            message: "Room is unavailable or the game has already started.",
          });

          return;
        }

        if (room.hostId !== playerId) {
          socket.emit("game:error", {
            message: "Only the host can start the game.",
          });

          return;
        }

        const connectedPlayers = room.players.filter(
          (player) => player.isConnected,
        );

        if (connectedPlayers.length < 2) {
          socket.emit("game:error", {
            message: "At least two connected players are required.",
          });

          return;
        }

        const allReady = connectedPlayers.every((player) => player.isReady);

        if (!allReady) {
          socket.emit("game:error", {
            message: "All connected players must be ready.",
          });

          return;
        }

        if (!Array.isArray(words) || words.length < 2) {
          socket.emit("game:error", {
            message: "At least two words are required to start.",
          });

          return;
        }

        room.players.forEach((player) => {
          player.score = 0;
        });

        room.status = "playing";
        room.currentRound = 1;
        room.currentDrawerId = connectedPlayers[0].playerId;

        await room.save();

        cleanupGameRoom(roomCode);

        gameStates.set(roomCode, {
          playerIds: connectedPlayers.map((player) => player.playerId),
          turnIndex: 0,
          roundNumber: 1,
        });

        io.to(roomCode).emit("game:started", {
          message: "Game started successfully.",
          roomCode,
          status: room.status,
          currentRound: room.currentRound,
          totalRounds: Number(room.settings.rounds),
          players: getPlayers(room),
        });

        sendPlayersUpdate(io, room);

        await startPlayerTurn(io, roomCode);
      } catch (error) {
        console.error("Start game error:", error.message);

        socket.emit("game:error", {
          message: "Failed to start the game.",
        });
      }
    });

    // Restart the finished game in the same room.
    socket.on("game:play-again", async () => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) {
          socket.emit("game:error", {
            message: "Join a room first.",
          });

          return;
        }

        const room = await Room.findOne({ roomCode });

        if (!room) {
          socket.emit("game:error", {
            message: "Room not found.",
          });

          return;
        }

        if (room.status !== "finished") {
          socket.emit("game:error", {
            message: "The current game has not finished.",
          });

          return;
        }

        if (room.hostId !== playerId) {
          socket.emit("game:error", {
            message: "Only the host can start another game.",
          });

          return;
        }

        // Clear all timers and temporary data from the previous game.
        cleanupGameRoom(roomCode);

        // Reset the room without removing its players or changing its code.
        room.status = "waiting";
        room.currentRound = 0;
        room.currentDrawerId = null;

        room.players.forEach((player) => {
          player.score = 0;
          player.isReady = false;
        });

        await room.save();

        // Tell every player in this room to display the lobby again.
        io.to(roomCode).emit("game:returned-to-lobby", {
          message:
            "A new game is ready! Everyone must mark themselves ready before the host can start.",
        });

        // Refresh the player list, scores, and ready statuses.
        sendPlayersUpdate(io, room);
      } catch (error) {
        console.error("Play again error:", error.message);

        socket.emit("game:error", {
          message: "Failed to restart the game. Please try again.",
        });
      }
    });

    // The drawer selects one of the offered words.
    socket.on("word:select", async ({ word } = {}) => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId || typeof word !== "string") {
          return;
        }

        const room = await Room.findOne({ roomCode });
        const pending = pendingWordChoices.get(roomCode);

        if (
          !room ||
          room.status !== "playing" ||
          room.currentDrawerId !== playerId ||
          !pending ||
          pending.drawerId !== playerId ||
          !pending.choices.includes(word)
        ) {
          socket.emit("game:error", {
            message: "That word choice is not valid.",
          });

          return;
        }

        activeWords.set(roomCode, word);
        pendingWordChoices.delete(roomCode);
        correctGuessers.set(roomCode, new Set());

        const hintsToReveal = Math.max(
          0,
          Math.min(5, Number(room.settings.hints) || 0),
        );

        hintStates.set(roomCode, {
          word,
          drawTime: Number(room.settings.drawTime) || 80,
          hintsToReveal,
          hintsRevealed: 0,
          revealedLetters: [],
        });

        clearDrawingHistory(roomCode);

        io.to(roomCode).emit("drawing:clear");

        io.to(roomCode).emit("hint:update", {
          pattern: getHintPattern(word, []),
          hintsRevealed: 0,
          totalHints: hintsToReveal,
        });

        io.to(roomCode).emit("round:started", {
          phase: "drawing",
          roundNumber: room.currentRound,
          totalRounds: Number(room.settings.rounds),
          drawer: {
            playerId,
            username: room.players.find(
              (player) => player.playerId === playerId,
            )?.username,
          },
          drawTime: Number(room.settings.drawTime),
        });

        socket.emit("word:selected", { word });

        startRoundTimer(io, roomCode, room.settings.drawTime);
      } catch (error) {
        console.error("Word selection error:", error.message);

        socket.emit("game:error", {
          message: "Failed to select the word.",
        });
      }
    });

    // Send drawing strokes to the other players and save them for restoration.
    socket.on("drawing:stroke", async (stroke) => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId || !stroke) return;

        const validNumbers = [
          stroke.x0,
          stroke.y0,
          stroke.x1,
          stroke.y1,
          stroke.width,
        ].every((value) => typeof value === "number" && Number.isFinite(value));

        if (
          typeof stroke.color !== "string" ||
          !/^#[0-9a-fA-F]{6}$/.test(stroke.color) ||
          !validNumbers ||
          typeof stroke.strokeId !== "string" ||
          stroke.strokeId.length > 100 ||
          stroke.width < 1 ||
          stroke.width > 60 ||
          [stroke.x0, stroke.y0, stroke.x1, stroke.y1].some(
            (value) => value < 0 || value > 900,
          )
        ) {
          return;
        }

        const room = await Room.findOne({ roomCode });

        if (
          !room ||
          room.status !== "playing" ||
          room.currentDrawerId !== playerId ||
          !activeWords.has(roomCode)
        ) {
          return;
        }

        let history = drawingHistory.get(roomCode);

        if (!history) {
          history = [];
          drawingHistory.set(roomCode, history);
        }

        let action = history[history.length - 1];

        if (
          !action ||
          action.type !== "stroke" ||
          action.strokeId !== stroke.strokeId
        ) {
          action = {
            type: "stroke",
            strokeId: stroke.strokeId,
            strokes: [],
          };

          history.push(action);
        }

        action.strokes.push({
          x0: stroke.x0,
          y0: stroke.y0,
          x1: stroke.x1,
          y1: stroke.y1,
          color: stroke.color,
          width: stroke.width,
          erase: Boolean(stroke.erase),
        });

        if (history.length > 300) {
          history.shift();
        }

        socket.to(roomCode).emit("drawing:stroke", stroke);
      } catch (error) {
        console.error("Drawing stroke error:", error.message);
      }
    });

    // Fill an area on the canvas.
    socket.on("drawing:fill", async (data) => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId || !data) return;

        const { x, y, color } = data;

        if (
          typeof x !== "number" ||
          typeof y !== "number" ||
          !Number.isFinite(x) ||
          !Number.isFinite(y) ||
          typeof color !== "string" ||
          !/^#[0-9a-fA-F]{6}$/.test(color) ||
          x < 0 ||
          y < 0 ||
          x >= 900 ||
          y >= 500
        ) {
          return;
        }

        const room = await Room.findOne({ roomCode });

        if (
          !room ||
          room.status !== "playing" ||
          room.currentDrawerId !== playerId ||
          !activeWords.has(roomCode)
        ) {
          return;
        }

        let history = drawingHistory.get(roomCode);

        if (!history) {
          history = [];
          drawingHistory.set(roomCode, history);
        }

        history.push({
          type: "fill",
          x,
          y,
          color,
        });

        if (history.length > 300) {
          history.shift();
        }

        socket.to(roomCode).emit("drawing:fill", {
          x,
          y,
          color,
        });
      } catch (error) {
        console.error("Drawing fill error:", error.message);
      }
    });

    // Clear the canvas.
    socket.on("drawing:clear", async () => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) return;

        const room = await Room.findOne({ roomCode });

        if (
          !room ||
          room.status !== "playing" ||
          room.currentDrawerId !== playerId ||
          !activeWords.has(roomCode)
        ) {
          return;
        }

        clearDrawingHistory(roomCode);
        io.to(roomCode).emit("drawing:clear");
      } catch (error) {
        console.error("Drawing clear error:", error.message);
      }
    });

    // Undo the last drawing action.
    socket.on("drawing:undo", async () => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) return;

        const room = await Room.findOne({ roomCode });

        if (
          !room ||
          room.status !== "playing" ||
          room.currentDrawerId !== playerId ||
          !activeWords.has(roomCode)
        ) {
          return;
        }

        const history = drawingHistory.get(roomCode) || [];

        if (history.length > 0) {
          history.pop();
        }

        drawingHistory.set(roomCode, history);

        io.to(roomCode).emit("drawing:undo", {
          history,
        });
      } catch (error) {
        console.error("Drawing undo error:", error.message);
      }
    });

    // Handle chat messages and correct guesses.
    socket.on("chat:send", async ({ message } = {}) => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId || typeof message !== "string") {
          return;
        }

        const text = message.trim().slice(0, 200);

        if (!text) return;

        const room = await Room.findOne({ roomCode });

        if (
          !room ||
          room.status !== "playing" ||
          !activeWords.has(roomCode) ||
          endingTurns.has(roomCode)
        ) {
          return;
        }

        const player = room.players.find((item) => item.playerId === playerId);

        if (!player || room.currentDrawerId === playerId) {
          return;
        }

        const guessedPlayers = correctGuessers.get(roomCode);

        if (guessedPlayers?.has(playerId)) {
          return;
        }

        const selectedWord = activeWords.get(roomCode);
        const correct = text.toLowerCase() === selectedWord.toLowerCase();

        if (!correct) {
          io.to(roomCode).emit("chat:message", {
            username: player.username,
            message: text,
            correct: false,
          });

          return;
        }

        let currentGuessers = correctGuessers.get(roomCode);

        if (!currentGuessers) {
          currentGuessers = new Set();
          correctGuessers.set(roomCode, currentGuessers);
        }

        currentGuessers.add(playerId);
        player.score = (player.score || 0) + 100;

        const drawer = room.players.find(
          (item) => item.playerId === room.currentDrawerId,
        );

        if (drawer) {
          drawer.score = (drawer.score || 0) + 50;
        }

        await room.save();
        sendPlayersUpdate(io, room);

        io.to(roomCode).emit("chat:message", {
          username: player.username,
          message: "Guessed the word correctly!",
          correct: true,
        });

        const eligiblePlayers = room.players.filter(
          (item) => item.isConnected && item.playerId !== room.currentDrawerId,
        );

        const everyoneGuessed =
          eligiblePlayers.length > 0 &&
          eligiblePlayers.every((item) => currentGuessers.has(item.playerId));

        if (everyoneGuessed) {
          await endPlayerTurn(io, roomCode);
        }
      } catch (error) {
        console.error("Chat message error:", error.message);
      }
    });
  });
};

export default gameSocket;
