import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue
} from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7oB0s8JeixcG8jqfT1XktAcTwjTC4_vM",
  authDomain: "lostbird-checkers.firebaseapp.com",
  databaseURL: "https://lostbird-checkers-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lostbird-checkers",
  storageBucket: "lostbird-checkers.firebasestorage.app",
  messagingSenderId: "699586941802",
  appId: "1:699586941802:web:d643aa58a53f6600700b13",
  measurementId: "G-0FNMT6NSVH"
};

// Google Apps Script API. Keep this URL in sync with the deployed Web App.
const API_URL = "https://script.google.com/macros/s/AKfycbyvk-hhak1TmeHWAeWxkfEWWwWadu-0RAgyR8SOOGf_NJ5Rl886wla4aeMkuk-blAMimA/exec";

// JSONP lets the Mini App call Google Apps Script without browser CORS issues.
function apiCall(action, data = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = "checkersApi_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const payload = {
      action,
      roomId,
      initData: tg?.initData || "",
      ...data
    };
    const script = document.createElement("script");
    let finished = false;

    const cleanup = () => {
      if (finished) return;
      finished = true;
      delete window[callbackName];
      script.remove();
      clearTimeout(timeout);
    };

    window[callbackName] = (result) => {
      cleanup();
      if (result && result.ok) resolve(result);
      else reject(new Error(result?.error || "Ошибка игрового сервера"));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("Не удалось связаться с игровым сервером."));
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("Игровой сервер не ответил вовремя."));
    }, 20000);

    script.src = API_URL + "?callback=" + encodeURIComponent(callbackName) +
      "&payload=" + encodeURIComponent(JSON.stringify(payload));
    document.head.appendChild(script);
  });
}

// Telegram
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const params = new URLSearchParams(location.search);
const roomId =
  tg?.initDataUnsafe?.start_param ||
  params.get("room") ||
  "";

const telegramUser = tg?.initDataUnsafe?.user;

const el = {
  board: document.getElementById("board"),
  playerInfo: document.getElementById("playerInfo"),
  turnInfo: document.getElementById("turnInfo"),
  status: document.getElementById("status"),
  roomInfo: document.getElementById("roomInfo"),
  player1Name: document.getElementById("player1Name"),
  player2Name: document.getElementById("player2Name"),
  player1State: document.getElementById("player1State"),
  player2State: document.getElementById("player2State"),
  playerCard1: document.getElementById("playerCard1"),
  playerCard2: document.getElementById("playerCard2"),
  gameStatus: document.getElementById("gameStatus"),
  drawButton: document.getElementById("drawButton"),
  resignButton: document.getElementById("resignButton"),
  rematchButton: document.getElementById("rematchButton")
};

if (!roomId || !/^[a-zA-Z0-9_-]{1,50}$/.test(roomId)) {
  el.status.textContent = "Не удалось определить комнату. Откройте приглашение из группы.";
  throw new Error("Invalid room ID");
}

if (!telegramUser?.id) {
  el.status.textContent = "Откройте игру внутри Telegram через кнопку приглашения.";
  throw new Error("Telegram user information is unavailable");
}

function getTelegramName(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return "@" + user.username;
  return "Игрок";
}

const myUserId = String(telegramUser.id);
const myName = getTelegramName(telegramUser);
const myUsername = telegramUser.username ? "@" + telegramUser.username : "";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const roomRef = ref(db, `rooms/${roomId}`);
const playersRef = ref(db, `rooms/${roomId}/players`);
const gameRef = ref(db, `rooms/${roomId}/game`);

el.roomInfo.textContent = roomId;

let myPlayer = null;
let players = {};
let game = null;
let selected = null;
let legalMovesForSelection = [];
let busy = false;
let joined = false;

const RED = 1;
const BLACK = 2;
const RED_KING = 3;
const BLACK_KING = 4;

function initialBoard() {
  const board = Array(64).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) board[row * 8 + col] = BLACK;
    }
  }
  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) board[row * 8 + col] = RED;
    }
  }
  return board;
}

function sideOf(piece) {
  if (piece === RED || piece === RED_KING) return RED;
  if (piece === BLACK || piece === BLACK_KING) return BLACK;
  return 0;
}

function isKing(piece) {
  return piece === RED_KING || piece === BLACK_KING;
}

function promote(piece, row) {
  if (piece === RED && row === 0) return RED_KING;
  if (piece === BLACK && row === 7) return BLACK_KING;
  return piece;
}

function inside(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

// Return every complete capture sequence for one piece.
// Russian draughts: men capture forward and backward; kings fly.
function captureSequencesFrom(board, from) {
  const piece = board[from];
  const side = sideOf(piece);
  if (!side) return [];

  const results = [];

  function walk(currentBoard, position, currentPiece, path, captures) {
    const row = Math.floor(position / 8);
    const col = position % 8;
    const options = [];

    for (const [dr, dc] of diagonals) {
      if (!isKing(currentPiece)) {
        const victimRow = row + dr;
        const victimCol = col + dc;
        const landingRow = row + dr * 2;
        const landingCol = col + dc * 2;

        if (!inside(victimRow, victimCol) || !inside(landingRow, landingCol)) continue;

        const victim = victimRow * 8 + victimCol;
        const landing = landingRow * 8 + landingCol;

        if (
          sideOf(currentBoard[victim]) === (side === RED ? BLACK : RED) &&
          currentBoard[landing] === 0
        ) {
          options.push({ victim, landing });
        }
      } else {
        let r = row + dr;
        let c = col + dc;
        let victim = -1;

        while (inside(r, c)) {
          const index = r * 8 + c;
          const occupant = currentBoard[index];

          if (occupant !== 0) {
            if (sideOf(occupant) === side || victim !== -1) break;
            victim = index;
          } else if (victim !== -1) {
            options.push({ victim, landing: index });
          }

          r += dr;
          c += dc;
        }
      }
    }

    if (options.length === 0) {
      if (captures.length > 0) {
        results.push({
          from,
          to: position,
          path: [...path],
          captures: [...captures]
        });
      }
      return;
    }

    for (const option of options) {
      const nextBoard = [...currentBoard];
      nextBoard[position] = 0;
      nextBoard[option.victim] = 0;

      let nextPiece = currentPiece;
      const landingRow = Math.floor(option.landing / 8);
      nextPiece = promote(nextPiece, landingRow);
      nextBoard[option.landing] = nextPiece;

      walk(
        nextBoard,
        option.landing,
        nextPiece,
        [...path, option.landing],
        [...captures, option.victim]
      );
    }
  }

  walk([...board], from, piece, [], []);
  return results;
}

function generateLegalMoves(board, side) {
  const captures = [];

  for (let i = 0; i < 64; i++) {
    if (sideOf(board[i]) === side) {
      captures.push(...captureSequencesFrom(board, i));
    }
  }

  // Captures are mandatory.
  if (captures.length > 0) return captures;

  const moves = [];

  for (let i = 0; i < 64; i++) {
    const piece = board[i];
    if (sideOf(piece) !== side) continue;

    const row = Math.floor(i / 8);
    const col = i % 8;

    if (isKing(piece)) {
      for (const [dr, dc] of diagonals) {
        let r = row + dr;
        let c = col + dc;
        while (inside(r, c) && board[r * 8 + c] === 0) {
          moves.push({ from: i, to: r * 8 + c, path: [r * 8 + c], captures: [] });
          r += dr;
          c += dc;
        }
      }
    } else {
      const dr = side === RED ? -1 : 1;
      for (const dc of [-1, 1]) {
        const r = row + dr;
        const c = col + dc;
        if (inside(r, c) && board[r * 8 + c] === 0) {
          moves.push({ from: i, to: r * 8 + c, path: [r * 8 + c], captures: [] });
        }
      }
    }
  }

  return moves;
}

function applyMove(board, move) {
  const next = [...board];
  const piece = next[move.from];
  next[move.from] = 0;

  for (const captured of move.captures) next[captured] = 0;

  next[move.to] = promote(piece, Math.floor(move.to / 8));
  return next;
}

function countPieces(board, side) {
  return board.filter(piece => sideOf(piece) === side).length;
}

function positionKey(board, turn) {
  return board.join("") + ":" + turn;
}

function getName(slot) {
  return players[String(slot)]?.name || `Игрок ${slot}`;
}

function setStatus(message) {
  el.status.textContent = message;
}

function updatePlayersUI() {
  el.player1Name.textContent = players["1"]?.name || "Ожидание игрока";
  el.player2Name.textContent = players["2"]?.name || "Ожидание игрока";
  el.player1State.textContent = players["1"] ? "ПОДКЛЮЧЁН" : "ОЖИДАНИЕ";
  el.player2State.textContent = players["2"] ? "ПОДКЛЮЧЁН" : "ОЖИДАНИЕ";

  const activeTurn = game?.status === "active" ? game.turn : 0;
  el.playerCard1.classList.toggle("active", activeTurn === RED);
  el.playerCard2.classList.toggle("active", activeTurn === BLACK);
}

function statusLabel(status) {
  return ({
    waiting: "ОЖИДАНИЕ",
    active: "ИДЁТ ИГРА",
    finished: "ЗАВЕРШЕНА",
    draw: "НИЧЬЯ"
  })[status] || "ПОДКЛЮЧЕНИЕ";
}

function render() {
  if (!game) {
    el.turnInfo.textContent = "Подключение к игре...";
    el.gameStatus.textContent = "ПОДКЛЮЧЕНИЕ";
    return;
  }

  updatePlayersUI();
  el.gameStatus.textContent = statusLabel(game.status);
  el.board.innerHTML = "";

  const board = Array.isArray(game.board) && game.board.length === 64
    ? game.board
    : initialBoard();

  const possible = selected === null ? [] : legalMovesForSelection;
  const targets = new Set(possible.map(move => move.to));

  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const cell = document.createElement("div");

    cell.className = `cell ${(row + col) % 2 ? "dark" : "light"}`;

    if (game.lastMove && (i === game.lastMove.from || i === game.lastMove.to)) {
      cell.classList.add("last-move");
    }
    if (selected === i) cell.classList.add("selected");
    if (targets.has(i)) cell.classList.add("legal");

    const piece = board[i];
    if (piece !== 0) {
      const pieceElement = document.createElement("div");
      pieceElement.className = "piece";
      pieceElement.classList.add(sideOf(piece) === RED ? "red" : "black");
      if (isKing(piece)) pieceElement.classList.add("king");
      cell.appendChild(pieceElement);
    }

    cell.addEventListener("click", () => handleCellClick(i));
    el.board.appendChild(cell);
  }

  if (game.status === "waiting") {
    el.turnInfo.textContent = "Ожидаем второго игрока";
    setStatus("Отправьте приглашение в группу. Партия начнётся автоматически, когда присоединится соперник.");
  } else if (game.status === "active") {
    el.turnInfo.textContent = `Ход: ${getName(game.turn)}`;
    if (game.drawOffer && Number(game.drawOffer.by) !== myPlayer) {
      setStatus(`${getName(game.drawOffer.by)} предлагает ничью. Нажмите «Предложить ничью», чтобы принять её.`);
      el.drawButton.textContent = "Принять ничью";
    } else if (game.drawOffer && Number(game.drawOffer.by) === myPlayer) {
      setStatus("Предложение ничьей отправлено. Ожидаем ответа соперника.");
      el.drawButton.textContent = "Отменить предложение";
    } else {
      el.drawButton.textContent = "Предложить ничью";
      if (game.turn !== myPlayer) setStatus(`Сейчас ход ${getName(game.turn)}.`);
      else setStatus("Ваш ход. Выберите шашку.");
    }
  } else if (game.status === "finished") {
    el.turnInfo.textContent = game.winner
      ? `Победил: ${getName(game.winner)}`
      : "Партия завершена";
    setStatus(game.resultReason || "Партия завершена. Можно сыграть реванш.");
  } else if (game.status === "draw") {
    el.turnInfo.textContent = "Ничья";
    setStatus(game.resultReason || "Партия завершилась вничью.");
  }

  const active = game.status === "active" && !!myPlayer && !!players["1"] && !!players["2"];
  el.drawButton.disabled = !active || busy;
  el.resignButton.disabled = !active || busy;
  el.rematchButton.hidden = !(game.status === "finished" || game.status === "draw");
  if (el.rematchButton.hidden) {
    el.rematchButton.textContent = "Реванш";
  } else {
    const votes = game.rematchVotes || {};
    el.rematchButton.textContent = votes[String(myPlayer)]
      ? "Ожидаем соперника..."
      : "Реванш";
    el.rematchButton.disabled = !!votes[String(myPlayer)] || busy;
  }
}

function handleCellClick(index) {
  if (!game || game.status !== "active" || !myPlayer || !joined) return;
  if (busy) return;

  if (game.turn !== myPlayer) {
    setStatus("Сейчас ход соперника.");
    return;
  }

  const piece = game.board[index];

  if (selected === null) {
    if (sideOf(piece) !== myPlayer) {
      setStatus("Выберите свою шашку.");
      return;
    }

    const allMoves = generateLegalMoves(game.board, myPlayer);
    const moves = allMoves.filter(move => move.from === index);

    if (moves.length === 0) {
      setStatus(allMoves.some(move => move.captures.length)
        ? "Есть обязательное взятие. Выберите шашку, которой можно бить."
        : "У этой шашки сейчас нет доступных ходов.");
      return;
    }

    selected = index;
    legalMovesForSelection = moves;
    render();
    return;
  }

  if (sideOf(piece) === myPlayer) {
    const allMoves = generateLegalMoves(game.board, myPlayer);
    const moves = allMoves.filter(move => move.from === index);

    if (moves.length > 0) {
      selected = index;
      legalMovesForSelection = moves;
      render();
    } else {
      setStatus("Этой шашкой сейчас нельзя ходить.");
    }
    return;
  }

  const chosen = legalMovesForSelection.find(move => move.to === index);
  if (!chosen) {
    setStatus("Такой ход сейчас недоступен.");
    return;
  }

  submitMove(chosen);
}

async function submitMove(chosenMove) {
  if (busy) return;
  busy = true;
  selected = null;
  legalMovesForSelection = [];
  render();

  try {
    await apiCall("move", {
      from: chosenMove.from,
      to: chosenMove.to
    });
    setStatus("Ход отправлен.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Сервер не принял ход.");
  } finally {
    busy = false;
    render();
  }
}

async function joinRoom() {
  setStatus("Подключаемся к комнате...");

  try {
    const result = await apiCall("join");
    myPlayer = Number(result.player);
    players = result.players || {};
    joined = true;
    updatePlayersUI();
    setStatus(myPlayer === RED ? "Вы играете красными." : "Вы играете чёрными.");
    render();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Не удалось подключиться к комнате.");
  }
}

// Player list listener also starts the game when the second participant arrives.
onValue(playersRef, snapshot => {
  players = snapshot.val() || {};
  updatePlayersUI();

}, error => {
  console.error(error);
  setStatus("Ошибка загрузки игроков из Firebase.");
});

onValue(gameRef, snapshot => {
  const value = snapshot.val();

  if (!value) {
    game = {
      status: "waiting",
      board: initialBoard(),
      turn: RED
    };
  } else {
    game = value;
  }

  selected = null;
  legalMovesForSelection = [];
  render();
}, error => {
  console.error(error);
  setStatus("Ошибка синхронизации партии с Firebase.");
});

async function resign() {
  if (!game || game.status !== "active" || busy) return;
  if (!confirm("Вы действительно хотите сдаться? Соперник победит.")) return;

  busy = true;
  render();
  try {
    await apiCall("resign");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Не удалось завершить партию.");
  } finally {
    busy = false;
    render();
  }
}

async function handleDrawButton() {
  if (!game || game.status !== "active" || busy) return;
  busy = true;
  render();
  try {
    await apiCall("draw");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Не удалось отправить предложение ничьей.");
  } finally {
    busy = false;
    render();
  }
}

async function requestRematch() {
  if (!game || !["finished", "draw"].includes(game.status) || busy) return;
  busy = true;
  render();
  try {
    await apiCall("rematch");
    setStatus("Запрос на реванш отправлен. Нужен ответ соперника.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "Не удалось запросить реванш.");
  } finally {
    busy = false;
    render();
  }
}

el.resignButton.addEventListener("click", resign);
el.drawButton.addEventListener("click", handleDrawButton);
el.rematchButton.addEventListener("click", requestRematch);

render();
joinRoom();
