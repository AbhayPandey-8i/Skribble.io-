const Scoreboard = ({ players = [] }) => {
  const sortedPlayers = [...players].sort(
    (a, b) => (b.score || 0) - (a.score || 0),
  );

  let currentRank = 0;
  let previousScore = null;

  const rankedPlayers = sortedPlayers.map((player, index) => {
    const score = player.score || 0;

    if (score !== previousScore) {
      currentRank = index + 1;
      previousScore = score;
    }

    return {
      ...player,
      score,
      rank: currentRank,
    };
  });

  const getRankStyle = (rank) => {
    if (rank === 1) return "bg-amber-400 text-slate-900";
    if (rank === 2) return "bg-slate-200 text-slate-700";
    if (rank === 3) return "bg-orange-300 text-orange-950";

    return "bg-white/15 text-indigo-100";
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-indigo-600 p-5 text-white shadow-[0_24px_60px_-24px_rgba(55,48,163,0.8)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full bg-white/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-amber-400/20"
      />

      <div className="relative">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">
              Leaderboard
            </h2>
            <p className="mt-0.5 text-sm text-indigo-100">
              Live player rankings
            </p>
          </div>

          <div className="shrink-0 rounded-full bg-white/15 px-3 py-1 text-sm font-semibold text-white">
            {players.length} Players
          </div>
        </div>

        <div className="mb-2 grid grid-cols-[48px_1fr_64px] gap-2 px-3 text-xs font-medium text-indigo-200">
          <span>Rank</span>
          <span>Player</span>
          <span className="text-right">Score</span>
        </div>

        <div className="space-y-2">
          {rankedPlayers.length === 0 ? (
            <p className="rounded-2xl bg-white/10 py-6 text-center text-sm text-indigo-100">
              Waiting for players...
            </p>
          ) : (
            rankedPlayers.map((player) => {
              const isLeader = player.rank === 1 && player.score > 0;

              return (
                <div
                  key={player.playerId}
                  className={`grid grid-cols-[48px_1fr_64px] items-center gap-2 rounded-2xl px-3 py-2.5 ${
                    isLeader
                      ? "bg-white text-slate-900 shadow-[0_10px_24px_-14px_rgba(0,0,0,0.6)]"
                      : "bg-white/10 text-white"
                  }`}
                >
                  <div className="flex">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold ${getRankStyle(
                        player.rank,
                      )}`}
                    >
                      {isLeader ? (
                        <svg
                          className="h-4 w-4"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5L3 8Z" />
                        </svg>
                      ) : (
                        player.rank
                      )}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {player.username}
                      {player.isHost && (
                        <span
                          className={`ml-2 text-xs font-medium ${
                            isLeader ? "text-indigo-600" : "text-amber-300"
                          }`}
                        >
                          Host
                        </span>
                      )}
                    </p>

                    <p
                      className={`mt-0.5 flex items-center gap-1.5 text-xs ${
                        isLeader ? "text-slate-500" : "text-indigo-100"
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`h-1.5 w-1.5 rounded-full ${
                          player.isConnected
                            ? "bg-emerald-400"
                            : isLeader
                              ? "bg-slate-300"
                              : "bg-white/40"
                        }`}
                      />
                      {player.isConnected ? "Online" : "Offline"}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-extrabold tabular-nums">
                      {player.score}
                    </span>
                    <p
                      className={`text-xs ${
                        isLeader ? "text-slate-500" : "text-indigo-100"
                      }`}
                    >
                      points
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Scoreboard;
