import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
  playerId: {
    type: String,
    required: true,
  },
  username: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20,
  },
  isHost: {
    type: Boolean,
    default: false,
  },
  isReady: {
    type: Boolean,
    default: false,
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  score: {
    type: Number,
    default: 0,
  },
});

const roomSchema = new mongoose.Schema(
  {
    roomCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    hostId: {
      type: String,
      required: true,
    },
    isPrivate: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
    },
    settings: {
      maxPlayers: {
        type: Number,
        default: 8,
        min: 2,
        max: 20,
      },
      rounds: {
        type: Number,
        default: 3,
        min: 2,
        max: 10,
      },
      drawTime: {
        type: Number,
        default: 80,
        min: 15,
        max: 240,
      },
      wordCount: {
        type: Number,
        default: 3,
        min: 1,
        max: 5,
      },
      hints: {
        type: Number,
        default: 2,
        min: 0,
        max: 5,
      },
      wordMode: {
        type: String,
        enum: ["Normal", "Hidden", "Combination"],
        default: "Normal",
      },
    },
    players: {
      type: [playerSchema],
      default: [],
    },
    currentRound: {
      type: Number,
      default: 0,
    },
    currentDrawerId: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

const Room = mongoose.models.Room || mongoose.model("Room", roomSchema);

export default Room;
