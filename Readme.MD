<div align="center">

# 🎨 SKRIBBL

### Draw it. Guess it. Win it. 🏆

**Your creativity. Your friends. One secret word.**

A real-time multiplayer drawing and guessing game built with the MERN stack and Socket.IO. Draw, guess, compete, and claim the crown! 👑

<br/>

[![Play Now](https://img.shields.io/badge/🎮_PLAY_NOW-7C3AED?style=for-the-badge)](https://skribble-io-vqa1.onrender.com)
[![React](https://img.shields.io/badge/React-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socketdotio&logoColor=white)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)](https://www.mongodb.com/)

### 🚀 [PLAY SKRIBBLE](https://skribble-io-vqa1.onrender.com)

</div>

---

## 🎮 About the Project

Skribbl is a multiplayer drawing game where one player draws a secret word while others race against the clock to guess it.

Earn points, climb the leaderboard, and discover who becomes the ultimate Skribble champion!

## ✨ Features

- 🎨 **Real-Time Drawing** — Synchronized canvas drawing using Socket.IO.
- 👥 **Multiplayer Rooms** — Join rooms and play with friends.
- 🔐 **Secret Words** — Keep the selected word hidden from guessers.
- 💬 **Live Chat & Guessing** — Send guesses and interact during gameplay.
- ⏱️ **Timers & Hints** — Race against time with helpful word hints.
- 🖌️ **Drawing Tools** — Draw, fill, undo, redo, and clear the canvas.
- 🏆 **Scoring & Winners** — Compete on the leaderboard with tie handling.
- 🔄 **Play Again** — Restart and enjoy another game.
- 📱 **Responsive UI** — Interactive interface for different screen sizes.

## 🛠️ Tech Stack

| Frontend     | Backend    | Database & Real-Time |
| ------------ | ---------- | -------------------- |
| React.js     | Node.js    | MongoDB              |
| Vite         | Express.js | Mongoose             |
| Tailwind CSS | Socket.IO  |                      |

**Deployment:** Render

## 📁 Project Structure

```text
Skribble/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── data/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   ├── .env
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
│
└── README.md
```

## ⚙️ Environment Variables

Create a `.env` file inside the `backend` directory.

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
CLIENT_URL=http://localhost:5173
```

| Variable     | Purpose                             |
| ------------ | ----------------------------------- |
| `PORT`       | Backend server port                 |
| `MONGO_URI`  | MongoDB connection string           |
| `CLIENT_URL` | Frontend URL for CORS configuration |

> Use the exact variable names expected by your code. Never commit `.env` files or database credentials to GitHub.

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd YOUR_PROJECT_FOLDER
```

### 2. Install Dependencies

**Backend:**

```bash
cd backend
npm install
```

**Frontend:** Open another terminal from the project root.

```bash
cd frontend
npm install
```

### 3. Configure Environment Variables

Create `backend/.env` and add your MongoDB connection string and other required variables.

### 4. Start the Backend

```bash
cd backend
npm start
```

### 5. Start the Frontend

In another terminal:

```bash
cd frontend
npm run dev
```

Open the local URL provided by Vite and start playing!

## 🌐 Deployment

Skribble is deployed on **Render**.

- **Frontend:** Deploy the Vite application as a Static Site.
- **Backend:** Deploy the Node.js/Express server as a Web Service.
- **Database:** Configure your MongoDB connection string.
- **Environment:** Set the required environment variables in Render.
- **Real-Time Communication:** Configure the frontend Socket.IO URL and backend CORS settings for production.

🎮 **Live Demo:** [Play Skribble](https://skribble-io-vqa1.onrender.com)

## 🔌 Socket Events

Socket.IO coordinates room activity, drawing, guesses, and game progression in real time.

| **Area**        | **Events**                                                                        |
| --------------- | --------------------------------------------------------------------------------- |
| Room & Players  | `room:ready`, `room:players`                                                      |
| Game Lifecycle  | `game:start`, `game:started`, `game:restore`, `game:finished`, `game:error`       |
| Word Selection  | `word:choices`, `word:select`, `word:selected`                                    |
| Rounds & Turns  | `round:started`, `turn:ended`                                                     |
| Timer & Hints   | `timer:update`, `hint:update`                                                     |
| Drawing         | `drawing:stroke`, `drawing:fill`, `drawing:clear`, `drawing:undo`, `drawing:redo` |
| Chat & Guessing | `chat:send`, `chat:message`                                                       |

The server coordinates game actions and protects secret words from players who are guessing.

## 🐛 Troubleshooting

| **Problem**                 | **Solution**                                                        |
| --------------------------- | ------------------------------------------------------------------- |
| `ERR_CONNECTION_REFUSED`    | Check the backend status and server URL.                            |
| MongoDB connection fails    | Verify the connection string, credentials, and network access.      |
| Socket.IO connection fails  | Check the server URL and CORS configuration.                        |
| Drawing or chat not syncing | Verify event names and client/server listeners.                     |
| Game does not start         | Check room state, player readiness, and game logic.                 |
| Slow initial loading        | Render's free-tier services may need time to wake after inactivity. |

## 🧠 What I Learned

- Real-time communication using Socket.IO.
- Multiplayer room and game-state management.
- Synchronizing drawing events across clients.
- Implementing timers, hints, scoring, and winner detection.
- Handling multiplayer edge cases and deployment.

---

<div align="center">

## 🎨 Ready to Challenge Your Friends?

### Draw Fast. Guess Smart. Win Big. 👑

<br/>

[![Play Skribble](https://img.shields.io/badge/🎮_PLAY_SKRIBBLE-Start_Your_Game-7C3AED?style=for-the-badge)](https://skribble-io-vqa1.onrender.com)

**If you enjoyed the project, give the repository a ⭐!**

_Built with ❤️ and a questionable amount of drawing talent._

</div>
