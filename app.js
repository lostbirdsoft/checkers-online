// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-database.js";
var firebaseConfig = {
  apiKey: "AIzaSyD7oB0s8JeixcG8jqfT1XktAcTwjTC4_vM",
  authDomain: "lostbird-checkers.firebaseapp.com",
  databaseURL: "https://lostbird-checkers-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "lostbird-checkers",
  storageBucket: "lostbird-checkers.firebasestorage.app",
  messagingSenderId: "699586941802",
  appId: "1:699586941802:web:d643aa58a53f6600700b13",
  measurementId: "G-0FNMT6NSVH"
};
var API_URL = "https://script.google.com/macros/s/AKfycbyvk-hhak1TmeHWAeWxkfEWWwWadu-0RAgyR8SOOGf_NJ5Rl886wla4aeMkuk-blAMimA/exec";
var WORKER_URL = "wss://kadenuk-checkers.lostbirdsoft.workers.dev";
function apiCall(action, data = {}) {
  if (WORKER_URL) return wsCall(action, data);
  return new Promise((resolve, reject) => {
    const requestStarted = performance.now();
    const clientSentAt = Date.now();
    const callbackName = "checkersApi_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const payload = {
      action,
      roomId,
      initData: tg?.initData || "",
      clientSentAt,
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
      const durationMs = performance.now() - requestStarted;
      savePerf({
        type: "api_response",
        action,
        durationMs: Number(durationMs.toFixed(2)),
        server: result?.perf || null,
        success: !!result?.ok
      });
      cleanup();
      if (result && result.ok) resolve(result);
      else reject(new Error(result?.error || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0438\u0433\u0440\u043E\u0432\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430"));
    };
    script.onerror = () => {
      savePerf({
        type: "api_error",
        action,
        durationMs: Number((performance.now() - requestStarted).toFixed(2)),
        error: "Network error"
      });
      cleanup();
      reject(new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0441 \u0438\u0433\u0440\u043E\u0432\u044B\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C."));
    };
    const timeout = setTimeout(() => {
      savePerf({
        type: "api_timeout",
        action,
        durationMs: Number((performance.now() - requestStarted).toFixed(2))
      });
      cleanup();
      reject(new Error("\u0418\u0433\u0440\u043E\u0432\u043E\u0439 \u0441\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0432\u043E\u0432\u0440\u0435\u043C\u044F."));
    }, 2e4);
    script.src = API_URL + "?callback=" + encodeURIComponent(callbackName) + "&payload=" + encodeURIComponent(JSON.stringify(payload));
    document.head.appendChild(script);
  });
}
var wsSocket = null;
var wsConnecting = null;
var wsReqId = 0;
var wsPending = /* @__PURE__ */ new Map();
var wsPingTimer = null;
function wsConnect() {
  if (wsSocket && wsSocket.readyState === 1) return Promise.resolve(wsSocket);
  if (wsConnecting) return wsConnecting;
  wsConnecting = new Promise((resolve, reject) => {
    const socket = new WebSocket(WORKER_URL.replace(/\/$/, "") + "/ws?room=" + encodeURIComponent(roomId));
    socket._joined = false;
    socket.onopen = () => {
      wsSocket = socket;
      wsConnecting = null;
      clearInterval(wsPingTimer);
      wsPingTimer = setInterval(() => {
        if (socket.readyState === 1) socket.send("ping");
      }, 25e3);
      resolve(socket);
    };
    socket.onerror = () => {
      if (wsConnecting) {
        wsConnecting = null;
        reject(new Error("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u0432\u044F\u0437\u0430\u0442\u044C\u0441\u044F \u0441 \u0438\u0433\u0440\u043E\u0432\u044B\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C."));
      }
    };
    socket.onmessage = (event) => {
      if (event.data === "pong") return;
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (msg.type === "state") {
        applyWorkerState(msg);
        return;
      }
      const pending = wsPending.get(msg.id);
      if (!pending) return;
      wsPending.delete(msg.id);
      if (msg.ok) pending.resolve(msg);
      else pending.reject(new Error(msg.error || "\u041E\u0448\u0438\u0431\u043A\u0430 \u0438\u0433\u0440\u043E\u0432\u043E\u0433\u043E \u0441\u0435\u0440\u0432\u0435\u0440\u0430"));
    };
    socket.onclose = () => {
      clearInterval(wsPingTimer);
      if (wsSocket === socket) wsSocket = null;
      wsPending.forEach((p) => p.reject(new Error("\u0421\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0441 \u0438\u0433\u0440\u043E\u0432\u044B\u043C \u0441\u0435\u0440\u0432\u0435\u0440\u043E\u043C \u043F\u043E\u0442\u0435\u0440\u044F\u043D\u043E.")));
      wsPending.clear();
      if (joined) {
        setTimeout(() => {
          wsCall("join").catch(() => {
          });
        }, 1500);
      }
    };
  });
  return wsConnecting;
}
function wsSend(socket, action, data) {
  return new Promise((resolve, reject) => {
    const id = ++wsReqId;
    const timeout = setTimeout(() => {
      wsPending.delete(id);
      reject(new Error("\u0418\u0433\u0440\u043E\u0432\u043E\u0439 \u0441\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043E\u0442\u0432\u0435\u0442\u0438\u043B \u0432\u043E\u0432\u0440\u0435\u043C\u044F."));
    }, 2e4);
    wsPending.set(id, {
      resolve: (r) => {
        clearTimeout(timeout);
        resolve(r);
      },
      reject: (e) => {
        clearTimeout(timeout);
        reject(e);
      }
    });
    socket.send(JSON.stringify({ id, action, initData: tg?.initData || "", ...data }));
  });
}
async function wsCall(action, data = {}) {
  const requestStarted = performance.now();
  try {
    const socket = await wsConnect();
    if (action !== "join" && !socket._joined) {
      await wsSend(socket, "join", {});
      socket._joined = true;
    }
    const result = await wsSend(socket, action, data);
    if (action === "join") socket._joined = true;
    savePerf({
      type: "api_response",
      action,
      transport: "websocket",
      durationMs: Number((performance.now() - requestStarted).toFixed(2)),
      server: result.perf || null,
      success: true
    });
    return result;
  } catch (error) {
    savePerf({
      type: "api_error",
      action,
      transport: "websocket",
      durationMs: Number((performance.now() - requestStarted).toFixed(2)),
      error: String(error.message || error)
    });
    throw error;
  }
}
var moveSound = new Audio("move.mp3");
moveSound.preload = "auto";
function playMoveSound() {
  try {
    moveSound.currentTime = 0;
    moveSound.play().catch(() => {
    });
  } catch (e) {
  }
}
var ADS_PROVIDER = "adsgram";
var ADS_MIN_GAME_SECONDS = 1;
var ADS_ON_WIN = true;
var ADS_ON_RESIGN = true;
var ADS_ON_DRAW = true;
var ADSGRAM_TEST_MODE = true;
var ADSGRAM_BLOCK_ID_LIVE = "int-59594";
var ADSGRAM_BLOCK_ID_TEST = "int-59706";
var ADSGRAM_BLOCK_ID = ADSGRAM_TEST_MODE ? ADSGRAM_BLOCK_ID_TEST : ADSGRAM_BLOCK_ID_LIVE;
var TADS_WIDGET_ID = 13281;
var ADS_SHOW_ERRORS = false;
var TADS_DEBUG = true;
var MONETAG_ZONE = 12255757;
var MONETAG_SDK_SRC = "https://libtl.com/sdk.js";
function watchTadsRender(ms) {
  return new Promise((resolve) => {
    const seen = [];
    const add = (s) => {
      if (!seen.includes(s)) seen.push(s);
    };
    const onMsg = (e) => {
      if (typeof e.data === "string" && e.data.indexOf("FULLSCREEN") === 0) add("msg:" + e.data);
    };
    const onRes = (e) => {
      const t = e.target;
      if (t && t.tagName === "SCRIPT" && /tads/.test(t.src || "")) add((e.type === "error" ? "\u041E\u0428\u0418\u0411\u041A\u0410 \u0441\u043A\u0440\u0438\u043F\u0442\u0430 " : "\u0441\u043A\u0440\u0438\u043F\u0442 ") + t.src.split("/").pop());
    };
    const mo = new MutationObserver((list) => {
      for (const m of list) for (const n of m.addedNodes) if (n.nodeType === 1 && n.tagName === "DIV") add("\u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D \u0431\u043B\u043E\u043A \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0443");
    });
    window.addEventListener("message", onMsg);
    window.addEventListener("load", onRes, true);
    window.addEventListener("error", onRes, true);
    mo.observe(document.body, { childList: true });
    setTimeout(() => {
      window.removeEventListener("message", onMsg);
      window.removeEventListener("load", onRes, true);
      window.removeEventListener("error", onRes, true);
      mo.disconnect();
      resolve(seen.length ? seen.join("; ") : "\u0437\u0430 " + ms / 1e3 + " \u0441 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u043E");
    }, ms);
  });
}
var AD_PROVIDERS = {
  monetag: {
    script: MONETAG_SDK_SRC,
    attrs: { "data-zone": String(MONETAG_ZONE), "data-sdk": "show_" + MONETAG_ZONE },
    create() {
      const show = window["show_" + MONETAG_ZONE];
      if (typeof show !== "function") return null;
      return async () => {
        const ymid = String(roomId);
        await show({ type: "preload", ymid });
        return show({ ymid });
      };
    }
  },
  // Заглушка: рисует свой «рекламный» экран без обращения к каким-либо сетям. Нужна, чтобы проверять,
  // когда именно запускается реклама (после сдачи, ничьей, победы; не зрителям и не во время партии).
  test: {
    script: null,
    create() {
      return () => new Promise((resolve) => {
        const box = document.createElement("div");
        box.style.cssText = "position:fixed;inset:0;z-index:99999;background:rgba(10,12,20,.96);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:sans-serif;text-align:center;padding:24px";
        box.innerHTML = '<div style="font-size:44px">\u{1F9EA}</div><div style="font-size:20px;font-weight:700">\u0422\u0415\u0421\u0422\u041E\u0412\u0410\u042F \u0420\u0415\u041A\u041B\u0410\u041C\u0410</div><div style="opacity:.7;font-size:14px">\u0417\u0430\u0433\u043B\u0443\u0448\u043A\u0430, \u0441\u0435\u0442\u0438 \u043D\u0435 \u0432\u044B\u0437\u044B\u0432\u0430\u044E\u0442\u0441\u044F</div>';
        const btn = document.createElement("button");
        btn.style.cssText = "margin-top:10px;padding:12px 28px;font-size:16px;border:0;border-radius:10px;opacity:.5";
        btn.disabled = true;
        box.appendChild(btn);
        document.body.appendChild(box);
        let left = 3;
        btn.textContent = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0447\u0435\u0440\u0435\u0437 " + left;
        const timer = setInterval(() => {
          left--;
          if (left > 0) {
            btn.textContent = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0447\u0435\u0440\u0435\u0437 " + left;
            return;
          }
          clearInterval(timer);
          btn.textContent = "\u0417\u0430\u043A\u0440\u044B\u0442\u044C";
          btn.disabled = false;
          btn.style.opacity = "1";
        }, 1e3);
        btn.onclick = () => {
          box.remove();
          resolve({ done: true, test: true });
        };
      });
    }
  },
  adsgram: {
    script: "https://sad.adsgram.ai/js/sad.min.js",
    create() {
      const controller = window.Adsgram.init({ blockId: ADSGRAM_BLOCK_ID });
      return () => controller.show();
    }
  },
  tads: {
    script: "https://w.tads.me/widget.js",
    create() {
      if (!TADS_WIDGET_ID) return null;
      const controller = window.tads.init({
        widgetId: TADS_WIDGET_ID,
        type: "fullscreen",
        debug: TADS_DEBUG,
        onAdsNotFound: () => reportAdProblem("\u043D\u0435\u0442 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u0438\u0439 \u0434\u043B\u044F \u043F\u043E\u043A\u0430\u0437\u0430")
      });
      return async () => {
        if (!ADS_SHOW_ERRORS) return controller.showAd();
        const watching = watchTadsRender(6e3);
        const ack = await controller.showAd();
        return { ack: String(ack).slice(0, 40), after: await watching };
      };
    }
  }
};
var adShow = null;
var adsReady = (async () => {
  const provider = AD_PROVIDERS[ADS_PROVIDER];
  if (!provider) return;
  try {
    if (provider.script) await new Promise((resolve, reject) => {
      const tag = document.createElement("script");
      tag.src = provider.script;
      if (provider.attrs) for (const k in provider.attrs) tag.setAttribute(k, provider.attrs[k]);
      tag.onload = resolve;
      tag.onerror = reject;
      document.head.appendChild(tag);
    });
    adShow = provider.create();
  } catch (e) {
    adShow = null;
  }
})();
function reportAdProblem(text) {
  if (!ADS_SHOW_ERRORS) return;
  try {
    window.Telegram.WebApp.showAlert("\u0420\u0435\u043A\u043B\u0430\u043C\u0430 (" + ADS_PROVIDER + "): " + text);
  } catch (e) {
  }
}
function adAllowedForGame(g) {
  const reason = String(g && g.resultReason || "");
  const kind = g.status === "draw" ? "draw" : /сдал/i.test(reason) ? "resign" : "win";
  const allowed = kind === "draw" ? ADS_ON_DRAW : kind === "resign" ? ADS_ON_RESIGN : ADS_ON_WIN;
  if (!allowed) {
    reportAdProblem("\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430: \u0440\u0435\u043A\u043B\u0430\u043C\u0430 \u0434\u043B\u044F \u0442\u0438\u043F\u0430 \xAB" + kind + "\xBB \u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430");
    return false;
  }
  const start = Number(g.createdAt || 0);
  const end = Number(g.finishedAt || g.updatedAt || 0);
  if (start && end && ADS_MIN_GAME_SECONDS > 0) {
    const seconds = Math.round((end - start) / 1e3);
    if (seconds < ADS_MIN_GAME_SECONDS) {
      reportAdProblem("\u043F\u0440\u043E\u043F\u0443\u0449\u0435\u043D\u0430: \u043F\u0430\u0440\u0442\u0438\u044F \u0434\u043B\u0438\u043B\u0430\u0441\u044C " + seconds + " \u0441, \u043D\u0443\u0436\u043D\u043E \u043C\u0438\u043D\u0438\u043C\u0443\u043C " + ADS_MIN_GAME_SECONDS + " \u0441");
      return false;
    }
  }
  return true;
}
function showEndGameAd() {
  setTimeout(async () => {
    let stage = "\u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 SDK";
    let finished = false;
    const watchdog = setTimeout(() => {
      if (!finished) reportAdProblem("\u043D\u0435\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u0437\u0430 15 \u0441, \u0448\u0430\u0433: " + stage + " (\u043B\u0438\u0431\u043E \u0440\u0435\u043A\u043B\u0430\u043C\u0430 \u0435\u0449\u0451 \u0438\u0434\u0451\u0442)");
    }, 15e3);
    try {
      await adsReady;
      if (!adShow) {
        reportAdProblem(ADS_PROVIDER === "none" ? "\u0432\u044B\u043A\u043B\u044E\u0447\u0435\u043D\u0430" : "\u043D\u0435 \u0437\u0430\u043F\u0443\u0449\u0435\u043D\u0430 (\u043F\u0440\u043E\u0432\u0435\u0440\u044C ID \u0438\u043B\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0443 SDK)");
        return;
      }
      stage = "\u043E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u043E\u0442\u0432\u0435\u0442\u0430 \u0441\u0435\u0442\u0438";
      const result = await adShow();
      let text;
      try {
        text = JSON.stringify(result);
      } catch (e) {
        text = String(result);
      }
      reportAdProblem("\u043E\u0442\u0432\u0435\u0442 \u0441\u0435\u0442\u0438: " + (text === void 0 ? "\u043F\u0443\u0441\u0442\u043E (\u0431\u0435\u0437 \u043E\u0448\u0438\u0431\u043A\u0438)" : text));
    } catch (e) {
      reportAdProblem("\u043E\u0448\u0438\u0431\u043A\u0430: " + String(e && e.message || e));
    } finally {
      finished = true;
      clearTimeout(watchdog);
    }
  }, 1500);
}
function applyWorkerState(msg) {
  players = msg.players || {};
  updatePlayersUI();
  if (msg.game && msg.game.updatedAt) {
    savePerf({
      type: "ws_game_update",
      moveCount: Number(msg.game.moveCount || 0),
      turn: Number(msg.game.turn || 0),
      receiveDelayMs: Date.now() - Number(msg.game.updatedAt)
    });
  }
  if (msg.game && game && Number(msg.game.moveCount || 0) > Number(game.moveCount || 0)) {
    playMoveSound();
  }
  const gameJustEnded = game && game.status === "active" && msg.game && (msg.game.status === "finished" || msg.game.status === "draw");
  if (gameJustEnded && myPlayer && adAllowedForGame(msg.game)) showEndGameAd();
  game = msg.game || { status: "waiting", board: initialBoard(), turn: RED };
  selected = null;
  legalMovesForSelection = [];
  render();
}
var tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}
var params = new URLSearchParams(location.search);
var roomId = tg?.initDataUnsafe?.start_param || params.get("room") || "";
var telegramUser = tg?.initDataUnsafe?.user;
var el = {
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
  el.status.textContent = "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043A\u043E\u043C\u043D\u0430\u0442\u0443. \u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0438\u0437 \u0433\u0440\u0443\u043F\u043F\u044B.";
  throw new Error("Invalid room ID");
}
if (!telegramUser?.id) {
  el.status.textContent = "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0438\u0433\u0440\u0443 \u0432\u043D\u0443\u0442\u0440\u0438 Telegram \u0447\u0435\u0440\u0435\u0437 \u043A\u043D\u043E\u043F\u043A\u0443 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u044F.";
  throw new Error("Telegram user information is unavailable");
}
function getTelegramName(user) {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return "@" + user.username;
  return "\u0418\u0433\u0440\u043E\u043A";
}
var myUserId = String(telegramUser.id);
var myName = getTelegramName(telegramUser);
var myUsername = telegramUser.username ? "@" + telegramUser.username : "";
var app = initializeApp(firebaseConfig);
var db = getDatabase(app);
var roomRef = ref(db, `rooms/${roomId}`);
var playersRef = ref(db, `rooms/${roomId}/players`);
var gameRef = ref(db, `rooms/${roomId}/game`);
el.roomInfo.textContent = roomId;
var myPlayer = null;
var players = {};
var game = null;
var selected = null;
var legalMovesForSelection = [];
var busy = false;
var joined = false;
var PERF_STORAGE_KEY = "checkers_perf_" + roomId;
var perfLog = [];
function savePerf(entry) {
  const record = {
    time: (/* @__PURE__ */ new Date()).toISOString(),
    roomId,
    player: myPlayer || null,
    ...entry
  };
  perfLog.push(record);
  try {
    const previous = JSON.parse(localStorage.getItem(PERF_STORAGE_KEY) || "[]");
    previous.push(record);
    localStorage.setItem(
      PERF_STORAGE_KEY,
      JSON.stringify(previous.slice(-2e3))
    );
  } catch (error) {
    console.warn("\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0436\u0443\u0440\u043D\u0430\u043B \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438:", error);
  }
  console.log("[CHECKERS PERF]", record);
}
window.checkersPerf = {
  show() {
    const records = JSON.parse(localStorage.getItem(PERF_STORAGE_KEY) || "[]");
    console.table(records);
    return records;
  },
  download() {
    const records = JSON.parse(localStorage.getItem(PERF_STORAGE_KEY) || "[]");
    const blob = new Blob(
      [JSON.stringify(records, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "checkers-performance-" + roomId + ".json";
    link.click();
    URL.revokeObjectURL(url);
  },
  clear() {
    localStorage.removeItem(PERF_STORAGE_KEY);
    console.log("\u0416\u0443\u0440\u043D\u0430\u043B \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044C\u043D\u043E\u0441\u0442\u0438 \u043E\u0447\u0438\u0449\u0435\u043D.");
  }
};
var RED = 1;
var BLACK = 2;
var RED_KING = 3;
var BLACK_KING = 4;
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
var diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
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
        if (sideOf(currentBoard[victim]) === (side === RED ? BLACK : RED) && currentBoard[landing] === 0) {
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
function getName(slot) {
  return players[String(slot)]?.name || `\u0418\u0433\u0440\u043E\u043A ${slot}`;
}
function setStatus(message) {
  el.status.textContent = message;
}
function updatePlayersUI() {
  el.player1Name.textContent = players["1"]?.name || "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0438\u0433\u0440\u043E\u043A\u0430";
  el.player2Name.textContent = players["2"]?.name || "\u041E\u0436\u0438\u0434\u0430\u043D\u0438\u0435 \u0438\u0433\u0440\u043E\u043A\u0430";
  el.player1State.textContent = players["1"] ? "\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0401\u041D" : "\u041E\u0416\u0418\u0414\u0410\u041D\u0418\u0415";
  el.player2State.textContent = players["2"] ? "\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0401\u041D" : "\u041E\u0416\u0418\u0414\u0410\u041D\u0418\u0415";
  const activeTurn = game?.status === "active" ? game.turn : 0;
  el.playerCard1.classList.toggle("active", activeTurn === RED);
  el.playerCard2.classList.toggle("active", activeTurn === BLACK);
}
function statusLabel(status) {
  return {
    waiting: "\u041E\u0416\u0418\u0414\u0410\u041D\u0418\u0415",
    active: "\u0418\u0414\u0401\u0422 \u0418\u0413\u0420\u0410",
    finished: "\u0417\u0410\u0412\u0415\u0420\u0428\u0415\u041D\u0410",
    draw: "\u041D\u0418\u0427\u042C\u042F"
  }[status] || "\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0415\u041D\u0418\u0415";
}
function render() {
  if (!game) {
    el.turnInfo.textContent = "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u043A \u0438\u0433\u0440\u0435...";
    el.gameStatus.textContent = "\u041F\u041E\u0414\u041A\u041B\u042E\u0427\u0415\u041D\u0418\u0415";
    return;
  }
  updatePlayersUI();
  el.gameStatus.textContent = statusLabel(game.status);
  el.board.innerHTML = "";
  const board = Array.isArray(game.board) && game.board.length === 64 ? game.board : initialBoard();
  const possible = selected === null ? [] : legalMovesForSelection;
  const targets = new Set(possible.map((move) => move.to));
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
    el.turnInfo.textContent = "\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u0432\u0442\u043E\u0440\u043E\u0433\u043E \u0438\u0433\u0440\u043E\u043A\u0430";
    setStatus("\u041E\u0442\u043F\u0440\u0430\u0432\u044C\u0442\u0435 \u043F\u0440\u0438\u0433\u043B\u0430\u0448\u0435\u043D\u0438\u0435 \u0432 \u0433\u0440\u0443\u043F\u043F\u0443. \u041F\u0430\u0440\u0442\u0438\u044F \u043D\u0430\u0447\u043D\u0451\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438, \u043A\u043E\u0433\u0434\u0430 \u043F\u0440\u0438\u0441\u043E\u0435\u0434\u0438\u043D\u0438\u0442\u0441\u044F \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A.");
  } else if (game.status === "active") {
    el.turnInfo.textContent = `\u0425\u043E\u0434: ${getName(game.turn)}`;
    if (myPlayer && game.drawOffer && Number(game.drawOffer.by) !== myPlayer) {
      setStatus(`${getName(game.drawOffer.by)} \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0442 \u043D\u0438\u0447\u044C\u044E. \u041D\u0430\u0436\u043C\u0438\u0442\u0435 \xAB\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0438\u0442\u044C \u043D\u0438\u0447\u044C\u044E\xBB, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u0438\u043D\u044F\u0442\u044C \u0435\u0451.`);
      el.drawButton.textContent = "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043D\u0438\u0447\u044C\u044E";
    } else if (game.drawOffer && Number(game.drawOffer.by) === myPlayer) {
      setStatus("\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0438\u0447\u044C\u0435\u0439 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E. \u041E\u0436\u0438\u0434\u0430\u0435\u043C \u043E\u0442\u0432\u0435\u0442\u0430 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430.");
      el.drawButton.textContent = "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435";
    } else {
      el.drawButton.textContent = "\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0438\u0442\u044C \u043D\u0438\u0447\u044C\u044E";
      if (game.turn !== myPlayer) setStatus(`\u0421\u0435\u0439\u0447\u0430\u0441 \u0445\u043E\u0434 ${getName(game.turn)}.`);
      else setStatus("\u0412\u0430\u0448 \u0445\u043E\u0434. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0448\u0430\u0448\u043A\u0443.");
    }
  } else if (game.status === "finished") {
    el.turnInfo.textContent = game.winner ? `\u041F\u043E\u0431\u0435\u0434\u0438\u043B: ${getName(game.winner)}` : "\u041F\u0430\u0440\u0442\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430";
    setStatus(game.resultReason || "\u041F\u0430\u0440\u0442\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430. \u041C\u043E\u0436\u043D\u043E \u0441\u044B\u0433\u0440\u0430\u0442\u044C \u0440\u0435\u0432\u0430\u043D\u0448.");
  } else if (game.status === "draw") {
    el.turnInfo.textContent = "\u041D\u0438\u0447\u044C\u044F";
    setStatus(game.resultReason || "\u041F\u0430\u0440\u0442\u0438\u044F \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u043B\u0430\u0441\u044C \u0432\u043D\u0438\u0447\u044C\u044E.");
  }
  const active = game.status === "active" && !!myPlayer && !!players["1"] && !!players["2"];
  el.drawButton.disabled = !active || busy;
  el.resignButton.disabled = !active || busy;
  el.rematchButton.hidden = !myPlayer || !(game.status === "finished" || game.status === "draw");
  if (el.rematchButton.hidden) {
    el.rematchButton.textContent = "\u0420\u0435\u0432\u0430\u043D\u0448";
  } else {
    const votes = game.rematchVotes || {};
    el.rematchButton.textContent = votes[String(myPlayer)] ? "\u041E\u0436\u0438\u0434\u0430\u0435\u043C \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430..." : "\u0420\u0435\u0432\u0430\u043D\u0448";
    el.rematchButton.disabled = !!votes[String(myPlayer)] || busy;
  }
}
function handleCellClick(index) {
  if (!game || game.status !== "active" || !myPlayer || !joined) return;
  if (busy) return;
  if (game.turn !== myPlayer) {
    setStatus("\u0421\u0435\u0439\u0447\u0430\u0441 \u0445\u043E\u0434 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430.");
    return;
  }
  const piece = game.board[index];
  if (selected === null) {
    if (sideOf(piece) !== myPlayer) {
      setStatus("\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0441\u0432\u043E\u044E \u0448\u0430\u0448\u043A\u0443.");
      return;
    }
    const allMoves = generateLegalMoves(game.board, myPlayer);
    const moves = allMoves.filter((move) => move.from === index);
    if (moves.length === 0) {
      setStatus(allMoves.some((move) => move.captures.length) ? "\u0415\u0441\u0442\u044C \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E\u0435 \u0432\u0437\u044F\u0442\u0438\u0435. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0448\u0430\u0448\u043A\u0443, \u043A\u043E\u0442\u043E\u0440\u043E\u0439 \u043C\u043E\u0436\u043D\u043E \u0431\u0438\u0442\u044C." : "\u0423 \u044D\u0442\u043E\u0439 \u0448\u0430\u0448\u043A\u0438 \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0445\u043E\u0434\u043E\u0432.");
      return;
    }
    selected = index;
    legalMovesForSelection = moves;
    render();
    return;
  }
  if (sideOf(piece) === myPlayer) {
    const allMoves = generateLegalMoves(game.board, myPlayer);
    const moves = allMoves.filter((move) => move.from === index);
    if (moves.length > 0) {
      selected = index;
      legalMovesForSelection = moves;
      render();
    } else {
      setStatus("\u042D\u0442\u043E\u0439 \u0448\u0430\u0448\u043A\u043E\u0439 \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u043B\u044C\u0437\u044F \u0445\u043E\u0434\u0438\u0442\u044C.");
    }
    return;
  }
  const chosen = legalMovesForSelection.find((move) => move.to === index);
  if (!chosen) {
    setStatus("\u0422\u0430\u043A\u043E\u0439 \u0445\u043E\u0434 \u0441\u0435\u0439\u0447\u0430\u0441 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D.");
    return;
  }
  submitMove(chosen);
}
async function submitMove(chosenMove) {
  if (busy) return;
  busy = true;
  const moveStarted = performance.now();
  savePerf({
    type: "move_started",
    from: chosenMove.from,
    to: chosenMove.to,
    moveCount: Number(game?.moveCount || 0)
  });
  selected = null;
  legalMovesForSelection = [];
  render();
  try {
    await apiCall("move", {
      from: chosenMove.from,
      to: chosenMove.to
    });
    savePerf({
      type: "move_request_completed",
      durationMs: Number((performance.now() - moveStarted).toFixed(2))
    });
    setStatus("\u0425\u043E\u0434 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435 \u043F\u0440\u0438\u043D\u044F\u043B \u0445\u043E\u0434.");
  } finally {
    busy = false;
    render();
  }
}
async function joinRoom() {
  setStatus("\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0430\u0435\u043C\u0441\u044F \u043A \u043A\u043E\u043C\u043D\u0430\u0442\u0435...");
  try {
    const result = await apiCall("join");
    myPlayer = Number(result.player);
    players = result.players || {};
    joined = true;
    updatePlayersUI();
    if (result.spectator) setStatus("\u041A\u043E\u043C\u043D\u0430\u0442\u0430 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0430. \u0412\u044B \u043D\u0430\u0431\u043B\u044E\u0434\u0430\u0435\u0442\u0435 \u0437\u0430 \u043F\u0430\u0440\u0442\u0438\u0435\u0439.");
    else setStatus(myPlayer === RED ? "\u0412\u044B \u0438\u0433\u0440\u0430\u0435\u0442\u0435 \u043A\u0440\u0430\u0441\u043D\u044B\u043C\u0438." : "\u0412\u044B \u0438\u0433\u0440\u0430\u0435\u0442\u0435 \u0447\u0451\u0440\u043D\u044B\u043C\u0438.");
    render();
  } catch (error) {
    console.error(error);
    setStatus(error.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C\u0441\u044F \u043A \u043A\u043E\u043C\u043D\u0430\u0442\u0435.");
  }
}
onValue(playersRef, (snapshot) => {
  if (WORKER_URL) return;
  players = snapshot.val() || {};
  updatePlayersUI();
}, (error) => {
  console.error(error);
  setStatus("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u0438\u0433\u0440\u043E\u043A\u043E\u0432 \u0438\u0437 Firebase.");
});
onValue(gameRef, (snapshot) => {
  if (WORKER_URL) return;
  const value = snapshot.val();
  if (value && value.updatedAt) {
    const receiveDelay = Date.now() - Number(value.updatedAt);
    savePerf({
      type: "firebase_game_update",
      moveCount: Number(value.moveCount || 0),
      turn: Number(value.turn || 0),
      receiveDelayMs: receiveDelay
    });
  }
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
}, (error) => {
  console.error(error);
  setStatus("\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u043F\u0430\u0440\u0442\u0438\u0438 \u0441 Firebase.");
});
async function resign() {
  if (!game || game.status !== "active" || busy) return;
  if (!confirm("\u0412\u044B \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u043E \u0445\u043E\u0442\u0438\u0442\u0435 \u0441\u0434\u0430\u0442\u044C\u0441\u044F? \u0421\u043E\u043F\u0435\u0440\u043D\u0438\u043A \u043F\u043E\u0431\u0435\u0434\u0438\u0442.")) return;
  busy = true;
  render();
  try {
    await apiCall("resign");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u043F\u0430\u0440\u0442\u0438\u044E.");
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
    setStatus(error.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u043D\u0438\u0447\u044C\u0435\u0439.");
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
    setStatus("\u0417\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u0440\u0435\u0432\u0430\u043D\u0448 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D. \u041D\u0443\u0436\u0435\u043D \u043E\u0442\u0432\u0435\u0442 \u0441\u043E\u043F\u0435\u0440\u043D\u0438\u043A\u0430.");
  } catch (error) {
    console.error(error);
    setStatus(error.message || "\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0440\u0435\u0432\u0430\u043D\u0448.");
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
