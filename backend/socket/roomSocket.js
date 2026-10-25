import Room from "../models/room.js";
import { handleGamePlayerLeft, handleGamePlayerJoined } from "./gameSocket.js";

const activeSockets = new Map();
const hostTimers = new Map();

const HOST_DISCONNECT_DELAY = 15000;

const getRoomPlayers = (room) => {
  return room.players.map((player) => ({
    playerId: player.playerId,
    username: player.username,
    isHost: player.isHost,
    isReady: player.isReady,
    isConnected: player.isConnected,
    score: player.score || 0,
  }));
};

const sendPlayersUpdate = async (io, roomCode) => {
  const room = await Room.findOne({ roomCode });

  if (!room) return;

  io.to(roomCode).emit("room:players", {
    players: getRoomPlayers(room),
  });
};

const clearHostTimer = (roomCode) => {
  const timer = hostTimers.get(roomCode);

  if (timer) {
    clearTimeout(timer);
    hostTimers.delete(roomCode);
  }
};

const assignHost = (room, player) => {
  if (!player) {
    room.hostId = null;

    room.players.forEach((item) => {
      item.isHost = false;
    });

    return;
  }

  room.hostId = player.playerId;

  room.players.forEach((item) => {
    item.isHost = item.playerId === player.playerId;
  });
};

const chooseNewHost = (room) => {
  const nextHost = room.players.find((player) => player.isConnected);

  assignHost(room, nextHost);

  return nextHost;
};

const scheduleHostTransfer = (io, roomCode, playerId) => {
  clearHostTimer(roomCode);

  const timer = setTimeout(async () => {
    hostTimers.delete(roomCode);

    try {
      const room = await Room.findOne({ roomCode });

      if (!room) return;

      const player = room.players.find((item) => item.playerId === playerId);

      if (!player || player.isConnected || room.hostId !== playerId) {
        return;
      }

      const nextHost = room.players.find(
        (item) => item.isConnected && item.playerId !== playerId,
      );

      if (!nextHost) {
        assignHost(room, null);

        await room.save();
        await sendPlayersUpdate(io, roomCode);

        return;
      }

      assignHost(room, nextHost);

      await room.save();

      io.to(roomCode).emit("room:host-changed", {
        playerId: nextHost.playerId,
        username: nextHost.username,
      });

      await sendPlayersUpdate(io, roomCode);

      console.log(
        `Host transferred in room ${roomCode} to ${nextHost.username}`,
      );
    } catch (error) {
      console.error("Host transfer error:", error.message);
    }
  }, HOST_DISCONNECT_DELAY);

  hostTimers.set(roomCode, timer);
};

const roomSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("room:join", async ({ roomCode, playerId } = {}) => {
      try {
        if (
          typeof roomCode !== "string" ||
          typeof playerId !== "string" ||
          !roomCode.trim() ||
          !playerId.trim()
        ) {
          socket.emit("room:error", {
            message: "Room code and player ID are required.",
          });

          return;
        }

        roomCode = roomCode.trim().toUpperCase();
        playerId = playerId.trim();

        const room = await Room.findOne({ roomCode });

        if (!room) {
          socket.emit("room:error", {
            message: "Room not found.",
          });

          return;
        }

        // Players cannot enter a finished game.
        if (room.status === "finished") {
          socket.emit("room:error", {
            message:
              "This game has finished. Wait for the host to start another game.",
          });

          return;
        }

        // The REST API must add new players to the room first.
        const player = room.players.find((item) => item.playerId === playerId);

        if (!player) {
          socket.emit("room:error", {
            message: "Player does not belong to this room.",
          });

          return;
        }

        // Leave a previous room if this socket changes rooms.
        if (socket.data.roomCode) {
          socket.leave(socket.data.roomCode);
        }

        const socketKey = `${roomCode}:${playerId}`;
        const previousSocketId = activeSockets.get(socketKey);

        // Register the new socket before disconnecting the old socket.
        activeSockets.set(socketKey, socket.id);

        if (previousSocketId && previousSocketId !== socket.id) {
          const previousSocket = io.sockets.sockets.get(previousSocketId);

          if (previousSocket) {
            previousSocket.disconnect(true);
          }
        }

        if (room.hostId === playerId) {
          clearHostTimer(roomCode);
        }

        player.isConnected = true;

        // Restore a valid host if the room currently has none.
        const currentHost = room.players.find(
          (item) => item.playerId === room.hostId && item.isHost,
        );

        if (!currentHost || !currentHost.isConnected) {
          chooseNewHost(room);
        }

        await room.save();

        socket.data.roomCode = roomCode;
        socket.data.playerId = playerId;

        await socket.join(roomCode);

        // Add new players to the ongoing game's turn order.
        // Existing players and the current turn remain unchanged.
        if (room.status === "playing") {
          await handleGamePlayerJoined(roomCode, playerId);
        }

        socket.emit("room:joined", {
          message: "Joined room successfully.",
          roomCode,
          status: room.status,
          currentRound: room.currentRound,
          currentDrawerId: room.currentDrawerId,
          players: getRoomPlayers(room),
          settings: room.settings,
        });

        await sendPlayersUpdate(io, roomCode);
      } catch (error) {
        console.error("Socket room join error:", error.message);

        socket.emit("room:error", {
          message: "Failed to join room.",
        });
      }
    });

    // Handle the Leave Room button.
    socket.on("room:leave", async () => {
      try {
        const { roomCode, playerId } = socket.data;

        if (!roomCode || !playerId) return;

        const room = await Room.findOne({ roomCode });

        if (!room) {
          socket.leave(roomCode);
          socket.data.roomCode = null;
          socket.data.playerId = null;

          socket.emit("room:left", {
            message: "You left the room.",
            roomCode,
          });

          return;
        }

        const playerIndex = room.players.findIndex(
          (item) => item.playerId === playerId,
        );

        if (playerIndex === -1) {
          socket.leave(roomCode);
          socket.data.roomCode = null;
          socket.data.playerId = null;

          socket.emit("room:left", {
            message: "You left the room.",
            roomCode,
          });

          return;
        }

        const leavingPlayer = room.players[playerIndex];

        const wasHost = room.hostId === playerId || leavingPlayer.isHost;

        room.players.splice(playerIndex, 1);

        const socketKey = `${roomCode}:${playerId}`;

        if (activeSockets.get(socketKey) === socket.id) {
          activeSockets.delete(socketKey);
        }

        clearHostTimer(roomCode);

        if (wasHost) {
          const nextHost = chooseNewHost(room);

          if (nextHost) {
            io.to(roomCode).emit("room:host-changed", {
              playerId: nextHost.playerId,
              username: nextHost.username,
            });
          }
        }

        if (room.players.length === 0) {
          await handleGamePlayerLeft(io, roomCode, playerId, true);

          await Room.deleteOne({ roomCode });

          io.to(roomCode).emit("room:empty");

          socket.emit("room:left", {
            message: "You left the room.",
            roomCode,
          });

          socket.leave(roomCode);
          socket.data.roomCode = null;
          socket.data.playerId = null;

          console.log(`Room ${roomCode} deleted because it is empty.`);

          return;
        }

        await room.save();

        await handleGamePlayerLeft(io, roomCode, playerId, false);

        io.to(roomCode).emit("room:player-left", {
          playerId,
          username: leavingPlayer.username,
        });

        socket.emit("room:left", {
          message: "You left the room.",
          roomCode,
        });

        socket.leave(roomCode);
        socket.data.roomCode = null;
        socket.data.playerId = null;

        await sendPlayersUpdate(io, roomCode);
      } catch (error) {
        console.error("Socket room leave error:", error.message);

        socket.emit("room:error", {
          message: "Failed to leave room.",
        });
      }
    });

    socket.on("disconnect", async () => {
      console.log("Player disconnected:", socket.id);

      const { roomCode, playerId } = socket.data;

      if (!roomCode || !playerId) return;

      const socketKey = `${roomCode}:${playerId}`;

      // Ignore an old socket disconnecting after a reconnect.
      if (activeSockets.get(socketKey) !== socket.id) return;

      activeSockets.delete(socketKey);

      try {
        const room = await Room.findOne({ roomCode });

        if (!room) return;

        const player = room.players.find((item) => item.playerId === playerId);

        if (!player) return;

        player.isConnected = false;

        await room.save();

        await sendPlayersUpdate(io, roomCode);

        if (room.hostId === playerId || player.isHost) {
          scheduleHostTransfer(io, roomCode, playerId);
        }
      } catch (error) {
        console.error("Socket disconnect error:", error.message);
      }
    });
  });
};

export default roomSocket;
