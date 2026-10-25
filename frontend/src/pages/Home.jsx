import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createRoom, joinRoom } from "../services/roomService";

/* ---------- UI-only helpers (no app logic) ---------- */

const Spinner = () => (
  <svg
    className="h-4 w-4 animate-spin"
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
  <div>
    <label
      htmlFor={id}
      className="mb-1.5 block text-sm font-medium text-slate-700"
    >
      {label}
    </label>
    <div className="relative">
      {children}
      <Chevron className="absolute right-3 top-1/2 -translate-y-1/2" />
    </div>
    {note && (
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{note}</p>
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

const Home = () => {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
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

      const data = await joinRoom(
        roomCode.trim().toUpperCase(),
        username.trim(),
      );

      const joinedRoomCode =
        data?.room?.roomCode || roomCode.trim().toUpperCase();

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

  /* ---------- styling ---------- */

  const inputClass =
    "h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-900 sm:text-[15px] placeholder:text-slate-400 outline-none transition hover:border-slate-300 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15";

  const selectClass = `${inputClass} appearance-none cursor-pointer pr-10`;

  const trimmedName = username.trim();

  const summary = [
    `${settings.maxPlayers} players`,
    `${settings.rounds} rounds`,
    `${settings.drawTime} seconds`,
    `${settings.wordMode} words`,
  ].join(", ");

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#dfe5fb] px-3 py-6 sm:px-4 sm:py-10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .skb-font { font-family: 'Manrope', ui-sans-serif, system-ui, 'Segoe UI', sans-serif; }
        @keyframes skb-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .skb-rise { animation: skb-rise .6s cubic-bezier(.2,.7,.2,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .skb-rise { animation: none; }
        }
      `}</style>

      {/* flat colour shapes behind the card */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-6 h-48 w-48 rounded-full sm:-left-24 sm:top-10 sm:h-72 sm:w-72 bg-amber-300/60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 bottom-4 h-56 w-56 rounded-full sm:-right-20 sm:bottom-8 sm:h-80 sm:w-80 bg-sky-300/60"
      />

      <div className="skb-font skb-rise relative grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white sm:rounded-[28px] shadow-[0_40px_90px_-30px_rgba(55,48,163,0.55)] lg:grid-cols-[0.85fr_1.15fr]">
        {/* ---------- hero panel (colour block) ---------- */}
        <header className="relative flex flex-col justify-between gap-10 overflow-hidden bg-indigo-600 p-4 text-white min-[360px]:p-5 sm:p-8 lg:p-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-amber-400/25"
          />

          <div className="relative">
            <div className="flex items-center gap-4 lg:block">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-slate-900 shadow-[0_10px_24px_-10px_rgba(0,0,0,0.5)] sm:h-12 sm:w-12 lg:mb-8">
                <Icon>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </Icon>
              </div>

              <h1 className="min-w-0 text-2xl font-extrabold min-[360px]:text-3xl leading-tight tracking-tight sm:text-4xl lg:text-5xl">
                Skribbl.io
              </h1>
            </div>

            <p className="mt-3 max-w-xs text-sm leading-relaxed text-indigo-100 sm:text-base">
              Draw, guess, and compete with your friends!
            </p>
          </div>

          <ul className="relative hidden space-y-4 lg:block">
            {HIGHLIGHTS.map((item) => (
              <li key={item.text} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-amber-300">
                  <Icon>{item.icon}</Icon>
                </span>
                <span className="text-sm font-medium text-indigo-50">
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
        </header>

        {/* ---------- form panel ---------- */}
        <main className="p-4 min-[360px]:p-5 sm:p-8 lg:p-10">
          {/* username */}
          <div className="mb-5">
            <label
              htmlFor="username"
              className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-slate-700"
            >
              <span>Your username</span>
              <span className="text-xs font-normal text-slate-400">
                {username.length}/20
              </span>
            </label>

            <div className="relative">
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
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Enter your username"
                maxLength={20}
                autoComplete="off"
                className={`${inputClass} pl-12`}
              />
            </div>
          </div>

          {/* <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-[#171923] p-4">
            <div>
              <p className="font-semibold">Private room</p>
              <p className="mt-1 text-sm text-gray-400">
                Only people with the room code can join.
              </p>
            </div>

            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(event) => setIsPrivate(event.target.checked)}
              className="h-5 w-5 accent-yellow-400"
            />
          </div> */}

          {/* settings toggle */}
          <button
            type="button"
            onClick={() => setShowSettings((previous) => !previous)}
            aria-expanded={showSettings}
            aria-controls="room-settings"
            className="group mb-4 flex w-full items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-100/70 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/20"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-indigo-950">
                Room settings
              </span>
              <span className="mt-0.5 block truncate text-xs text-indigo-700/80">
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

          {/* animated collapse */}
          <div
            id="room-settings"
            className={`grid transition-[grid-template-rows,visibility,margin] duration-300 ease-out ${
              showSettings
                ? "visible mb-5 grid-rows-[1fr]"
                : "invisible mb-0 grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="grid grid-cols-1 gap-x-4 gap-y-5 rounded-xl border border-slate-200 bg-slate-50 p-3 min-[360px]:p-4 sm:grid-cols-2">
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

                {/* Hints setting */}
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

                {/* <SettingField id="wordMode" label="Word mode">
                  <select
                    id="wordMode"
                    value={settings.wordMode}
                    onChange={(event) =>
                      updateSetting("wordMode", event.target.value)
                    }
                    className={`${selectClass} bg-white`}
                  >
                    <option value="Normal">Normal</option>
                    <option value="Hidden">Hidden</option>
                    <option value="Combination">Combination</option>
                  </select>
                </SettingField> */}
              </div>
            </div>
          </div>

          {/* create room */}
          <button
            type="button"
            onClick={handleCreateRoom}
            disabled={loading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-[15px] font-bold text-slate-900 shadow-[0_10px_24px_-10px_rgba(245,158,11,0.9)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none"
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

          {/* divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-slate-200" />
            <span className="text-xs font-medium text-slate-400">
              Or join with a code
            </span>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          {/* join room: input and button as one control */}
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-0">
            <input
              type="text"
              value={roomCode}
              onChange={(event) =>
                setRoomCode(event.target.value.toUpperCase())
              }
              placeholder="Enter room code"
              aria-label="Room code"
              maxLength={10}
              autoComplete="off"
              spellCheck={false}
              className={`${inputClass} min-w-0 font-semibold uppercase tracking-[0.18em] placeholder:font-normal placeholder:normal-case placeholder:tracking-normal sm:rounded-r-none sm:border-r-0`}
            />

            <button
              type="button"
              onClick={handleJoinRoom}
              disabled={loading}
              className="flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 text-[15px] font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:rounded-l-none"
            >
              {loading && <Spinner />}
              Join Room
            </button>
          </div>

          {/* error */}
          {error && (
            <div
              role="alert"
              className="mt-5 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
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
        </main>
      </div>
    </div>
  );
};

export default Home;
