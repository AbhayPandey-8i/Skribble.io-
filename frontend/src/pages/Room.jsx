import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import DrawingGame from "../components/DrawingGame";
import Scoreboard from "../components/Scoreboard";
import GameFinished from "../components/GameFinished";

const SOCKET_URL = "http://localhost:5000";

/* ---------- UI-only helpers (no app logic) ---------- */

const AVATAR_STYLES = [
  "bg-amber-200 text-amber-800",
  "bg-sky-200 text-sky-800",
  "bg-emerald-200 text-emerald-800",
  "bg-rose-200 text-rose-800",
  "bg-violet-200 text-violet-800",
];

const avatarStyle = (name = "") =>
  AVATAR_STYLES[(name.charCodeAt(0) || 0) % AVATAR_STYLES.length];

const Room = () => {
  const { roomCode } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState("");
  const [gameStarted, setGameStarted] = useState(false);
  const [roundInfo, setRoundInfo] = useState(null);
  const [secretWord, setSecretWord] = useState("");
  const [gameResult, setGameResult] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);

  const [gameSettings, setGameSettings] = useState({
    rounds: 3,
    drawTime: 80,
  });

  const playerId =
    location.state?.playerId || sessionStorage.getItem("playerId");

  const username =
    location.state?.username || sessionStorage.getItem("username");

  useEffect(() => {
    if (!playerId || !username) {
      navigate("/");
      return;
    }

    sessionStorage.setItem("playerId", playerId);
    sessionStorage.setItem("username", username);

    const newSocket = io(SOCKET_URL);

    setSocket(newSocket);

    newSocket.on("connect", () => {
      newSocket.emit("room:join", { roomCode, playerId });
    });

    newSocket.on("room:joined", (data) => {
      setPlayers(data.players || []);

      if (data.settings) {
        setGameSettings({
          rounds: data.settings.rounds ?? 3,
          drawTime: data.settings.drawTime ?? 80,
        });
      }

      setError("");
      setIsLeaving(false);

      if (data.status === "playing") {
        setGameStarted(true);
        setGameResult(null);
      } else if (data.status === "finished") {
        newSocket.emit("game:restore");
      } else {
        setGameStarted(false);
        setGameResult(null);
      }

      newSocket.emit("game:restore");
    });

    newSocket.on("room:players", (data) => {
      const updatedPlayers = data.players || [];

      setPlayers(updatedPlayers);

      const currentPlayer = updatedPlayers.find(
        (player) => player.playerId === playerId,
      );

      if (currentPlayer) {
        setIsReady(currentPlayer.isReady);
      }
    });

    // Navigate home only after the server confirms the player has left.
    newSocket.on("room:left", () => {
      navigate("/");
    });

    newSocket.on("room:error", (data) => {
      setError(data.message);
      setIsLeaving(false);
    });

    newSocket.on("game:error", (data) => {
      setError(data.message);
    });

    newSocket.on("game:started", () => {
      setGameStarted(true);
      setGameResult(null);
      setError("");
    });

    newSocket.on("round:started", (data) => {
      setGameStarted(true);
      setRoundInfo(data);
      setSecretWord("");
      setError("");

      if (data.totalRounds != null) {
        setGameSettings((previous) => ({
          ...previous,
          rounds: data.totalRounds,
        }));
      }

      if (data.drawTime != null) {
        setGameSettings((previous) => ({
          ...previous,
          drawTime: data.drawTime,
        }));
      }
    });

    newSocket.on("word:selected", (data) => {
      setSecretWord(data.word);
    });

    newSocket.on("game:finished", (data) => {
      setGameResult(data);
      setGameStarted(true);
      setError("");
    });

    // Return to the lobby when fewer than two players remain.
    newSocket.on("game:returned-to-lobby", (data) => {
      setGameStarted(false);
      setRoundInfo(null);
      setSecretWord("");
      setGameResult(null);
      setError(data.message);
    });

    newSocket.on("disconnect", () => {
      setError("Disconnected from server. Reconnecting...");
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomCode, playerId, username, navigate]);

  const currentPlayer = players.find((player) => player.playerId === playerId);

  const isHost = currentPlayer?.isHost;

  const leaveRoom = () => {
    if (isLeaving) return;

    if (!socket || !socket.connected) {
      setError(
        "You are disconnected. Please wait for the connection to return.",
      );
      return;
    }

    setError("");
    setIsLeaving(true);
    socket.emit("room:leave");
  };

  const toggleReady = () => {
    if (!socket || isLeaving) return;

    setError("");
    socket.emit("room:ready", { isReady: !isReady });
  };

  const startGame = () => {
    if (!socket || isLeaving) return;

    setError("");
    socket.emit("game:start");
  };

  const copyRoomCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      setError("Could not copy room code. Please copy it manually.");
    }
  };

  if (!playerId || !username) {
    return null;
  }

  /* ---------- display-only values derived from existing state ---------- */

  const connectedPlayers = players.filter((player) => player.isConnected);
  const startDisabled =
    isLeaving ||
    players.filter((player) => player.isConnected).length < 2 ||
    players.some((player) => player.isConnected && !player.isReady);

  const readyCount = connectedPlayers.filter((player) => player.isReady).length;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#dfe5fb] px-4 py-8 text-slate-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .skb-font { font-family: 'Manrope', ui-sans-serif, system-ui, 'Segoe UI', sans-serif; }
        @keyframes skb-rise {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skb-rise { animation: skb-rise .5s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .skb-rise { animation: none; }
        }
      `}</style>

      {/* flat colour shapes behind the content */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 h-72 w-72 rounded-full bg-amber-300/50"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-sky-300/50"
      />

      <div className="skb-font relative mx-auto max-w-7xl">
        {/* ---------- header ---------- */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button
            onClick={leaveRoom}
            disabled={isLeaving}
            className="flex items-center gap-3 rounded-xl text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:opacity-50"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-[0_8px_18px_-8px_rgba(79,70,229,0.9)]">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
              </svg>
            </span>
            <span className="text-xl font-extrabold tracking-tight text-indigo-950">
              Skribble
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 rounded-2xl bg-white py-2 pl-4 pr-2 shadow-[0_10px_30px_-18px_rgba(55,48,163,0.6)]">
              <div>
                <p className="text-xs font-medium text-slate-500">Room code</p>
                <p className="text-lg font-extrabold leading-tight tracking-[0.2em] text-indigo-700">
                  {roomCode}
                </p>
              </div>

              <button
                onClick={copyRoomCode}
                className="flex h-10 items-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-bold text-slate-900 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50 active:scale-[0.98]"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M7 3a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H7Z" />
                  <path d="M3 7a2 2 0 0 1 1-1.73V13a4 4 0 0 0 4 4h6.73A2 2 0 0 1 13 18H8a5 5 0 0 1-5-5V7Z" />
                </svg>
                Copy
              </button>
            </div>

            <button
              onClick={leaveRoom}
              disabled={isLeaving}
              className="h-[58px] rounded-2xl bg-rose-500 px-5 font-bold text-white shadow-[0_10px_24px_-12px_rgba(244,63,94,0.9)] transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLeaving ? "Leaving..." : "Leave Room"}
            </button>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <svg
              className="mt-0.5 h-4 w-4 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-.75-11.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4Zm.75 7.25a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {gameResult ? (
          <GameFinished
            rankings={gameResult.rankings || []}
            totalRounds={gameResult.totalRounds || gameSettings.rounds}
            onBack={leaveRoom}
          />
        ) : !gameStarted ? (
          <div className="skb-rise grid gap-6 md:grid-cols-[1fr_320px]">
            {/* ---------- lobby (white card) ---------- */}
            <section className="rounded-3xl bg-white p-6 shadow-[0_24px_60px_-30px_rgba(55,48,163,0.5)] sm:p-8">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-extrabold tracking-tight text-indigo-950">
                    Game Lobby
                  </h1>
                  <p className="mt-1 text-slate-500">
                    Waiting for everyone to get ready.
                  </p>
                </div>

                {players.length > 0 && (
                  <span className="shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                    {readyCount}/{connectedPlayers.length} ready
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {players.map((player) => (
                  <div
                    key={player.playerId}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-indigo-50/70 p-3.5 ring-1 ring-indigo-100"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        aria-hidden="true"
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold ${avatarStyle(
                          player.username,
                        )}`}
                      >
                        {(player.username || "?")[0].toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {player.username}
                          {player.playerId === playerId && (
                            <span className="font-medium text-slate-400">
                              {" "}
                              (You)
                            </span>
                          )}
                        </p>

                        {player.isHost && (
                          <span className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            <svg
                              className="h-3 w-3"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              aria-hidden="true"
                            >
                              <path d="M10 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L10 14.3 5.2 16.9l.9-5.4L2.2 7.7l5.4-.8z" />
                            </svg>
                            Host
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        !player.isConnected
                          ? "bg-slate-200 text-slate-600"
                          : player.isReady
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-200 text-amber-900"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          !player.isConnected
                            ? "bg-slate-400"
                            : player.isReady
                              ? "bg-white"
                              : "bg-amber-600"
                        }`}
                      />
                      {!player.isConnected
                        ? "Disconnected"
                        : player.isReady
                          ? "Ready"
                          : "Not ready"}
                    </span>
                  </div>
                ))}

                {players.length === 0 && (
                  <div className="flex items-center justify-center gap-3 py-10 text-slate-500">
                    <svg
                      className="h-5 w-5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden="true"
                    >
                      <circle
                        cx="12"
                        cy="12"
                        r="9"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="opacity-25"
                      />
                      <path
                        d="M21 12a9 9 0 0 0-9-9"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    </svg>
                    Connecting to room...
                  </div>
                )}
              </div>

              <button
                onClick={toggleReady}
                disabled={
                  !currentPlayer || !currentPlayer.isConnected || isLeaving
                }
                className={`mt-6 h-12 w-full rounded-xl text-[15px] font-bold transition focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 ${
                  isReady
                    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-200"
                    : "bg-emerald-600 text-white shadow-[0_10px_24px_-10px_rgba(5,150,105,0.8)] hover:bg-emerald-500 focus-visible:ring-emerald-300/50"
                }`}
              >
                {isReady ? "I'm Not Ready" : "I'm Ready"}
              </button>
            </section>

            {/* ---------- settings (colour block) ---------- */}
            <aside className="relative h-fit overflow-hidden rounded-3xl bg-indigo-600 p-6 text-white shadow-[0_24px_60px_-24px_rgba(55,48,163,0.8)]">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-amber-400/25"
              />

              <div className="relative">
                <h2 className="mb-2 text-lg font-extrabold tracking-tight">
                  Game Settings
                </h2>

                <dl className="divide-y divide-white/15 text-sm">
                  <div className="flex justify-between py-3">
                    <dt className="text-indigo-100">Players</dt>
                    <dd className="font-bold text-white">{players.length}</dd>
                  </div>

                  <div className="flex justify-between py-3">
                    <dt className="text-indigo-100">Rounds</dt>
                    <dd className="font-bold text-white">
                      {gameSettings.rounds}
                    </dd>
                  </div>

                  <div className="flex justify-between py-3">
                    <dt className="text-indigo-100">Drawing time</dt>
                    <dd className="font-bold text-white">
                      {gameSettings.drawTime} seconds
                    </dd>
                  </div>
                </dl>

                {isHost ? (
                  <>
                    <button
                      onClick={startGame}
                      disabled={
                        isLeaving ||
                        players.filter((player) => player.isConnected).length <
                          2 ||
                        players.some(
                          (player) => player.isConnected && !player.isReady,
                        )
                      }
                      className="mt-6 h-12 w-full rounded-xl bg-amber-400 text-[15px] font-bold text-slate-900 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                      Start Game
                    </button>

                    {startDisabled && !isLeaving && (
                      <p className="mt-3 text-center text-xs leading-relaxed text-indigo-100">
                        You need at least 2 players, and everyone must be ready.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-6 rounded-xl bg-white/15 px-4 py-3 text-center text-sm text-indigo-50">
                    Waiting for the host to start...
                  </p>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0">
              <DrawingGame
                socket={socket}
                isDrawer={roundInfo?.drawer?.playerId === playerId}
                secretWord={secretWord}
                roundInfo={roundInfo}
              />
            </div>

            <div className="lg:sticky lg:top-5">
              <Scoreboard players={players} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
