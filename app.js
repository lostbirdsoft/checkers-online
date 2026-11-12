
import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";

import {
  getDatabase,
  ref,
  set,
  onValue,
  runTransaction
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

// Telegram initialization
const tg = window.Telegram?.WebApp;

if (tg) {
  tg.ready();
  tg.expand();
}

// Room ID
const params = new URLSearchParams(location.search);

const roomId =
  tg?.initDataUnsafe?.start_param ||
  params.get("room") ||
  "room_12345";

if (!/^[a-zA-Z0-9_-]{1,50}$/.test(roomId)) {
  throw new Error("Некорректный ID комнаты");
}

// Telegram user
const telegramUser = tg?.initDataUnsafe?.user;

if (!telegramUser?.id) {
  document.getElementById("status").textContent =
    "Откройте игру через Telegram, используя кнопку приглашения.";
  throw new Error("Telegram user information is unavailable");
}

// Player name
function getTelegramName(user) {
  const fullName = [
    user.first_name,
    user.last_name
  ].filter(Boolean).join(" ").trim();

  if (fullName) return fullName;

  if (user.username) return "@" + user.username;

  return "Игрок";
}

const myUserId = String(telegramUser.id);
const myName = getTelegramName(telegramUser);
const myUsername = telegramUser.username
  ? "@" + telegramUser.username
  : "";

// Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const playersRef = ref(db, `rooms/${roomId}/players`);
const moveRef = ref(db, `rooms/${roomId}/last_move`);

const boardElement = document.getElementById("board");
const playerInfo = document.getElementById("playerInfo");
const turnInfo = document.getElementById("turnInfo");
const statusInfo = document.getElementById("status");

// Game variables
let player = null;
let players = {};
let board = createInitialBoard();
let turn = 1;
let selected = null;
let lastMove = null;
let latestMoveKey = null;
let gameReady = false;

// Initial board
function createInitialBoard() {
  const state = Array(64).fill(0);

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        state[row * 8 + col] = 2;
      }
    }
  }

  for (let row = 5; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      if ((row + col) % 2 === 1) {
        state[row * 8 + col] = 1;
      }
    }
  }

  return state;
}

// Get player name by slot
function getPlayerName(slot) {
  return players[String(slot)]?.name || `Игрок ${slot}`;
}

// Update player information
function updatePlayerInfo() {
  if (!player) return;

  const opponentSlot = player === 1 ? 2 : 1;
  const opponent = players[String(opponentSlot)];

  playerInfo.textContent =
    `Вы: ${myName} | Игрок ${player} | Комната ${roomId}`;

  if (opponent) {
    statusInfo.textContent = `Соперник: ${opponent.name}`;
  } else {
    statusInfo.textContent = "Ожидаем второго игрока...";
  }

  renderBoard();
}

// Register player in Firebase
async function joinRoom() {
  statusInfo.textContent = "Подключаемся к игре...";

  try {
    const playerData = {
      id: myUserId,
      name: myName,
      username: myUsername,
      joinedAt: Date.now()
    };

    const result = await runTransaction(
      playersRef,
      (currentPlayers) => {
        const current = currentPlayers || {};

        // This Telegram user already has a place
        for (const slot of ["1", "2"]) {
          if (current[slot]?.id === myUserId) {
            return current;
          }
        }

        // First available place
        if (!current["1"]) {
          return {
            ...current,
            "1": playerData
          };
        }

        if (!current["2"]) {
          return {
            ...current,
            "2": playerData
          };
        }

        // Both places are occupied
        return;
      },
      {
        applyLocally: false
      }
    );

    const registeredPlayers = result.snapshot.val() || {};

    if (registeredPlayers["1"]?.id === myUserId) {
      player = 1;
    } else if (registeredPlayers["2"]?.id === myUserId) {
      player = 2;
    } else {
      statusInfo.textContent =
        "Кімната вже заповнена. Обидва місця зайняті.";
      playerInfo.textContent = "Місць для гравців немає";
      return;
    }

    players = registeredPlayers;
    gameReady = true;

    updatePlayerInfo();

    statusInfo.textContent = players["1"] && players["2"]
      ? "Гравці підключені. Можна грати!"
      : "Очікуємо другого гравця...";

  } catch (error) {
    console.error(error);
    statusInfo.textContent =
      "Не удалось подключиться к комнате. Проверьте Firebase.";
  }
}

// Listen for player information
onValue(playersRef, (snapshot) => {
  players = snapshot.val() || {};

  if (gameReady) {
    updatePlayerInfo();
  }
}, (error) => {
  console.error(error);
  statusInfo.textContent = "Ошибка загрузки игроков из Firebase.";
});

// Render board
function renderBoard() {
  if (!boardElement) return;

  boardElement.innerHTML = "";

  for (let i = 0; i < 64; i++) {
    const row = Math.floor(i / 8);
    const col = i % 8;

    const cell = document.createElement("div");

    cell.className =
      `cell ${(row + col) % 2 ? "dark" : "light"}`;

    if (lastMove && (i === lastMove.from || i === lastMove.to)) {
      cell.classList.add("last-move");
    }

    if (selected === i) {
      cell.classList.add("selected");
    }

    const piece = board[i];

    if (piece !== 0) {
      const element = document.createElement("div");

      element.className = "piece";
      element.classList.add(
        piece === 1 || piece === 3 ? "red" : "black"
      );

      cell.appendChild(element);
    }

    cell.addEventListener("click", () => handleClick(i));

    boardElement.appendChild(cell);
  }

  turnInfo.textContent =
    `Ход: ${getPlayerName(turn)}`;
}

// Handle board clicks
function handleClick(index) {
  if (!gameReady) {
    statusInfo.textContent = "Подождите подключения к игре.";
    return;
  }

  if (turn !== player) {
    statusInfo.textContent = "Сейчас ход соперника";
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

  const correctDirection =
    player === 1 ? rowDiff === -1 : rowDiff === 1;

  if (colDiff !== 1 || !correctDirection) {
    statusInfo.textContent =
      "Пока доступен только простой ход по диагонали";
    return;
  }

  sendMove(selected, index);
}

// Send move to Firebase
async function sendMove(from, to) {
  if (!gameReady || turn !== player) return;
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

    selected = null;
    statusInfo.textContent = "Ход отправлен";

  } catch (error) {
    console.error(error);

    statusInfo.textContent =
      "Не удалось отправить ход. Проверьте Firebase.";
  }
}

// Listen for moves
onValue(moveRef, (snapshot) => {
  const move = snapshot.val();

  if (!move || !Array.isArray(move.board) || move.board.length !== 64) {
    return;
  }

  const moveKey =
    `${move.sentAt}_${move.player}_${move.from}_${move.to}`;

  if (moveKey === latestMoveKey) return;

  latestMoveKey = moveKey;

  board = move.board;
  turn = move.turn;
  selected = null;
  lastMove = move;

  renderBoard();

  if (gameReady) {
    statusInfo.textContent =
      move.player === player
        ? "Ваш ход сохранён"
        : `${getPlayerName(move.player)} сделал ход`;
  }
}, (error) => {
  console.error(error);

  statusInfo.textContent =
    "Ошибка подключения к Firebase. Проверьте настройки и правила.";
});

// Start
renderBoard();
joinRoom();
