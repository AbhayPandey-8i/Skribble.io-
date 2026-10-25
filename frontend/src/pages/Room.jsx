import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import DrawingGame from "../components/DrawingGame";
import Scoreboard from "../components/Scoreboard";
import GameFinished from "../components/GameFinished";

const SOCKET_URL = "https://skribble-io-vqa1.onrender.com";

/* ---------- UI helpers ---------- */

const AVATAR_STYLES = [
  "bg-amber-200 text-amber-800",
  "bg-sky-200 text-sky-800",
  "bg-emerald-200 text-emerald-800",
  "bg-rose-200 text-rose-800",
  "bg-violet-200 text-violet-800",
];

const avatarStyle = (name = "") =>
  AVATAR_STYLES[(name.charCodeAt(0) || 0) % AVATAR_STYLES.length];

const Icon = ({ children, className = "h-5 w-5" }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

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
  const [revealedWord, setRevealedWord] = useState("");
  const [gameResult, setGameResult] = useState(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

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

    let revealTimeout;

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
        setGameStarted(true);
        newSocket.emit("game:restore");
      } else {
        setGameStarted(false);
        setGameResult(null);
        setRoundInfo(null);
        setSecretWord("");
        setRevealedWord("");
      }

      // Restore the current game or final results when necessary.
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

    newSocket.on("room:left", () => {
      navigate("/");
    });

    newSocket.on("room:error", (data) => {
      setError(data.message);
      setIsLeaving(false);
    });

    newSocket.on("game:error", (data) => {
      setError(data.message);
      setIsRestarting(false);
    });

    newSocket.on("game:started", () => {
      clearTimeout(revealTimeout);

      setGameStarted(true);
      setGameResult(null);
      setRoundInfo(null);
      setSecretWord("");
      setRevealedWord("");
      setIsRestarting(false);
      setError("");
    });

    newSocket.on("round:started", (data) => {
      setGameStarted(true);
      setRoundInfo(data);
      setSecretWord("");
      setError("");

      // Do not clear revealedWord here.
      // The previous turn's word should remain visible briefly,
      // even if the next turn starts immediately.

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

    // Reveal the word to every player when a turn ends.
    newSocket.on("turn:ended", (data) => {
      if (!data?.word) return;

      clearTimeout(revealTimeout);

      setRevealedWord(data.word);

      // Keep the revealed word visible for 4 seconds.
      revealTimeout = setTimeout(() => {
        setRevealedWord("");
      }, 4000);
    });

    newSocket.on("game:finished", (data) => {
      clearTimeout(revealTimeout);

      setGameResult(data);
      setGameStarted(true);
      setRoundInfo(null);
      setSecretWord("");
      setRevealedWord("");
      setIsRestarting(false);
      setError("");
    });

    newSocket.on("game:returned-to-lobby", (data) => {
      clearTimeout(revealTimeout);

      setGameStarted(false);
      setRoundInfo(null);
      setSecretWord("");
      setRevealedWord("");
      setGameResult(null);
      setIsReady(false);
      setIsRestarting(false);
      setError(data?.message || "The game has returned to the lobby.");
    });

    newSocket.on("disconnect", () => {
      setError("Disconnected from server. Reconnecting...");
    });

    return () => {
      clearTimeout(revealTimeout);
      newSocket.disconnect();
    };
  }, [roomCode, playerId, username, navigate]);

  const currentPlayer = players.find((player) => player.playerId === playerId);
  const isHost = Boolean(currentPlayer?.isHost);

  const connectedPlayers = players.filter((player) => player.isConnected);

  const readyCount = connectedPlayers.filter((player) => player.isReady).length;

  const startDisabled =
    isLeaving ||
    connectedPlayers.length < 2 ||
    connectedPlayers.some((player) => !player.isReady);

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
    if (!socket || !socket.connected || isLeaving) return;

    setError("");
    socket.emit("room:ready", { isReady: !isReady });
  };

  const startGame = () => {
    if (!socket || !socket.connected || isLeaving) return;

    setError("");
    socket.emit("game:start");
  };

  const playAgain = () => {
    if (!socket || !socket.connected) {
      setError(
        "You are disconnected. Please wait for the connection to return.",
      );
      return;
    }

    if (!isHost) {
      setError("Only the host can start another game.");
      return;
    }

    if (isRestarting) return;

    setError("");
    setIsRestarting(true);

    socket.emit("game:play-again");
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

  return (
    <div className="relative min-h-screen w-full min-w-0 overflow-x-hidden bg-[#dfe5fb] px-3 py-4 text-slate-900 sm:px-5 sm:py-8">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .skb-font {
          font-family: 'Manrope', ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
        }

        @keyframes skb-rise {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .skb-rise {
          animation: skb-rise .5s cubic-bezier(.2,.7,.2,1) both;
        }

        @media (prefers-reduced-motion: reduce) {
          .skb-rise {
            animation: none;
          }
        }
      `}</style>

      {/* Background shapes */}

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 h-56 w-56 rounded-full bg-amber-300/50 sm:h-72 sm:w-72"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-0 h-64 w-64 rounded-full bg-sky-300/50 sm:h-80 sm:w-80"
      />

      <div className="skb-font relative mx-auto w-full min-w-0 max-w-7xl">
        {/* Header */}

        <header className="mb-5 flex min-w-0 flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-[0_8px_18px_-8px_rgba(79,70,229,0.9)] sm:h-10 sm:w-10">
                <Icon>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </Icon>
              </span>

              <span className="truncate text-lg font-extrabold tracking-tight text-indigo-950 sm:text-xl">
                Skribble
              </span>
            </div>

            <button
              onClick={leaveRoom}
              disabled={isLeaving}
              className="shrink-0 rounded-xl bg-rose-500 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50 sm:hidden"
            >
              {isLeaving ? "Leaving..." : "Leave Room"}
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-3 min-[380px]:flex-row min-[380px]:items-center sm:w-auto">
            <div className="flex min-w-0 flex-1 items-center justify-between gap-3 rounded-2xl bg-white py-2 pl-3 pr-2 shadow-[0_10px_30px_-18px_rgba(55,48,163,0.6)] min-[380px]:flex-none sm:gap-4 sm:pl-4">
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-slate-500 sm:text-xs">
                  Room code
                </p>

                <p className="break-all text-base font-extrabold leading-tight tracking-[0.16em] text-indigo-700 sm:text-lg sm:tracking-[0.2em]">
                  {roomCode}
                </p>
              </div>

              <button
                onClick={copyRoomCode}
                className="flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-amber-400 px-3 text-xs font-bold text-slate-900 transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50 active:scale-[0.98] sm:h-10 sm:gap-2 sm:px-4 sm:text-sm"
              >
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4">
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
                </Icon>
                Copy
              </button>
            </div>

            <button
              onClick={leaveRoom}
              disabled={isLeaving}
              className="hidden h-12 shrink-0 rounded-2xl bg-rose-500 px-5 font-bold text-white shadow-[0_10px_24px_-12px_rgba(244,63,94,0.9)] transition hover:bg-rose-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-300/60 disabled:cursor-not-allowed disabled:opacity-50 sm:block sm:h-[58px]"
            >
              {isLeaving ? "Leaving..." : "Leave Room"}
            </button>
          </div>
        </header>

        {/* Error message */}

        {error && (
          <div
            role="alert"
            className="mb-4 flex min-w-0 items-start gap-2.5 break-words rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 sm:mb-5 sm:gap-3 sm:px-4"
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

            <span className="min-w-0 break-words">{error}</span>
          </div>
        )}

        {/* Finished game */}

        {gameResult ? (
          <div className="skb-rise">
            <GameFinished
              rankings={gameResult.rankings || []}
              totalRounds={gameResult.totalRounds || gameSettings.rounds}
              onBack={leaveRoom}
            />

            <div className="mx-auto mt-5 max-w-xl rounded-2xl bg-white p-4 text-center shadow-[0_20px_50px_-30px_rgba(55,48,163,0.6)] sm:mt-6 sm:p-6">
              {isHost ? (
                <>
                  <h2 className="text-lg font-extrabold text-indigo-950 sm:text-xl">
                    Play another game?
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Start a new game in this room with the players who are still
                    here.
                  </p>

                  <button
                    onClick={playAgain}
                    disabled={isRestarting || isLeaving}
                    className="mt-4 h-12 w-full rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_10px_24px_-10px_rgba(5,150,105,0.8)] transition hover:bg-emerald-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-300/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
                  >
                    {isRestarting ? "Returning to Lobby..." : "Play Again"}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-extrabold text-indigo-950 sm:text-xl">
                    Game Over!
                  </h2>

                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    Waiting for the host to start another game.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : !gameStarted ? (
          <div className="skb-rise grid min-w-0 grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            {/* Lobby */}

            <section className="min-w-0 rounded-2xl bg-white p-4 shadow-[0_24px_60px_-30px_rgba(55,48,163,0.5)] min-[380px]:rounded-3xl min-[380px]:p-5 sm:p-8">
              <div className="mb-5 flex min-w-0 flex-col gap-3 min-[380px]:flex-row min-[380px]:items-start min-[380px]:justify-between sm:mb-6 sm:gap-4">
                <div className="min-w-0">
                  <h1 className="text-xl font-extrabold tracking-tight text-indigo-950 min-[380px]:text-2xl">
                    Game Lobby
                  </h1>

                  <p className="mt-1 text-sm leading-relaxed text-slate-500 sm:text-base">
                    Waiting for everyone to get ready.
                  </p>
                </div>

                {players.length > 0 && (
                  <span className="w-fit shrink-0 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 sm:text-sm">
                    {readyCount}/{connectedPlayers.length} ready
                  </span>
                )}
              </div>

              {/* Players */}

              <div className="space-y-3">
                {players.map((player) => (
                  <div
                    key={player.playerId}
                    className="flex min-w-0 items-center gap-2.5 rounded-xl bg-indigo-50/70 p-2.5 ring-1 ring-indigo-100 min-[380px]:gap-3 min-[380px]:rounded-2xl min-[380px]:p-3.5"
                  >
                    <div
                      aria-hidden="true"
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold min-[380px]:h-11 min-[380px]:w-11 min-[380px]:text-base ${avatarStyle(
                        player.username,
                      )}`}
                    >
                      {(player.username || "?")[0].toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-semibold leading-snug text-slate-900 sm:text-base">
                        {player.username}
                        {player.playerId === playerId && (
                          <span className="font-medium text-slate-400">
                            {" "}
                            (You)
                          </span>
                        )}
                      </p>

                      {player.isHost && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-900 sm:text-xs">
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

                    <span
                      className={`inline-flex max-w-[48%] shrink-0 items-center justify-center gap-1 rounded-full px-2 py-1 text-[9px] font-semibold leading-tight min-[380px]:gap-1.5 min-[380px]:px-2.5 min-[380px]:text-[10px] sm:max-w-none sm:px-3 sm:text-xs ${
                        !player.isConnected
                          ? "bg-slate-200 text-slate-600"
                          : player.isReady
                            ? "bg-emerald-500 text-white"
                            : "bg-amber-200 text-amber-900"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          !player.isConnected
                            ? "bg-slate-400"
                            : player.isReady
                              ? "bg-white"
                              : "bg-amber-600"
                        }`}
                      />

                      <span className="break-words">
                        {!player.isConnected
                          ? "Disconnected"
                          : player.isReady
                            ? "Ready"
                            : "Not ready"}
                      </span>
                    </span>
                  </div>
                ))}

                {players.length === 0 && (
                  <div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-500 sm:py-10">
                    <svg
                      className="h-5 w-5 shrink-0 animate-spin"
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

                    <span>Connecting to room...</span>
                  </div>
                )}
              </div>

              {/* Ready button */}

              <button
                onClick={toggleReady}
                disabled={
                  !currentPlayer || !currentPlayer.isConnected || isLeaving
                }
                className={`mt-5 h-11 w-full rounded-xl text-sm font-bold transition focus-visible:outline-none focus-visible:ring-4 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 min-[380px]:mt-6 min-[380px]:h-12 sm:text-[15px] ${
                  isReady
                    ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-200"
                    : "bg-emerald-600 text-white shadow-[0_10px_24px_-10px_rgba(5,150,105,0.8)] hover:bg-emerald-500 focus-visible:ring-emerald-300/50"
                }`}
              >
                {isReady ? "I'm Not Ready" : "I'm Ready"}
              </button>
            </section>

            {/* Game Settings */}

            <aside className="relative min-w-0 overflow-hidden rounded-2xl bg-indigo-600 p-4 text-white shadow-[0_24px_60px_-24px_rgba(55,48,163,0.8)] min-[380px]:rounded-3xl min-[380px]:p-5 sm:p-6">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10"
              />

              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-amber-400/25"
              />

              <div className="relative min-w-0">
                <h2 className="mb-2 text-lg font-extrabold tracking-tight sm:text-xl">
                  Game Settings
                </h2>

                <dl className="divide-y divide-white/15 text-sm">
                  <div className="flex min-w-0 items-center justify-between gap-3 py-3">
                    <dt className="text-indigo-100">Players</dt>
                    <dd className="font-bold text-white">{players.length}</dd>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3 py-3">
                    <dt className="text-indigo-100">Rounds</dt>
                    <dd className="font-bold text-white">
                      {gameSettings.rounds}
                    </dd>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-3 py-3">
                    <dt className="text-indigo-100">Drawing time</dt>
                    <dd className="text-right font-bold text-white">
                      {gameSettings.drawTime} seconds
                    </dd>
                  </div>
                </dl>

                {isHost ? (
                  <>
                    <button
                      onClick={startGame}
                      disabled={startDisabled}
                      className="mt-5 h-11 w-full rounded-xl bg-amber-400 px-3 text-sm font-bold text-slate-900 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none min-[380px]:mt-6 min-[380px]:h-12 sm:text-[15px]"
                    >
                      Start Game
                    </button>

                    {startDisabled && !isLeaving && (
                      <p className="mt-3 text-center text-xs leading-relaxed text-indigo-100">
                        You need at least 2 connected players, and everyone must
                        be ready.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-5 rounded-xl bg-white/15 px-3 py-3 text-center text-xs leading-relaxed text-indigo-50 min-[380px]:mt-6 min-[380px]:px-4 sm:text-sm">
                    Waiting for the host to start...
                  </p>
                )}
              </div>
            </aside>
          </div>
        ) : (
          /* Active game */

          <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Revealed word banner */}

            {revealedWord && (
              <div className="col-span-full rounded-2xl border border-amber-300 bg-amber-100 px-4 py-4 text-center shadow-sm">
                <p className="text-sm font-semibold text-amber-800 sm:text-base">
                  🎨 Turn ended!
                </p>

                <p className="mt-1 text-lg font-extrabold text-amber-950 sm:text-xl">
                  The word was: {revealedWord}
                </p>
              </div>
            )}

            <div className="min-w-0 max-w-full">
              <DrawingGame
                socket={socket}
                isDrawer={roundInfo?.drawer?.playerId === playerId}
                secretWord={secretWord}
                roundInfo={roundInfo}
              />
            </div>

            <div className="min-w-0 max-w-full lg:sticky lg:top-5">
              <Scoreboard players={players} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Room;
