const getRankBadgeStyle = (rank) => {
  if (rank === 1) return "bg-amber-400 text-slate-900";
  if (rank === 2) return "bg-slate-200 text-slate-700";
  if (rank === 3) return "bg-orange-300 text-orange-950";
  return "bg-indigo-50 text-indigo-600";
};

const GameFinished = ({ rankings = [], totalRounds = 1, onBack }) => {
  const highestScore =
    rankings.length > 0
      ? Math.max(...rankings.map((player) => player.score ?? 0))
      : 0;

  const winners = rankings.filter(
    (player) => (player.score ?? 0) === highestScore,
  );

  const isTie = winners.length > 1;

  const isWinner = (player) =>
    winners.some((winner) => winner.playerId === player.playerId);

  return (
    <div className="mx-auto max-w-3xl py-4">
      {/* Winner section */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-indigo-600 p-8 text-center text-white shadow-[0_30px_70px_-30px_rgba(55,48,163,0.8)] sm:p-10">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-amber-400/25"
        />

        <div className="relative">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 text-slate-900 shadow-[0_12px_28px_-10px_rgba(0,0,0,0.5)]">
            <svg
              className="h-8 w-8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
              <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
              <path d="M4 22h16" />
              <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
              <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
              <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
            </svg>
          </div>

          <p className="mb-2 text-sm font-semibold text-indigo-100">
            Game finished
          </p>

          <h1 className="mb-3 text-3xl font-extrabold tracking-tight sm:text-5xl">
            {rankings.length === 0
              ? "Game Over!"
              : isTie
                ? "We Have Multiple Winners!"
                : "We Have a Winner!"}
          </h1>

          {rankings.length > 0 && (
            <>
              <p className="mb-3 text-xl text-indigo-100">
                {isTie ? "Congratulations to our winners!" : "Congratulations,"}
              </p>

              <div className="mb-4 flex flex-wrap justify-center gap-x-3 gap-y-2">
                {winners.map((player, index) => (
                  <span
                    key={player.playerId}
                    className="text-xl font-extrabold text-amber-300"
                  >
                    {player.username}
                    {!isTie && "!"}
                    {isTie && index < winners.length - 1 && ","}
                  </span>
                ))}
              </div>

              <div className="mt-5 inline-block rounded-2xl bg-white px-10 py-4 text-slate-900 shadow-[0_16px_36px_-16px_rgba(0,0,0,0.5)]">
                <p className="text-sm font-medium text-slate-500">
                  {isTie ? "Winning Score" : "Final Score"}
                </p>

                <p className="text-4xl font-extrabold text-indigo-600">
                  {highestScore}
                </p>

                <p className="mt-0.5 text-xs text-slate-500">points</p>
              </div>
            </>
          )}

          <p className="mt-5 text-sm text-indigo-100">
            All {totalRounds} rounds completed
          </p>
        </div>
      </div>

      {/* Final rankings */}
      <div className="mb-6 overflow-hidden rounded-3xl bg-white shadow-[0_24px_60px_-30px_rgba(55,48,163,0.5)]">
        <div className="border-b border-slate-100 px-6 py-5">
          <h2 className="text-xl font-extrabold tracking-tight text-indigo-950">
            Final Leaderboard
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Here are the final scores for every player.
          </p>
        </div>

        {rankings.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {rankings.map((player, index) => {
              const playerIsWinner = isWinner(player);

              return (
                <div
                  key={player.playerId}
                  className={`flex items-center justify-between gap-4 px-6 py-4 ${
                    playerIsWinner ? "bg-amber-50" : ""
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-extrabold ${getRankBadgeStyle(
                        player.rank ?? index + 1,
                      )}`}
                    >
                      {player.rank ?? index + 1}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">
                        {player.username}

                        {player.isHost && (
                          <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">
                            Host
                          </span>
                        )}
                      </p>

                      {playerIsWinner && (
                        <p className="mt-0.5 text-xs font-semibold text-amber-700">
                          {isTie ? "Winner (Tie)" : "Winner"}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="text-xl font-extrabold tabular-nums text-indigo-950">
                      {player.score ?? 0}
                    </p>

                    <p className="text-xs text-slate-500">points</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="p-6 text-center text-slate-500">
            Final rankings are not available.
          </p>
        )}
      </div>

      {/* Return button */}
      <div className="text-center">
        <button
          onClick={onBack}
          className="h-12 rounded-xl bg-amber-400 px-10 text-[15px] font-bold text-slate-900 shadow-[0_10px_24px_-10px_rgba(245,158,11,0.9)] transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/50 active:scale-[0.99]"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default GameFinished;
