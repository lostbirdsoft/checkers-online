import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getDatabase, ref, set, onValue
} from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";

// 1) Вставьте сюда настройки своего Firebase Web App.
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const params = new URLSearchParams(location.search);
const roomId =
  tg?.initDataUnsafe?.start_param ||
  params.get("room") ||
  "room_12345";

const player = Number(params.get("player")) === 2 ? 2 : 1;

if (!/^[a-zA-Z0-9_-]{1,50}$/.test(roomId)) {
  throw new Error("Некорректный ID комнаты");
}

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const moveRef = ref(db, `rooms/${roomId}/last_move`);

document.getElementById("playerInfo").textContent =
  `Игрок ${player} | Комната ${roomId}`;

function createInitialBoard() {
  const state = Array(64).fill(0);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) state[row * 8 + col] = 2;
    }
  }

  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) state[row * 8 + col] = 1;
    }
  }
  return state;
}

let board = createInitialBoard();
let turn = 1;
let selected = null;
let lastMove = null;
let latestMoveKey = null;

const boardElement = document.getElementById("board");

function renderBoard() {
  boardElement.innerHTML = "";

  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;
    const cell = document.createElement("div");

    cell.className = `cell ${(row + col) % 2 ? "dark" : "light"}`;

    if (lastMove && (i === lastMove.from || i === lastMove.to)) {
      cell.classList.add("last-move");
    }
    if (selected === i) cell.classList.add("selected");

    const piece = board[i];
    if (piece !== 0) {
      const element = document.createElement("div");
      element.className = "piece";
      element.classList.add(piece === 1 || piece === 3 ? "red" : "black");
      cell.appendChild(element);
    }

    cell.addEventListener("click", () => handleClick(i));
    boardElement.appendChild(cell);
  }

  document.getElementById("turnInfo").textContent =
    turn === 1 ? "Ход красных" : "Ход чёрных";
}

function handleClick(index) {
  if (turn !== player) {
    document.getElementById("status").textContent = "Сейчас ход соперника";
    return;
  }

  const piece = board[index];
  if (piece !== 0) {
    const mine =
      (player === 1 && (piece === 1 || piece === 3)) ||
      (player === 2 && (piece === 2 || piece === 4));

    if (mine) {
      selected = index;
      renderBoard();
    }
    return;
  }

  if (selected === null) return;

  const fromRow = Math.floor(selected / 8);
  const fromCol = selected % 8;
  const toRow = Math.floor(index / 8);
  const toCol = index % 8;
  const rowDiff = toRow - fromRow;
  const colDiff = Math.abs(toCol - fromCol);
  const correctDirection = player === 1 ? rowDiff === -1 : rowDiff === 1;

  if (colDiff !== 1 || !correctDirection) {
    document.getElementById("status").textContent =
      "Пока доступен только простой ход по диагонали";
    return;
  }

  sendMove(selected, index);
}

async function sendMove(from, to) {
  if (board[from] === 0 || board[to] !== 0) return;

  const nextBoard = [...board];
  nextBoard[to] = nextBoard[from];
  nextBoard[from] = 0;

  const move = {
    from,
    to,
    player,
    board: nextBoard,
    turn: player === 1 ? 2 : 1,
    sentAt: Date.now()
  };

  try {
    await set(moveRef, move);
    // Состояние обновит общий Firebase listener на обоих устройствах.
    selected = null;
    document.getElementById("status").textContent = "Ход отправлен";
  } catch (error) {
    console.error(error);
    document.getElementById("status").textContent =
      "Не удалось отправить ход. Проверьте Firebase и правила доступа.";
  }
}

onValue(moveRef, (snapshot) => {
  const move = snapshot.val();
  if (!move || !Array.isArray(move.board) || move.board.length !== 64) return;

  // Не применяем повторно то же самое событие.
  const moveKey = `${move.sentAt}_${move.player}_${move.from}_${move.to}`;
  if (moveKey === latestMoveKey) return;
  latestMoveKey = moveKey;

  board = move.board;
  turn = move.turn;
  selected = null;
  lastMove = move;
  renderBoard();

  document.getElementById("status").textContent =
    move.player === player ? "Ваш ход сохранён" : "Соперник сделал ход";
}, (error) => {
  console.error(error);
  document.getElementById("status").textContent =
    "Ошибка подключения к Firebase. Проверьте настройки и правила.";
});

renderBoard();
