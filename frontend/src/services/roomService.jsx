import axios from "axios";

const API_URL = "http://localhost:5000/api/rooms";

export const createRoom = async (roomData) => {
  const response = await axios.post(API_URL, roomData);
  return response.data;
};

export const joinRoom = async (roomCode, username) => {
  const response = await axios.post(`${API_URL}/${roomCode}/join`, {
    username,
  });

  return response.data;
};
