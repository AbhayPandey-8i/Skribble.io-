import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom } from "../services/roomService";

/* ---------- UI helpers ---------- */

const Spinner = () => (
  <svg
    className="h-4 w-4 shrink-0 animate-spin"
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
);

const Chevron = ({ className = "" }) => (
  <svg
    className={`pointer-events-none h-4 w-4 text-slate-400 ${className}`}
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M5.5 7.5 10 12l4.5-4.5-1.4-1.4L10 9.2 6.9 6.1z" />
  </svg>
);

const SettingField = ({ id, label, note, children }) => (
  <div className="w-full min-w-0">
    <label
      htmlFor={id}
      className="mb-1.5 block text-sm font-medium text-slate-700"
    >
      {label}
    </label>

    <div className="relative w-full min-w-0">
      {children}
      <Chevron className="absolute right-3 top-1/2 -translate-y-1/2" />
    </div>

    {note && (
      <p className="mt-2 break-words text-xs leading-relaxed text-slate-500">
        {note}
      </p>
    )}
  </div>
);

const Icon = ({ children }) => (
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
    {children}
  </svg>
);

const HIGHLIGHTS = [
  {
    text: "Draw the word you are given",
    icon: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
      </>
    ),
  },
  {
    text: "Guess what everyone else is drawing",
    icon: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
  },
  {
    text: "Score points and top the board",
    icon: (
      <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />
    ),
  },
];

/* ---------- Home page ---------- */

const Home = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isPrivate] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [settings, setSettings] = useState({
    maxPlayers: 8,
    rounds: 3,
    drawTime: 80,
    wordCount: 3,
    hints: 2,
    wordMode: "Normal",
  });

  const updateSetting = (key, value) => {
    setSettings((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await createRoom({
        username: username.trim(),
        isPrivate,
        settings,
      });

      if (!data?.room?.roomCode) {
        throw new Error("Room code was not returned by the server.");
      }

      navigate(`/room/${data.room.roomCode}`, {
        state: {
          username: username.trim(),
          playerId: data.playerId || data.player?.playerId,
        },
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Unable to create room.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!username.trim()) {
      setError("Please enter your username.");
      return;
    }

    if (!roomCode.trim()) {
      setError("Please enter a room code.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const normalizedRoomCode = roomCode.trim().toUpperCase();
      const data = await joinRoom(normalizedRoomCode, username.trim());
      const joinedRoomCode = data?.room?.roomCode || normalizedRoomCode;

      navigate(`/room/${joinedRoomCode}`, {
        state: {
          username: username.trim(),
          playerId: data.playerId || data.player?.playerId,
        },
      });
    } catch (error) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Unable to join room.",
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------- Styling ---------- */

  const inputClass =
    "block h-11 w-full min-w-0 max-w-full box-border rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 min-[360px]:h-12 min-[360px]:px-3 sm:px-4 sm:text-[15px]";

  const selectClass = `${inputClass} appearance-none cursor-pointer pr-9`;

  const trimmedName = username.trim();

  const summary = [
    `${settings.maxPlayers} players`,
    `${settings.rounds} rounds`,
    `${settings.drawTime} seconds`,
    `${settings.wordMode} words`,
  ].join(", ");

  return (
    <div className="relative flex min-h-[100dvh] w-full min-w-0 items-center justify-center overflow-x-hidden bg-[#dfe5fb] px-3 py-4 min-[360px]:px-4 sm:py-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');

        .skb-font {
          font-family: 'Manrope', ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
        }

        @keyframes skb-rise {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .skb-rise {
          animation: skb-rise .6s cubic-bezier(.2,.7,.2,1) both;
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
        className="pointer-events-none absolute -left-20 top-6 h-40 w-40 rounded-full bg-amber-300/60 min-[360px]:h-48 min-[360px]:w-48 sm:-left-24 sm:top-10 sm:h-72 sm:w-72"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-4 h-44 w-44 rounded-full bg-sky-300/60 min-[360px]:h-56 min-[360px]:w-56 sm:-right-20 sm:bottom-8 sm:h-80 sm:w-80"
      />

      {/* Main card */}

      <div
        className="
          skb-font skb-rise relative grid
          w-full min-w-0 max-w-5xl
          grid-cols-[minmax(0,1fr)]
          overflow-hidden rounded-2xl bg-white
          shadow-[0_25px_60px_-30px_rgba(55,48,163,0.4)]
          sm:rounded-[28px]
          lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]
        "
      >
        {/* Hero section */}

        <header className="relative flex w-full min-w-0 flex-col justify-between gap-4 overflow-hidden bg-indigo-600 p-4 text-white min-[360px]:gap-6 min-[360px]:p-5 sm:gap-10 sm:p-8 lg:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
          />

          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-amber-400/25"
          />

          <div className="relative w-full min-w-0">
            <div className="flex w-full min-w-0 items-center gap-3 lg:block lg:gap-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-slate-900 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] min-[360px]:h-11 min-[360px]:w-11 sm:h-12 sm:w-12 lg:mb-8">
                <Icon>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </Icon>
              </div>

              <h1 className="min-w-0 break-words text-xl font-extrabold leading-tight tracking-tight min-[360px]:text-2xl sm:text-4xl lg:text-5xl">
                Skribbl.io
              </h1>
            </div>

            <p className="mt-2 max-w-full break-words text-xs leading-relaxed text-indigo-100 min-[360px]:mt-3 min-[360px]:text-sm sm:text-base">
              Draw, guess, and compete with your friends!
            </p>
          </div>

          {/* Highlights: visible on desktop */}

          <ul className="relative hidden space-y-4 lg:block">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-300">
                  <Icon>{item.icon}</Icon>
                </span>

                <span className="min-w-0 break-words text-sm font-medium text-indigo-50">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </header>

        {/* Form section */}

        <main className="block w-full min-w-0 max-w-full box-border p-3 min-[360px]:p-4 sm:p-8 lg:p-10">
          {/* Username */}

          <div className="mb-4 w-full min-w-0 min-[360px]:mb-5">
            <label
              htmlFor="username"
              className="mb-1.5 flex min-w-0 items-baseline justify-between gap-2 text-sm font-medium text-slate-700"
            >
              <span>Your username</span>

              <span className="shrink-0 text-xs font-normal text-slate-400">
                {username.length}/20
              </span>
            </label>

            <div className="relative w-full min-w-0">
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute left-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-xs font-bold transition ${
                  trimmedName
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-200 text-slate-400"
                }`}
              >
                {trimmedName ? (
                  trimmedName[0].toUpperCase()
                ) : (
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M10 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H3Z" />
                  </svg>
                )}
              </span>

              <input
                id="username"
                type="text"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError("");
                }}
                placeholder="Enter your username"
                maxLength={20}
                autoComplete="off"
                className={`${inputClass} pl-12 min-[360px]:pl-12`}
              />
            </div>
          </div>

          {/* Room settings toggle */}

          <button
            type="button"
            onClick={() => setShowSettings((previous) => !previous)}
            aria-expanded={showSettings}
            aria-controls="room-settings"
            className="group mb-3 flex w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-100/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20 min-[360px]:mb-4 min-[360px]:gap-4 min-[360px]:px-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-indigo-950">
                Room settings
              </span>

              <span className="mt-0.5 block break-words text-xs leading-relaxed text-indigo-700/80">
                {summary}
              </span>
            </span>

            <svg
              className={`h-5 w-5 shrink-0 text-indigo-500 transition-transform duration-300 ${
                showSettings ? "rotate-180" : ""
              }`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M5.5 7.5 10 12l4.5-4.5-1.4-1.4L10 9.2 6.9 6.1z" />
            </svg>
          </button>

          {/* Animated settings panel */}

          <div
            id="room-settings"
            className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)] transition-[grid-template-rows,visibility,margin] duration-300 ease-out ${
              showSettings
                ? "visible mb-4 grid-rows-[1fr]"
                : "invisible mb-0 grid-rows-[0fr]"
            }`}
          >
            <div className="min-h-0 w-full min-w-0 overflow-hidden">
              <div className="grid w-full min-w-0 grid-cols-1 gap-x-4 gap-y-4 rounded-xl border border-slate-200 bg-slate-50 p-3 min-[360px]:gap-y-5 min-[360px]:p-4 sm:grid-cols-2">
                <SettingField id="maxPlayers" label="Maximum players">
                  <select
                    id="maxPlayers"
                    value={settings.maxPlayers}
                    onChange={(event) =>
                      updateSetting("maxPlayers", Number(event.target.value))
                    }
                    className={`${selectClass} bg-white`}
                  >
                    {[2, 4, 6, 8, 10, 12, 16, 20].map((count) => (
                      <option key={count} value={count}>
                        {count} players
                      </option>
                    ))}
                  </select>
                </SettingField>

                <SettingField id="rounds" label="Number of rounds">
                  <select
                    id="rounds"
                    value={settings.rounds}
                    onChange={(event) =>
                      updateSetting("rounds", Number(event.target.value))
                    }
                    className={`${selectClass} bg-white`}
                  >
                    {[2, 3, 4, 5, 6, 8, 10].map((count) => (
                      <option key={count} value={count}>
                        {count} rounds
                      </option>
                    ))}
                  </select>
                </SettingField>

                <SettingField id="drawTime" label="Drawing time">
                  <select
                    id="drawTime"
                    value={settings.drawTime}
                    onChange={(event) =>
                      updateSetting("drawTime", Number(event.target.value))
                    }
                    className={`${selectClass} bg-white`}
                  >
                    {[30, 60, 80, 90, 120, 180, 240].map((seconds) => (
                      <option key={seconds} value={seconds}>
                        {seconds} seconds
                      </option>
                    ))}
                  </select>
                </SettingField>

                <SettingField id="wordCount" label="Word choices per turn">
                  <select
                    id="wordCount"
                    value={settings.wordCount}
                    onChange={(event) =>
                      updateSetting("wordCount", Number(event.target.value))
                    }
                    className={`${selectClass} bg-white`}
                  >
                    {[1, 2, 3, 4, 5].map((count) => (
                      <option key={count} value={count}>
                        {count} words
                      </option>
                    ))}
                  </select>
                </SettingField>

                <SettingField
                  id="hints"
                  label="Automatic hints"
                  note="Letters are revealed automatically as drawing time runs out."
                >
                  <select
                    id="hints"
                    value={settings.hints}
                    onChange={(event) =>
                      updateSetting("hints", Number(event.target.value))
                    }
                    className={`${selectClass} bg-white`}
                  >
                    {[0, 1, 2, 3, 4, 5].map((count) => (
                      <option key={count} value={count}>
                        {count} {count === 1 ? "hint" : "hints"}
                      </option>
                    ))}
                  </select>
                </SettingField>
              </div>
            </div>
          </div>

          {/* Create room */}

          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={loading}
            className="flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-xl bg-amber-400 px-3 text-sm font-bold text-slate-900 shadow-[0_10px_24px_-10px_rgba(245,158,11,0.9)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none min-[360px]:h-12 min-[360px]:px-4 min-[360px]:text-[15px]"
          >
            {loading ? (
              <>
                <Spinner />
                Please wait...
              </>
            ) : (
              "Create Room"
            )}
          </button>

          {/* Divider */}

          <div className="my-4 flex w-full min-w-0 items-center gap-2 min-[360px]:my-6 min-[360px]:gap-4">
            <div className="h-px min-w-0 flex-1 bg-slate-200" />

            <span className="shrink-0 text-[10px] font-medium text-slate-400 min-[360px]:text-xs">
              Or join with a code
            </span>

            <div className="h-px min-w-0 flex-1 bg-slate-200" />
          </div>

          {/* Join room */}

          <div className="flex w-full min-w-0 flex-col gap-2 min-[360px]:gap-3 sm:flex-row sm:gap-0">
            <input
              type="text"
              value={roomCode}
              onChange={(event) => {
                setRoomCode(event.target.value.toUpperCase());
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleJoinRoom();
                }
              }}
              placeholder="Enter room code"
              aria-label="Room code"
              maxLength={10}
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} uppercase tracking-[0.15em] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal sm:rounded-r-none sm:border-r-0`}
            />

            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={loading}
              className="flex h-11 w-full min-w-0 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 min-[360px]:h-12 min-[360px]:text-[15px] sm:w-auto sm:rounded-l-none"
            >
              {loading && <Spinner />}
              Join Room
            </button>
          </div>

          {/* Error message */}

          {error && (
            <div
              role="alert"
              className="mt-4 flex w-full min-w-0 items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-sm text-red-700 min-[360px]:mt-5 min-[360px]:px-4"
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
        </main>
      </div>
    </div>
  );
};

export default Home;
