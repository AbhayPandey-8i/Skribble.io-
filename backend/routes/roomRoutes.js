import express from "express";
import {
  createRoom,
  joinRoom,
  getRoomDetails,
} from "../controllers/roomController.js";

const router = express.Router();

router.route("/").post(createRoom);

router.route("/:roomCode/join").post(joinRoom);

router.route("/:roomCode").get(getRoomDetails);

export default router;
