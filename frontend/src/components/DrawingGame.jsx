import { useEffect, useRef, useState } from "react";

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 500;

/* ---------- UI-only helpers (no app logic) ---------- */

const PALETTE = [
  "#111827",
  "#6b7280",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#92400e",
  "#ffffff",
];

const ToolIcon = ({ children }) => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
);

const DrawingGame = ({ socket, isDrawer, secretWord, roundInfo }) => {
  const canvasRef = useRef(null);
  const lastPoint = useRef(null);
  const drawingRef = useRef(false);
  const currentStrokeId = useRef(null);

  const [color, setColor] = useState("#111827");
  const [brushSize, setBrushSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(8);
  const [tool, setTool] = useState("brush");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [wordChoices, setWordChoices] = useState([]);
  const [choosingWord, setChoosingWord] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  const [hintPattern, setHintPattern] = useState("");
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [totalHints, setTotalHints] = useState(0);

  const canDraw = isDrawer && !choosingWord && !!secretWord && timeLeft > 0;
  const showTimer = roundInfo?.phase === "drawing" && timeLeft > 0;

  const getContext = () => {
    const canvas = canvasRef.current;

    return canvas
      ? canvas.getContext("2d", { willReadFrequently: true })
      : null;
  };

  const drawStroke = (stroke) => {
    const context = getContext();

    if (!context) return;

    context.save();

    context.globalCompositeOperation = stroke.erase
      ? "destination-out"
      : "source-over";

    context.beginPath();
    context.moveTo(stroke.x0, stroke.y0);
    context.lineTo(stroke.x1, stroke.y1);
    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.width;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();

    context.restore();
  };

  const fillArea = (x, y, fillColor) => {
    const canvas = canvasRef.current;
    const context = getContext();

    if (!canvas || !context) return false;

    const startX = Math.floor(x);
    const startY = Math.floor(y);

    if (
      startX < 0 ||
      startY < 0 ||
      startX >= canvas.width ||
      startY >= canvas.height
    ) {
      return false;
    }

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);

    const pixels = imageData.data;
    const startIndex = (startY * canvas.width + startX) * 4;

    const target = [
      pixels[startIndex],
      pixels[startIndex + 1],
      pixels[startIndex + 2],
      pixels[startIndex + 3],
    ];

    const rgb = fillColor.match(/\w\w/g)?.map((value) => parseInt(value, 16));

    if (!rgb || rgb.length !== 3) return false;

    const replacement = [rgb[0], rgb[1], rgb[2], 255];

    if (target.every((value, index) => value === replacement[index])) {
      return false;
    }

    const matchesTarget = (index) =>
      Math.abs(pixels[index] - target[0]) <= 20 &&
      Math.abs(pixels[index + 1] - target[1]) <= 20 &&
      Math.abs(pixels[index + 2] - target[2]) <= 20 &&
      Math.abs(pixels[index + 3] - target[3]) <= 20;

    const pixelCount = canvas.width * canvas.height;
    const visited = new Uint8Array(pixelCount);
    const queue = new Int32Array(pixelCount);

    let head = 0;
    let tail = 0;

    const startPixel = startY * canvas.width + startX;

    queue[tail++] = startPixel;
    visited[startPixel] = 1;

    while (head < tail) {
      const pixel = queue[head++];
      const index = pixel * 4;

      if (!matchesTarget(index)) continue;

      pixels[index] = replacement[0];
      pixels[index + 1] = replacement[1];
      pixels[index + 2] = replacement[2];
      pixels[index + 3] = replacement[3];

      const px = pixel % canvas.width;
      const py = Math.floor(pixel / canvas.width);

      const neighbors = [
        px > 0 ? pixel - 1 : -1,
        px < canvas.width - 1 ? pixel + 1 : -1,
        py > 0 ? pixel - canvas.width : -1,
        py < canvas.height - 1 ? pixel + canvas.width : -1,
      ];

      for (const neighbor of neighbors) {
        if (neighbor === -1 || visited[neighbor]) continue;

        const neighborIndex = neighbor * 4;

        if (matchesTarget(neighborIndex)) {
          visited[neighbor] = 1;
          queue[tail++] = neighbor;
        }
      }
    }

    context.putImageData(imageData, 0, 0);

    return true;
  };

  const clearCanvasLocally = () => {
    const canvas = canvasRef.current;
    const context = getContext();

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    drawingRef.current = false;
    lastPoint.current = null;
    currentStrokeId.current = null;
  };

  const restoreDrawing = (history = []) => {
    clearCanvasLocally();

    history.forEach((action) => {
      if (action.type === "stroke") {
        action.strokes.forEach((stroke) => {
          drawStroke(stroke);
        });
      }

      if (action.type === "fill") {
        fillArea(action.x, action.y, action.color);
      }
    });
  };

  useEffect(() => {
    if (!socket) return;

    const handleWordChoices = (data) => {
      setWordChoices(data.words || []);
      setChoosingWord(true);
    };

    const handleWordSelected = () => {
      setWordChoices([]);
      setChoosingWord(false);
    };

    const handleRoundStarted = (data) => {
      if (data.phase === "choosing") {
        setWordChoices([]);
        setChoosingWord(false);
        setTimeLeft(0);
        setHintPattern("");
        setHintsRevealed(0);
        setTotalHints(0);
        clearCanvasLocally();
      }

      if (data.phase === "drawing") {
        setChoosingWord(false);
        setWordChoices([]);
      }
    };

    const handleTimerUpdate = (data) => {
      setTimeLeft(data.secondsLeft);
    };

    const handleHintUpdate = (data) => {
      setHintPattern(data.pattern || "");
      setHintsRevealed(data.hintsRevealed || 0);
      setTotalHints(data.totalHints || 0);
    };

    const handleStroke = (stroke) => {
      drawStroke(stroke);
    };

    const handleFill = (data) => {
      fillArea(data.x, data.y, data.color);
    };

    const handleClear = () => {
      clearCanvasLocally();
    };

    const handleUndo = (data) => {
      restoreDrawing(data.history || []);
    };

    const handleDrawingRestore = (data) => {
      restoreDrawing(data.history || []);
    };

    const handleMessage = (data) => {
      setMessages((previous) => [...previous, data].slice(-100));
    };

    socket.on("word:choices", handleWordChoices);
    socket.on("word:selected", handleWordSelected);
    socket.on("round:started", handleRoundStarted);
    socket.on("timer:update", handleTimerUpdate);
    socket.on("hint:update", handleHintUpdate);
    socket.on("drawing:stroke", handleStroke);
    socket.on("drawing:fill", handleFill);
    socket.on("drawing:clear", handleClear);
    socket.on("drawing:undo", handleUndo);
    socket.on("drawing:restore", handleDrawingRestore);
    socket.on("chat:message", handleMessage);

    return () => {
      socket.off("word:choices", handleWordChoices);
      socket.off("word:selected", handleWordSelected);
      socket.off("round:started", handleRoundStarted);
      socket.off("timer:update", handleTimerUpdate);
      socket.off("hint:update", handleHintUpdate);
      socket.off("drawing:stroke", handleStroke);
      socket.off("drawing:fill", handleFill);
      socket.off("drawing:clear", handleClear);
      socket.off("drawing:undo", handleUndo);
      socket.off("drawing:restore", handleDrawingRestore);
      socket.off("chat:message", handleMessage);
    };
  }, [socket]);

  const getPoint = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  };

  const selectWord = (word) => {
    if (!isDrawer || !choosingWord) return;

    socket.emit("word:select", { word });

    setChoosingWord(false);
    setWordChoices([]);
  };

  const startDrawing = (event) => {
    if (!canDraw) return;

    event.preventDefault();

    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);

    const point = getPoint(event);

    if (tool === "fill") {
      if (fillArea(point.x, point.y, color)) {
        socket.emit("drawing:fill", {
          x: Math.floor(point.x),
          y: Math.floor(point.y),
          color,
        });
      }

      return;
    }

    currentStrokeId.current = `${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    drawingRef.current = true;
    lastPoint.current = point;
  };

  const draw = (event) => {
    if (!canDraw || !drawingRef.current || !lastPoint.current) {
      return;
    }

    event.preventDefault();

    const currentPoint = getPoint(event);
    const isEraser = tool === "eraser";

    const stroke = {
      strokeId: currentStrokeId.current,
      x0: lastPoint.current.x,
      y0: lastPoint.current.y,
      x1: currentPoint.x,
      y1: currentPoint.y,
      color,
      width: isEraser ? eraserSize * 3 : brushSize,
      erase: isEraser,
    };

    drawStroke(stroke);
    socket.emit("drawing:stroke", stroke);

    lastPoint.current = currentPoint;
  };

  const stopDrawing = () => {
    drawingRef.current = false;
    lastPoint.current = null;
    currentStrokeId.current = null;
  };

  const clearCanvas = () => {
    if (!canDraw) return;

    socket.emit("drawing:clear");
  };

  const undoDrawing = () => {
    if (!canDraw) return;

    socket.emit("drawing:undo");
  };

  const sendMessage = (event) => {
    event.preventDefault();

    if (!message.trim() || isDrawer || timeLeft <= 0) return;

    socket.emit("chat:send", {
      message: message.trim(),
    });

    setMessage("");
  };

  /* ---------- styling ---------- */

  const toolButtonClass = (selected) =>
    `flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40 ${
      selected
        ? "bg-indigo-600 text-white shadow-[0_8px_18px_-8px_rgba(79,70,229,0.9)]"
        : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
    }`;

  const cardClass =
    "rounded-3xl bg-white shadow-[0_24px_60px_-30px_rgba(55,48,163,0.5)]";

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* ---------- canvas card ---------- */}
      <div className={`${cardClass} min-w-0 p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
              Round {roundInfo?.roundNumber || 1} of{" "}
              {roundInfo?.totalRounds || 3}
            </p>

            <p className="mt-2 text-lg font-extrabold tracking-tight text-indigo-950">
              {isDrawer
                ? choosingWord
                  ? "Choose a word to draw"
                  : secretWord
                    ? "Your turn to draw!"
                    : "Waiting for word choices..."
                : `${roundInfo?.drawer?.username || "Player"} is drawing`}
            </p>
          </div>

          {isDrawer && secretWord && !choosingWord && (
            <div className="rounded-xl bg-amber-400 px-4 py-2.5 font-extrabold text-slate-900 shadow-[0_10px_24px_-12px_rgba(245,158,11,0.9)]">
              Word: {secretWord}
            </div>
          )}
        </div>

        {showTimer && (
          <div
            className={`mb-4 flex items-center justify-between rounded-2xl px-4 py-3 transition-colors ${
              timeLeft <= 10 ? "bg-rose-50" : "bg-emerald-50"
            }`}
          >
            <span
              className={`text-sm font-medium ${
                timeLeft <= 10 ? "text-rose-700" : "text-emerald-800"
              }`}
            >
              Time remaining
            </span>

            <span
              className={`text-2xl font-extrabold tabular-nums ${
                timeLeft <= 10 ? "text-rose-600" : "text-emerald-600"
              }`}
            >
              {timeLeft}s
            </span>
          </div>
        )}

        {isDrawer && choosingWord && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="mb-1 text-center text-lg font-extrabold text-amber-950">
              Choose your word
            </h2>

            <p className="mb-4 text-center text-sm text-amber-800/80">
              Select one word to start your drawing turn.
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {wordChoices.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => selectWord(word)}
                  className="rounded-xl bg-amber-400 px-3 py-3 font-bold text-slate-900 shadow-[0_8px_18px_-10px_rgba(245,158,11,0.9)] transition hover:-translate-y-0.5 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 active:translate-y-0"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        )}

        {!isDrawer && roundInfo?.phase === "choosing" && (
          <div className="mb-4 rounded-2xl bg-indigo-50 p-4 text-center">
            <p className="font-semibold text-indigo-950">
              {roundInfo?.drawer?.username || "The drawer"} is choosing a
              word...
            </p>

            <p className="mt-1 text-sm text-indigo-700/80">
              Get ready to guess!
            </p>
          </div>
        )}

        {!isDrawer && roundInfo?.phase === "drawing" && (
          <div className="mb-4 rounded-2xl bg-indigo-600 p-4 text-center text-white">
            <p className="mb-2 text-sm text-indigo-100">Guess the word</p>

            <p className="text-2xl font-extrabold tracking-[0.3em] text-amber-300">
              {hintPattern || "Waiting for hints..."}
            </p>

            {totalHints > 0 && (
              <p className="mt-2 text-xs text-indigo-100">
                Hints revealed: {hintsRevealed}/{totalHints}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-1.5">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onLostPointerCapture={stopDrawing}
            className={`block w-full rounded-xl bg-white ${
              canDraw ? "cursor-crosshair touch-none" : "cursor-default"
            }`}
          />
        </div>

        {isDrawer && secretWord && !choosingWord && (
          <div className="mt-4 space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!canDraw}
                onClick={() => setTool("brush")}
                className={toolButtonClass(tool === "brush")}
              >
                <ToolIcon>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
                </ToolIcon>
                Brush
              </button>

              <button
                type="button"
                disabled={!canDraw}
                onClick={() => setTool("fill")}
                className={toolButtonClass(tool === "fill")}
              >
                <ToolIcon>
                  <path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z" />
                  <path d="m5 2 5 5" />
                  <path d="M2 13h15" />
                  <path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z" />
                </ToolIcon>
                Bucket Fill
              </button>

              <button
                type="button"
                disabled={!canDraw}
                onClick={() => setTool("eraser")}
                className={toolButtonClass(tool === "eraser")}
              >
                <ToolIcon>
                  <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
                  <path d="M22 21H7" />
                  <path d="m5 11 9 9" />
                </ToolIcon>
                Eraser
              </button>

              <span
                aria-hidden="true"
                className="mx-1 hidden h-6 w-px bg-slate-300 sm:block"
              />

              <button
                type="button"
                disabled={!canDraw}
                onClick={undoDrawing}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ToolIcon>
                  <path d="M9 14 4 9l5-5" />
                  <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                </ToolIcon>
                Undo
              </button>

              <button
                type="button"
                disabled={!canDraw}
                onClick={clearCanvas}
                className="flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-rose-200 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ToolIcon>
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </ToolIcon>
                Clear Canvas
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {tool !== "eraser" && (
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    Color
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      disabled={!canDraw}
                      className="h-9 w-10 cursor-pointer rounded-lg border border-slate-300 bg-white p-0.5 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </label>

                  <div className="flex flex-wrap gap-1.5">
                    {PALETTE.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        aria-label={`Use color ${swatch}`}
                        disabled={!canDraw}
                        onClick={() => setColor(swatch)}
                        style={{ backgroundColor: swatch }}
                        className={`h-7 w-7 rounded-full border transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40 ${
                          color.toLowerCase() === swatch
                            ? "border-indigo-600 ring-2 ring-indigo-600 ring-offset-2"
                            : "border-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {tool === "eraser" ? (
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  Eraser size
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={eraserSize}
                    disabled={!canDraw}
                    onChange={(event) =>
                      setEraserSize(Number(event.target.value))
                    }
                    className="w-36 cursor-pointer accent-indigo-600 disabled:opacity-40"
                  />
                  <span className="min-w-12 rounded-lg bg-white px-2 py-1 text-center text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {eraserSize * 3}px
                  </span>
                </label>
              ) : tool === "brush" ? (
                <label className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  Brush size
                  <input
                    type="range"
                    min="2"
                    max="20"
                    value={brushSize}
                    disabled={!canDraw}
                    onChange={(event) =>
                      setBrushSize(Number(event.target.value))
                    }
                    className="w-36 cursor-pointer accent-indigo-600 disabled:opacity-40"
                  />
                  <span className="min-w-10 rounded-lg bg-white px-2 py-1 text-center text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {brushSize}px
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        )}

        {!isDrawer && (
          <p className="mt-3 text-sm text-slate-500">
            Guess the word in the chat. Only the drawer can draw.
          </p>
        )}
      </div>

      {/* ---------- chat card ---------- */}
      <div className={`${cardClass} flex min-h-[400px] flex-col p-4 sm:p-5`}>
        <h2 className="mb-4 text-lg font-extrabold tracking-tight text-indigo-950">
          Guesses & Chat
        </h2>

        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {messages.map((item, index) => (
            <div
              key={`${index}-${item.username}`}
              className={`break-words rounded-2xl px-3 py-2 text-sm ${
                item.correct
                  ? "bg-emerald-100 font-semibold text-emerald-800"
                  : "rounded-tl-md bg-slate-100 text-slate-800"
              }`}
            >
              {item.correct ? (
                <span>{item.username} guessed correctly!</span>
              ) : (
                <>
                  <span className="font-bold text-indigo-700">
                    {item.username}:{" "}
                  </span>

                  {item.message}
                </>
              )}
            </div>
          ))}

          {messages.length === 0 && (
            <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              Messages and guesses will appear here.
            </p>
          )}
        </div>

        <form onSubmit={sendMessage} className="mt-4 flex gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={
              isDrawer
                ? "Chat is disabled for the drawer"
                : "Type your guess..."
            }
            disabled={isDrawer || timeLeft <= 0}
            maxLength={200}
            className="h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/15 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={isDrawer || !message.trim() || timeLeft <= 0}
            className="h-11 rounded-xl bg-indigo-600 px-5 text-sm font-bold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default DrawingGame;
