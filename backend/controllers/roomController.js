import { randomBytes, randomUUID } from "crypto";
import Room from "../models/room.js";

const generateRoomCode = () => {
  return randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
};

const getRoomByCode = async (roomCode) => {
  return Room.findOne({
    roomCode: roomCode.toUpperCase(),
  });
};

const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const createRoom = async (req, res) => {
  try {
    const { username, isPrivate = true, settings = {} } = req.body;

    if (
      typeof username !== "string" ||
      !username.trim() ||
      username.trim().length > 20
    ) {
      return res.status(400).json({
        message: "Username must be between 1 and 20 characters.",
      });
    }

    if (typeof isPrivate !== "boolean") {
      return res.status(400).json({
        message: "isPrivate must be true or false.",
      });
    }

    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      return res.status(400).json({
        message: "Invalid room settings.",
      });
    }

    const allowedSettings = [
      "maxPlayers",
      "rounds",
      "drawTime",
      "wordCount",
      "hints",
      "wordMode",
    ];

    const invalidSetting = Object.keys(settings).find(
      (key) => !allowedSettings.includes(key),
    );

    if (invalidSetting) {
      return res.status(400).json({
        message: `Invalid setting: ${invalidSetting}`,
      });
    }

    const defaults = {
      maxPlayers: 8,
      rounds: 3,
      drawTime: 80,
      wordCount: 3,
      hints: 2,
      wordMode: "Normal",
    };

    const finalSettings = { ...defaults, ...settings };

    const ranges = {
      maxPlayers: [2, 20],
      rounds: [2, 10],
      drawTime: [15, 240],
      wordCount: [1, 5],
      hints: [0, 5],
    };

    for (const [key, [min, max]] of Object.entries(ranges)) {
      const value = finalSettings[key];

      if (
        typeof value !== "number" ||
        !Number.isInteger(value) ||
        value < min ||
        value > max
      ) {
        return res.status(400).json({
          message: `${key} must be an integer between ${min} and ${max}.`,
        });
      }
    }

    if (!["Normal", "Hidden", "Combination"].includes(finalSettings.wordMode)) {
      return res.status(400).json({
        message: "Invalid word mode.",
      });
    }

    const playerId = randomUUID();

    let room;

    // Retry if a generated room code already exists.
    for (let attempt = 0; attempt < 5; attempt++) {
      const roomCode = generateRoomCode();

      try {
        room = await Room.create({
          roomCode,
          hostId: playerId,
          isPrivate,
          settings: finalSettings,
          players: [
            {
              playerId,
              username: username.trim(),
              isHost: true,
              isReady: false,
              isConnected: false,
              score: 0,
            },
          ],
        });

        break;
      } catch (error) {
        if (error.code !== 11000) {
          throw error;
        }
      }
    }

    if (!room) {
      return res.status(500).json({
        message: "Could not generate a room code. Please try again.",
      });
    }

    return res.status(201).json({
      message: "Room created successfully.",
      playerId,
      room,
    });
  } catch (error) {
    console.error("Create room error:", error.message);

    return res.status(500).json({
      message: "Failed to create room.",
    });
  }
};

export const joinRoom = async (req, res) => {
  try {
    const { roomCode } = req.params;
    const { username } = req.body;

    if (
      typeof roomCode !== "string" ||
      !roomCode.trim() ||
      typeof username !== "string" ||
      !username.trim() ||
      username.trim().length > 20
    ) {
      return res.status(400).json({
        message: "A valid room code and username are required.",
      });
    }

    const normalizedRoomCode = roomCode.trim().toUpperCase();
    const normalizedUsername = username.trim();
    const usernameRegex = new RegExp(
      `^${escapeRegex(normalizedUsername)}$`,
      "i",
    );

    const room = await getRoomByCode(normalizedRoomCode);

    if (!room) {
      return res.status(404).json({
        message: "Room not found.",
      });
    }

    if (room.status === "finished") {
      return res.status(400).json({
        message:
          "This game has finished. Wait for the host to start another game.",
      });
    }

    if (!["waiting", "playing"].includes(room.status)) {
      return res.status(400).json({
        message: "This room is currently unavailable.",
      });
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return res.status(400).json({
        message: "Room is full.",
      });
    }

    const playerId = randomUUID();

    /*
     * Atomically add the player.
     *
     * Allow both waiting and playing rooms.
     * Recheck the room status, player limit, and username
     * in the database query to reduce race conditions.
     */
    const updatedRoom = await Room.findOneAndUpdate(
      {
        roomCode: normalizedRoomCode,
        status: { $in: ["waiting", "playing"] },
        players: {
          $not: {
            $elemMatch: {
              username: usernameRegex,
            },
          },
        },
        $expr: {
          $lt: [{ $size: "$players" }, "$settings.maxPlayers"],
        },
      },
      {
        $push: {
          players: {
            playerId,
            username: normalizedUsername,
            isHost: false,
            isReady: false,
            isConnected: false,
            score: 0,
          },
        },
      },
      {
        returnDocument: "after",
        runValidators: true,
      },
    );

    if (!updatedRoom) {
      // Check the latest state to provide a useful error.
      const latestRoom = await getRoomByCode(normalizedRoomCode);

      if (!latestRoom) {
        return res.status(404).json({
          message: "Room not found.",
        });
      }

      if (latestRoom.status === "finished") {
        return res.status(400).json({
          message:
            "This game has finished. Wait for the host to start another game.",
        });
      }

      if (!["waiting", "playing"].includes(latestRoom.status)) {
        return res.status(400).json({
          message: "This room is currently unavailable.",
        });
      }

      if (latestRoom.players.length >= latestRoom.settings.maxPlayers) {
        return res.status(400).json({
          message: "Room is full.",
        });
      }

      const usernameTaken = latestRoom.players.some(
        (player) =>
          player.username.toLowerCase() === normalizedUsername.toLowerCase(),
      );

      if (usernameTaken) {
        return res.status(409).json({
          message: "This username is already taken in the room.",
        });
      }

      return res.status(400).json({
        message: "Unable to join this room. Please try again.",
      });
    }

    return res.status(200).json({
      message:
        updatedRoom.status === "playing"
          ? "Joined the ongoing game successfully."
          : "Joined room successfully.",
      playerId,
      room: updatedRoom,
    });
  } catch (error) {
    console.error("Join room error:", error.message);

    return res.status(500).json({
      message: "Failed to join room.",
    });
  }
};

export const getRoomDetails = async (req, res) => {
  try {
    const { roomCode } = req.params;

    const room = await getRoomByCode(roomCode);

    if (!room) {
      return res.status(404).json({
        message: "Room not found.",
      });
    }

    return res.status(200).json({
      room,
    });
  } catch (error) {
    console.error("Get room error:", error.message);

    return res.status(500).json({
      message: "Failed to get room details.",
    });
  }
};
