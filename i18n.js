// ======================================== ЯЗЫК ИНТЕРФЕЙСА (RU / UK / EN) ========================================
// Подключается в index.html до app.js. Тексты в игре написаны по-русски; этот файл переводит их «на лету»,
// поэтому остальной код игры не затрагивается. Новый текст в игре = добавь строку в словарь DICT ниже.
(function () {
  "use strict";

  // --- Настройки и флаги ---
  var I18N_ENABLED = true;           // false = переводы и кнопка языка полностью выключены
  var AUTO_DETECT = true;            // автоопределение языка, если игрок сам ещё не выбирал
  var IP_DETECT_ENABLED = true;      // запасной вариант: страна по IP, только если язык не удалось понять по телефону и Telegram
  var IP_GEO_URL = "https://kadenuk-checkers.lostbirdsoft.workers.dev/geo"; // эндпоинт нашего воркера: отдаёт страну по IP
  var IP_TIMEOUT_MS = 2500;
  var FALLBACK_LANG = "ru";          // язык, пока ничего не определилось
  var IP_COUNTRY_LANG = { UA: "uk", RU: "ru", BY: "ru", KZ: "ru" }; // остальные страны мира = en
  var STORAGE_KEY = "checkers_lang"; // сюда пишется ручной выбор игрока
  var LANGS = ["ru", "uk", "en"];    // порядок в списке
  var NAMES = { ru: "Русский", uk: "Українська", en: "English" };
  var SHORT = { ru: "RU", uk: "UK", en: "EN" };

  if (!I18N_ENABLED) { window.I18N = { lang: "ru", set: function () {}, picker: function () { return document.createElement("span"); }, tr: function (s) { return s; } }; return; }

  // --- Словарь: [русский, украинский, английский, часть?]. «часть» = true: ищется внутри строки (для текстов со вставками). ---
  var DICT = [
    ["Шашки онлайн", "Шашки онлайн", "Checkers Online"],
    ["Классика", "Класика", "Classic"],
    ["Поддавки", "Піддавки", "Giveaway"],
    ["ПОДДАВКИ: побеждает тот, кто остался без шашек или ходов", "ПІДДАВКИ: перемагає той, хто залишився без шашок або ходів", "GIVEAWAY: whoever runs out of pieces or moves wins"],
    ["Турбо", "Турбо", "Turbo"],
    ["ТУРБО: на ход ", "ТУРБО: на хід ", "TURBO: per move ", true],
    [" секунд", " секунд", " seconds", true],
    ["Чапаев", "Чапаєв", "Chapaev"],
    ["Лёгкий", "Легкий", "Easy", true],
    ["Средний", "Середній", "Medium", true],
    ["Сильный", "Сильний", "Strong", true],
    ["Ошибка игрового сервера", "Помилка ігрового сервера", "Game server error"],
    ["Не удалось связаться с игровым сервером.", "Не вдалося зв'язатися з ігровим сервером.", "Couldn't reach the game server."],
    ["Игровой сервер не ответил вовремя.", "Ігровий сервер не відповів вчасно.", "The game server didn't respond in time."],
    ["Соединение с игровым сервером потеряно.", "З'єднання з ігровим сервером втрачено.", "Connection to the game server was lost."],
    ["Настройки", "Налаштування", "Settings"],
    ["Закрыть", "Закрити", "Close"],
    ["Закрыть через ", "Закрити через ", "Close in ", true],
    ["ТЕСТОВАЯ РЕКЛАМА", "ТЕСТОВА РЕКЛАМА", "TEST AD"],
    ["Звук", "Звук", "Sound"],
    ["Громкость", "Гучність", "Volume"],
    ["В главное меню", "До головного меню", "To main menu"],
    ["История ходов", "Історія ходів", "Move history"],
    ["Ходов пока нет.", "Ходів поки немає.", "No moves yet."],
    ["История ходов недоступна.", "Історія ходів недоступна.", "Move history isn't available."],
    ["Время на ход вышло.", "Час на хід вийшов.", "Time for the move is up."],
    ["Зрители: ", "Глядачі: ", "Spectators: ", true],
    ["Ничья", "Нічия", "Draw"],
    ["Победил: ", "Переміг: ", "Winner: ", true],
    ["красные", "червоні", "red", true],
    ["чёрные", "чорні", "black", true],
    ["Красные", "Червоні", "Red"],
    ["Чёрные", "Чорні", "Black"],
    ["Не удалось определить комнату. Откройте приглашение из группы.", "Не вдалося визначити кімнату. Відкрийте запрошення з групи.", "Couldn't determine the room. Open the invitation from the group."],
    ["Откройте игру внутри Telegram через кнопку приглашения.", "Відкрийте гру в Telegram через кнопку запрошення.", "Open the game inside Telegram via the invitation button."],
    ["Игрок", "Гравець", "Player"],
    ["Игрок ", "Гравець ", "Player ", true],
    ["Вы", "Ви", "You"],
    ["МЕНЮ", "МЕНЮ", "MENU"],
    ["Ожидание игрока", "Очікування гравця", "Waiting for player"],
    ["ПОДКЛЮЧЁН", "ПІДКЛЮЧЕНО", "CONNECTED"],
    ["ОЖИДАНИЕ", "ОЧІКУВАННЯ", "WAITING"],
    ["ИДЁТ ИГРА", "ГРА ТРИВАЄ", "IN PROGRESS"],
    ["ЗАВЕРШЕНА", "ЗАВЕРШЕНО", "FINISHED"],
    ["НИЧЬЯ", "НІЧИЯ", "DRAW"],
    ["ПОДКЛЮЧЕНИЕ", "ПІДКЛЮЧЕННЯ", "CONNECTING"],
    ["Подключение к игре...", "Підключення до гри...", "Connecting to the game..."],
    ["Подключение...", "Підключення...", "Connecting..."],
    ["Подключаемся к Firebase...", "Підключаємося...", "Connecting..."],
    ["Ожидаем второго игрока", "Чекаємо на другого гравця", "Waiting for the second player"],
    ["Отправьте приглашение в группу. Партия начнётся автоматически, когда присоединится соперник.", "Надішліть запрошення в групу. Партія почнеться автоматично, коли приєднається суперник.", "Send the invitation to the group. The game starts automatically when an opponent joins."],
    ["Ход: ", "Хід: ", "Turn: ", true],
    [" предлагает ничью. Нажмите «Предложить ничью», чтобы принять её.", " пропонує нічию. Натисніть «Запропонувати нічию», щоб прийняти її.", " offers a draw. Press “Offer a draw” to accept.", true],
    ["Принять ничью", "Прийняти нічию", "Accept draw"],
    ["Предложение ничьей отправлено. Ожидаем ответа соперника.", "Пропозицію нічиєї надіслано. Чекаємо відповіді суперника.", "Draw offer sent. Waiting for the opponent's reply."],
    ["Отменить предложение", "Скасувати пропозицію", "Cancel offer"],
    ["Предложить ничью", "Запропонувати нічию", "Offer a draw"],
    ["Сейчас ход ", "Зараз хід ", "Now it's the turn of ", true],
    ["Ваш ход. Выберите шашку.", "Ваш хід. Оберіть шашку.", "Your turn. Select a piece."],
    ["Победил: ", "Переміг: ", "Winner: ", true],
    ["Партия завершена", "Партію завершено", "Game over"],
    ["Партия завершена. Можно сыграть реванш.", "Партію завершено. Можна зіграти реванш.", "Game over. You can play a rematch."],
    ["Ничья", "Нічия", "Draw"],
    ["Партия завершилась вничью.", "Партія завершилася внічию.", "The game ended in a draw."],
    ["Реванш", "Реванш", "Rematch"],
    ["Ожидаем соперника...", "Чекаємо на суперника...", "Waiting for the opponent..."],
    ["Сейчас ход соперника.", "Зараз хід суперника.", "It's the opponent's turn."],
    ["Выберите свою шашку.", "Оберіть свою шашку.", "Select your piece."],
    ["Есть обязательное взятие. Выберите шашку, которой можно бить.", "Є обов'язкове взяття. Оберіть шашку, якою можна бити.", "A capture is mandatory. Select a piece that can capture."],
    ["У этой шашки сейчас нет доступных ходов.", "У цієї шашки зараз немає доступних ходів.", "This piece has no available moves right now."],
    ["Этой шашкой сейчас нельзя ходить.", "Цією шашкою зараз не можна ходити.", "This piece can't move right now."],
    ["Такой ход сейчас недоступен.", "Такий хід зараз недоступний.", "That move isn't available right now."],
    ["Ход отправлен.", "Хід надіслано.", "Move sent."],
    ["Сервер не принял ход.", "Сервер не прийняв хід.", "The server didn't accept the move."],
    ["Подключаемся к комнате...", "Підключаємося до кімнати...", "Joining the room..."],
    ["Комната заполнена. Вы наблюдаете за партией.", "Кімната заповнена. Ви спостерігаєте за партією.", "The room is full. You're watching the game."],
    ["Вы играете красными.", "Ви граєте червоними.", "You're playing red."],
    ["Вы играете чёрными.", "Ви граєте чорними.", "You're playing black."],
    ["Сессия устарела. Введите ник заново.", "Сесія застаріла. Введіть нікнейм заново.", "Session expired. Enter your nickname again."],
    ["Не удалось подключиться к комнате.", "Не вдалося підключитися до кімнати.", "Couldn't join the room."],
    ["Ошибка загрузки игроков из Firebase.", "Помилка завантаження гравців.", "Error loading players."],
    ["Ошибка синхронизации партии с Firebase.", "Помилка синхронізації партії.", "Game sync error."],
    ["Вы действительно хотите сдаться? Соперник победит.", "Ви дійсно хочете здатися? Суперник переможе.", "Do you really want to resign? Your opponent will win."],
    ["Не удалось завершить партию.", "Не вдалося завершити партію.", "Couldn't finish the game."],
    ["Не удалось отправить предложение ничьей.", "Не вдалося надіслати пропозицію нічиєї.", "Couldn't send the draw offer."],
    ["Запрос на реванш отправлен. Нужен ответ соперника.", "Запит на реванш надіслано. Потрібна відповідь суперника.", "Rematch request sent. Waiting for the opponent's reply."],
    ["Не удалось запросить реванш.", "Не вдалося запросити реванш.", "Couldn't request a rematch."],
    ["Поддавки: ", "Піддавки: ", "Giveaway: ", true],
    [" остался без шашек и победил.", " залишився без шашок і переміг.", " has no pieces left and wins.", true],
    [" остался без ходов и победил.", " залишився без ходів і переміг.", " has no moves left and wins.", true],
    ["У соперника не осталось шашек.", "У суперника не залишилося шашок.", "The opponent has no pieces left."],
    ["У соперника не осталось доступных ходов.", "У суперника не залишилося доступних ходів.", "The opponent has no available moves."],
    ["Ничья: позиция повторилась три раза.", "Нічия: позиція повторилася тричі.", "Draw: the position repeated three times."],
    ["Ничья: 80 полуходов без взятия или превращения в дамку.", "Нічия: 80 напівходів без взяття чи перетворення на дамку.", "Draw: 80 half-moves without a capture or promotion."],
    ["Партия не создана.", "Партію не створено.", "The game hasn't been created."],
    ["Партия уже завершена.", "Партію вже завершено.", "The game is already over."],
    ["Недопустимый ход.", "Недопустимий хід.", "Invalid move."],
    ["Вы сдались.", "Ви здалися.", "You resigned."],
    ["Игроки согласились на ничью.", "Гравці погодилися на нічию.", "The players agreed to a draw."],
    ["Компьютер отклонил предложение ничьей.", "Комп'ютер відхилив пропозицію нічиєї.", "The computer declined the draw offer."],
    ["Неизвестное действие.", "Невідома дія.", "Unknown action."],
    ["Компьютер (", "Комп'ютер (", "Computer (", true],
    ["С КОМПЬЮТЕРОМ", "З КОМП'ЮТЕРОМ", "VS COMPUTER"],
    ["Компьютер", "Комп'ютер", "Computer"],
    ["Сдаться", "Здатися", "Resign"],
    ["Сдаться?", "Здатися?", "Resign?"],
    ["Ждём соперника… Код комнаты: ", "Чекаємо на суперника… Код кімнати: ", "Waiting for the opponent… Room code: ", true],
    ["Летят шашки…", "Летять шашки…", "Pieces are flying…"],
    ["Ход красных", "Хід червоних", "Red's turn"],
    ["Ход чёрных", "Хід чорних", "Black's turn"],
    ["Бонусный удар!", "Бонусний удар!", "Bonus shot!"],
    ["Ваш ход: оттяните шашку назад и отпустите", "Ваш хід: відтягніть шашку назад і відпустіть", "Your turn: pull a piece back and release", true],
    ["Соперник бьёт ещё раз…", "Суперник б'є ще раз…", "The opponent shoots again…"],
    ["Ход соперника…", "Хід суперника…", "Opponent's turn…"],
    ["Ход компьютера…", "Хід комп'ютера…", "Computer's turn…"],
    [": оттяните шашку назад и отпустите", ": відтягніть шашку назад і відпустіть", ": pull a piece back and release", true],
    ["Компьютер победил", "Комп'ютер переміг", "The computer won"],
    ["Вы победили!", "Ви перемогли!", "You won!"],
    ["Победили красные", "Перемогли червоні", "Red wins"],
    ["Победили чёрные", "Перемогли чорні", "Black wins"],
    [": чистый удар, бонусный удар!", ": чистий удар, бонусний удар!", ": clean hit, bonus shot!", true],
    ["Не удалось сделать удар.", "Не вдалося зробити удар.", "The shot failed."],
    ["Вы проиграли", "Ви програли", "You lost"],
    ["Ждём соперника…", "Чекаємо на суперника…", "Waiting for the opponent…"],
    ["Ещё раз", "Ще раз", "Again"],
    ["В меню", "У меню", "Menu"],
    ["Меню", "Меню", "Menu"],
    ["Заново", "Заново", "Restart"],
    ["Соединение закрыто.", "З'єднання закрито.", "Connection closed."],
    ["КОД ", "КОД ", "CODE ", true],
    ["Выйти в меню? Текущая партия будет потеряна.", "Вийти в меню? Поточну партію буде втрачено.", "Exit to the menu? The current game will be lost."],
    ["Сдаться и выйти в меню?", "Здатися і вийти в меню?", "Resign and exit to the menu?"],
    ["Код комнаты", "Код кімнати", "Room code"],
    ["Отправьте код или ссылку другу, чтобы он присоединился.", "Надішліть код або посилання другу, щоб він приєднався.", "Send the code or link to a friend so they can join."],
    ["Поделиться", "Поділитися", "Share"],
    ["Ссылка для браузера", "Посилання для браузера", "Browser link"],
    ["Ссылка скопирована", "Посилання скопійовано", "Link copied"],
    ["Скопировать код", "Скопіювати код", "Copy code"],
    ["Код скопирован", "Код скопійовано", "Code copied"],
    ["Код: ", "Код: ", "Code: ", true],
    ["Сыграем в шашки? Код комнаты: ", "Зіграємо в шашки? Код кімнати: ", "Shall we play checkers? Room code: ", true], // текст сообщения при «Поделиться»
    ["Рейтинг", "Рейтинг", "Leaderboard"],
    ["Очки идут за победы в онлайн-партиях.", "Очки нараховуються за перемоги в онлайн-партіях.", "Points are earned for wins in online games."],
    ["Назад", "Назад", "Back"],
    ["Загрузка…", "Завантаження…", "Loading…"],
    ["Загрузка...", "Завантаження...", "Loading..."],
    ["Победа +", "Перемога +", "Win +", true],
    [", поражение −", ", поразка −", ", loss −", true],
    [" (ниже нуля не опускается). Считаются онлайн-партии.", " (нижче нуля не опускається). Враховуються онлайн-партії.", " (never drops below zero). Online games count.", true],
    ["Пока никого. Сыграйте онлайн и станьте первым!", "Поки нікого. Зіграйте онлайн і станьте першим!", "Nobody yet. Play online and be the first!"],
    [" очк.", " очк.", " pts", true],
    [" побед / ", " перемог / ", " wins / ", true],
    [" поражений · ", " поразок · ", " losses · ", true],
    [" поражений", " поразок", " losses", true],
    ["Вы: ", "Ви: ", "You: ", true],
    [" очк. · ", " очк. · ", " pts · ", true],
    [" побед, ", " перемог, ", " wins, ", true],
    ["место ", "місце ", "rank ", true],
    ["вне топа", "поза топом", "outside the top", true],
    ["Вы пока не играли рейтинговых партий.", "Ви поки не грали рейтингових партій.", "You haven't played any ranked games yet."],
    ["Не удалось загрузить рейтинг.", "Не вдалося завантажити рейтинг.", "Couldn't load the leaderboard."],
    ["У каждого ", "У кожного ", "Each player has ", true],
    [" шашек. Оттяни свою шашку назад, как рогатку, и отпусти: выбей шашки соперника с доски. ", " шашок. Відтягни свою шашку назад, як рогатку, і відпусти: вибий шашки суперника з дошки. ", " pieces. Pull your piece back like a slingshot and release: knock the opponent's pieces off the board. ", true],
    ["Выбил чужую и не потерял свою — получаешь бонусный удар (не больше ", "Вибив чужу і не втратив свою — отримуєш бонусний удар (не більше ", "Knock out an enemy piece without losing yours and you get a bonus shot (no more than ", true],
    [" ударов подряд). ", " ударів поспіль). ", " shots in a row). ", true],
    ["Вылетела своя — она выбывает. ", "Вилетіла своя — вона вибуває. ", "If your own piece falls off, it's out. ", true],
    ["Боковые борта отбивают шашки, вылететь можно только через верх и низ. ", "Бічні борти відбивають шашки, вилетіти можна лише через верх і низ. ", "The side walls bounce pieces back; they can only fall off through the top and bottom. ", true],
    ["Побеждает тот, кто выбил все шашки соперника.", "Перемагає той, хто вибив усі шашки суперника.", "The winner is whoever knocks out all of the opponent's pieces."],
    ["Соперник", "Суперник", "Opponent"],
    ["Компьютер", "Комп'ютер", "Computer"],
    ["Вдвоём", "Удвох", "Two players"],
    ["Сложность компьютера", "Складність комп'ютера", "Computer difficulty"],
    ["Начать игру", "Почати гру", "Start game"],
    ["Настройки", "Налаштування", "Settings"],
    ["Включён", "Увімкнено", "On"],
    ["Выключен", "Вимкнено", "Off"],
    ["Интерфейс", "Інтерфейс", "Interface"],
    ["Анимации: вкл", "Анімації: увімк.", "Animations: on"],
    ["Анимации: выкл", "Анімації: вимк.", "Animations: off"],
    ["Язык", "Мова", "Language"],
    ["Аккаунт", "Акаунт", "Account"],
    ["из Telegram", "з Telegram", "from Telegram"],
    ["имя не задано", "ім'я не задано", "name not set"],
    ["Изменить имя", "Змінити ім'я", "Change name"],
    ["Задать имя", "Задати ім'я", "Set name"],
    ["Приложение", "Застосунок", "App"],
    ["Обновить игру", "Оновити гру", "Update game"],
    ["Обновляем…", "Оновлюємо…", "Updating…"],
    ["Играть с компьютером", "Грати з комп'ютером", "Play vs computer"],
    ["Играть онлайн", "Грати онлайн", "Play online"],
    ["Чапаев", "Чапаєв", "Chapaev"],
    ["Рейтинг", "Рейтинг", "Leaderboard"],
    ["Как тебя зовут?", "Як тебе звати?", "What's your name?"],
    ["Играть можно и без Telegram: ник хранится в этом браузере.", "Грати можна і без Telegram: нікнейм зберігається в цьому браузері.", "You can play without Telegram: the nickname is stored in this browser."],
    ["Ник", "Нікнейм", "Nickname"],
    ["Ник: от 2 до 20 символов (буквы, цифры, пробел, _ . -).", "Нікнейм: від 2 до 20 символів (літери, цифри, пробіл, _ . -).", "Nickname: 2 to 20 characters (letters, digits, space, _ . -)."],
    ["Входим…", "Входимо…", "Signing in…"],
    ["Не удалось войти. Попробуйте ещё раз.", "Не вдалося увійти. Спробуйте ще раз.", "Couldn't sign in. Please try again."],
    ["Нет связи с сервером.", "Немає зв'язку із сервером.", "No connection to the server."],
    ["Не удалось войти.", "Не вдалося увійти.", "Couldn't sign in."],
    ["Играть", "Грати", "Play"],
    ["Игра с компьютером", "Гра з комп'ютером", "Game vs computer"],
    ["Сложность", "Складність", "Difficulty"],
    ["Ваш цвет (красные ходят первыми)", "Ваш колір (червоні ходять першими)", "Your color (red moves first)"],
    ["Красные", "Червоні", "Red"],
    ["Чёрные", "Чорні", "Black"],
    ["Режим", "Режим", "Mode"],
    ["только что", "щойно", "just now"],
    [" мин назад", " хв тому", " min ago", true],
    ["Комнаты", "Кімнати", "Rooms"],
    ["Создай комнату, введи код или выбери из списка", "Створи кімнату, введи код або обери зі списку", "Create a room, enter a code or pick from the list"],
    [" · сменить ник", " · змінити нікнейм", " · change nickname", true],
    ["Создать комнату", "Створити кімнату", "Create room"],
    ["Открытая", "Відкрита", "Public"],
    ["Закрытая", "Закрита", "Private"],
    ["Открытая видна в списке, закрытая — только по коду.", "Відкрита видима в списку, закрита — лише за кодом.", "Public rooms appear in the list; private ones are code-only."],
    ["Войти по коду", "Увійти за кодом", "Join by code"],
    ["КОД", "КОД", "CODE"],
    ["Код состоит из 5 символов (буквы и цифры, без 0, 1, O, I, L).", "Код складається з 5 символів (літери та цифри, без 0, 1, O, I, L).", "The code has 5 characters (letters and digits, no 0, 1, O, I, L)."],
    ["Войти", "Увійти", "Join"],
    ["Открытые комнаты", "Відкриті кімнати", "Public rooms"],
    ["Пока никого. Создай открытую комнату, и она появится здесь.", "Поки нікого. Створи відкриту кімнату, і вона з'явиться тут.", "Nobody yet. Create a public room and it will appear here."],
    ["ждёт соперника", "чекає на суперника", "waiting for opponent", true],
    ["идёт партия", "триває партія", "game in progress", true],
    ["партия завершена", "партію завершено", "game over", true],
    ["код ", "код ", "code ", true],
    ["Смотреть", "Дивитися", "Watch"],
    ["Не удалось загрузить список. Попробуйте ещё раз.", "Не вдалося завантажити список. Спробуйте ще раз.", "Couldn't load the list. Please try again."],
    ["Обновить список", "Оновити список", "Refresh list"],
    // Сообщения сервера (воркера)
    ["Сессия гостя не распознана или устарела. Войдите заново.", "Сесію гостя не розпізнано або вона застаріла. Увійдіть заново.", "Guest session not recognized or expired. Please sign in again."],
    ["Не получены данные Telegram. Откройте Mini App из Telegram.", "Не отримано дані Telegram. Відкрийте Mini App з Telegram.", "No Telegram data received. Open the Mini App from Telegram."],
    ["Отсутствует подпись Telegram.", "Відсутній підпис Telegram.", "Telegram signature is missing."],
    ["Не удалось подтвердить подлинность Telegram.", "Не вдалося підтвердити автентичність Telegram.", "Couldn't verify Telegram authenticity."],
    ["Данные Telegram устарели. Закройте и снова откройте игру.", "Дані Telegram застаріли. Закрийте і знову відкрийте гру.", "Telegram data expired. Close and reopen the game."],
    ["Telegram не передал профиль пользователя.", "Telegram не передав профіль користувача.", "Telegram didn't pass the user profile."],
    ["Не удалось определить Telegram ID.", "Не вдалося визначити Telegram ID.", "Couldn't determine the Telegram ID."],
    ["Некорректный запрос.", "Некоректний запит.", "Invalid request."],
    ["Слишком много попыток. Попробуйте через ", "Забагато спроб. Спробуйте через ", "Too many attempts. Try again in ", true],
    [" мин.", " хв.", " min.", true],
    ["Повреждено состояние доски.", "Пошкоджено стан дошки.", "The board state is corrupted."],
    ["Комнату с таким кодом не найдено. Проверьте код.", "Кімнату з таким кодом не знайдено. Перевірте код.", "No room with that code was found. Check the code."],
    ["У вас уже есть открытые комнаты. Подождите или закройте старые.", "У вас уже є відкриті кімнати. Зачекайте або закрийте старі.", "You already have open rooms. Wait or close the old ones."],
    ["Зритель", "Глядач", "Spectator"],
    ["Вы наблюдаете за игрой и не можете в ней действовать.", "Ви спостерігаєте за грою і не можете в ній діяти.", "You're watching the game and can't take actions."],
    ["Вы не зарегистрированы в этой комнате. Откройте приглашение заново.", "Ви не зареєстровані в цій кімнаті. Відкрийте запрошення заново.", "You're not registered in this room. Open the invitation again."],
    ["Партия ещё не создана.", "Партію ще не створено.", "The game hasn't been created yet."],
    ["Во время партии выйти нельзя: сначала сдайтесь.", "Під час партії вийти не можна: спершу здайтеся.", "You can't leave during a game: resign first."],
    ["Некорректные координаты хода.", "Некоректні координати ходу.", "Invalid move coordinates."],
    ["Недопустимый ход. Обновите страницу и попробуйте снова.", "Недопустимий хід. Оновіть сторінку і спробуйте знову.", "Invalid move. Refresh the page and try again."],
    ["Это не «Чапаев».", "Це не «Чапаєв».", "This isn't Chapaev."],
    ["Недопустимый удар.", "Недопустимий удар.", "Invalid shot."],
    ["Слишком слабый удар.", "Занадто слабкий удар.", "The shot is too weak."],
    ["Ничья: все шашки вылетели с доски.", "Нічия: усі шашки вилетіли з дошки.", "Draw: all pieces flew off the board."],
    ["Все шашки игрока ", "Усі шашки гравця ", "All pieces of player ", true],
    ["Все шашки ", "Усі шашки ", "All pieces of ", true],
    [" выбиты с доски.", " вибито з дошки.", " are knocked off the board.", true],
    ["соперника", "суперника", "the opponent", true],
    [" сдался.", " здався.", " resigned.", true],
    ["Время на ход вышло: ", "Час на хід вийшов: ", "Time's up: ", true],
    ["Время на ход ещё не вышло.", "Час на хід ще не вийшов.", "Time for the move isn't up yet."],
    ["Реванш доступен после завершения партии.", "Реванш доступний після завершення партії.", "Rematch is available after the game ends."],
    // Статичный текст index.html (экран партии)
    ["КОМНАТА", "КІМНАТА", "ROOM"],
    ["ЧЁРНЫЕ · ИГРОК 2", "ЧОРНІ · ГРАВЕЦЬ 2", "BLACK · PLAYER 2"],
    ["КРАСНЫЕ · ИГРОК 1", "ЧЕРВОНІ · ГРАВЕЦЬ 1", "RED · PLAYER 1"],
    ["ТЕКУЩАЯ ПАРТИЯ", "ПОТОЧНА ПАРТІЯ", "CURRENT GAME"],
    ["Дамка", "Дамка", "King"],
    ["Русские шашки · 8 × 8", "Російські шашки · 8 × 8", "Russian checkers · 8 × 8"],
    ["Игроки", "Гравці", "Players"],
    ["Игровая доска 8 на 8", "Ігрова дошка 8 на 8", "Game board 8 by 8"]
  ];

  // --- Подготовка таблиц ---
  var CYR = /[\u0400-\u04FF]/;
  var EXACT = {}, FRAG = {}, fragKeys = [];
  function nk(s) { return String(s).replace(/\s+/g, " "); }
  // Эмодзи и значки (⚡ 🏆 ← ✓ …) в словарь не входят: игра может заменить их картинками или отрезать от текста.
  // Перед переводом они отделяются от фразы и возвращаются на своё место без изменений.
  var SYM = "[\\u2190-\\u21FF\\u2300-\\u2BFF\\uFE0E\\uFE0F\\u200D\\u{1F000}-\\u{1FFFF}]";
  var LEAD = new RegExp("^(?:" + SYM + "+\\s*)+", "u"), TRAIL = new RegExp("(?:\\s*" + SYM + "+)+$", "u");
  function bare(t) { return String(t).replace(LEAD, "").replace(TRAIL, ""); }
  DICT.forEach(function (e) {
    var k = nk(bare(e[0]));
    e[1] = bare(e[1]); e[2] = bare(e[2]);
    EXACT[k.trim()] = e;
    if (e[3]) { FRAG[k] = e; fragKeys.push(k); }
  });
  fragKeys.sort(function (a, b) { return b.length - a.length; });
  var fragRe = fragKeys.length ? new RegExp(fragKeys.map(function (k) {
    return k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  }).join("|"), "g") : null;

  var lang = FALLBACK_LANG;
  function idx() { return lang === "uk" ? 1 : 2; }

  function tr(s) {
    if (lang === "ru" || !s || !CYR.test(s)) return s;
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    var core = nk(m[2]), e = EXACT[core];
    if (e) return m[1] + e[idx()].trim() + m[3];
    var mid = bare(m[2]);
    if (mid !== m[2]) { // фраза с эмодзи/значком по краям: переводим саму фразу, значки возвращаем на место
      e = EXACT[nk(mid).trim()];
      if (e) { var at = m[2].indexOf(mid); return m[1] + m[2].slice(0, at) + e[idx()].trim() + m[2].slice(at + mid.length) + m[3]; }
    }
    return fragRe ? s.replace(fragRe, function (k) {
      var f = FRAG[nk(k)], args = arguments, at = args[args.length - 2], full = args[args.length - 1];
      if (!f) return k;
      // не трогаем совпадение внутри чужого слова (например «место » в «вместо »)
      if (/[\u0400-\u04FF]/.test(k.charAt(0)) && at > 0 && /[\u0400-\u04FF]/.test(full.charAt(at - 1))) return k;
      return f[idx()];
    }) : s;
  }

  // --- Применение перевода к DOM (с запоминанием исходного русского текста) ---
  var textRec = new WeakMap(), attrRec = new WeakMap();
  var ATTRS = ["aria-label", "title", "placeholder", "alt"];

  function doText(n) {
    var v = n.nodeValue, r = textRec.get(n);
    var src = (r && v === r.out) ? r.src : v;
    if (!CYR.test(src)) { if (r) textRec.delete(n); return; }
    var out = lang === "ru" ? src : tr(src);
    textRec.set(n, { src: src, out: out });
    if (out !== v) n.nodeValue = out;
  }
  function doAttr(el, a) {
    var v = el.getAttribute(a);
    if (v == null) return;
    var rec = attrRec.get(el); if (!rec) { rec = {}; attrRec.set(el, rec); }
    var r = rec[a], src = (r && v === r.out) ? r.src : v;
    if (!CYR.test(src)) { delete rec[a]; return; }
    var out = lang === "ru" ? src : tr(src);
    rec[a] = { src: src, out: out };
    if (out !== v) el.setAttribute(a, out);
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1) return;
    var tag = root.tagName;
    if (tag === "SCRIPT" || tag === "STYLE") return;
    ATTRS.forEach(function (a) { if (root.hasAttribute(a)) doAttr(root, a); });
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c);
  }
  function applyAll() {
    document.documentElement.lang = lang;
    if (document.body) walk(document.body);
    var t = document.title, tt = tr(t);
    if (CYR.test(t) && tt !== t) document.title = tt;
    if (lang === "ru" && document.title !== "Шашки онлайн") document.title = "Шашки онлайн";
  }

  var observer = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.type === "characterData") doText(m.target);
      else if (m.type === "attributes") doAttr(m.target, m.attributeName);
      else for (var j = 0; j < m.addedNodes.length; j++) walk(m.addedNodes[j]);
    }
    ensureMenuButton();
  });

  // --- Определение языка: ручной выбор > язык телефона > язык Telegram > страна по IP ---
  function supported(code) {
    var c = String(code || "").toLowerCase().split(/[-_]/)[0];
    if (c === "ua") c = "uk";
    return LANGS.indexOf(c) >= 0 ? c : null;
  }
  function saved() { try { return supported(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; } }
  function detectLocal() {
    var list = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language];
    for (var i = 0; i < list.length; i++) { var s = supported(list[i]); if (s) return s; }
    try {
      var u = window.Telegram.WebApp.initDataUnsafe.user;
      var t = u && supported(u.language_code); if (t) return t;
    } catch (e) {}
    return null;
  }
  function detectByIp(done) {
    try {
      var ctl = window.AbortController ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctl) ctl.abort(); }, IP_TIMEOUT_MS);
      fetch(IP_GEO_URL, ctl ? { signal: ctl.signal } : undefined)
        .then(function (r) { return r.json(); })
        .then(function (j) {
          clearTimeout(timer);
          var c = j && j.country ? String(j.country).toUpperCase() : "";
          done(c ? (IP_COUNTRY_LANG[c] || "en") : null);
        })
        .catch(function () { clearTimeout(timer); done(null); });
    } catch (e) { done(null); }
  }

  var listeners = [];
  function setLang(l, persist) {
    l = supported(l); if (!l) return;
    if (persist) { try { localStorage.setItem(STORAGE_KEY, l); } catch (e) {} }
    lang = l;
    applyAll();
    var btn = document.getElementById("i18nLangBtn");
    if (btn) btn.firstChild.textContent = "🌐 " + SHORT[lang];
    listeners = listeners.filter(function (f) { return f(); });
  }

  // --- Переключатель языка: ряд из трёх кнопок (для настроек) ---
  function picker() {
    var row = document.createElement("div");
    row.style.cssText = "display:flex;gap:8px;margin-top:8px";
    var btns = LANGS.map(function (c) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = NAMES[c];
      b.style.cssText = "flex:1;padding:12px 6px;border-radius:12px;font-size:15px;cursor:pointer;border:1px solid rgba(255,255,255,.14)";
      b.addEventListener("click", function () { setLang(c, true); });
      row.appendChild(b);
      return [c, b];
    });
    function paint() {
      if (listeners.length > 0 && row.__seen && !row.isConnected) return false; // окно закрыли: подписка больше не нужна
      if (row.isConnected) row.__seen = true;
      btns.forEach(function (p) {
        var on = p[0] === lang;
        p[1].style.background = on ? "var(--accent,#d9b56d)" : "var(--panel-2,#222733)";
        p[1].style.color = on ? "#1a1e27" : "var(--text,#f4f5f7)";
      });
      return true;
    }
    paint(); listeners.push(paint);
    return row;
  }

  // --- Кнопка языка справа вверху главного меню ---
  function ensureMenuButton() {
    var menu = document.getElementById("mainMenu");
    if (!menu || document.getElementById("i18nLangBtn")) return;
    var wrap = document.createElement("div");
    wrap.id = "i18nLangBtn";
    wrap.style.cssText = "position:fixed;right:12px;z-index:9600;top:calc(env(safe-area-inset-top,0px) + var(--tg-content-safe-area-inset-top,0px) + 12px)";
    var btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "🌐 " + SHORT[lang];
    btn.setAttribute("aria-label", "Language");
    btn.style.cssText = "height:38px;padding:0 12px;border-radius:19px;border:1px solid rgba(255,255,255,.12);background:var(--panel-2,#222733);color:var(--text,#f4f5f7);font-size:14px;font-weight:600;cursor:pointer";
    var list = document.createElement("div");
    list.style.cssText = "display:none;position:absolute;right:0;top:44px;min-width:150px;background:var(--panel,#1a1e27);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:6px;box-shadow:0 10px 30px rgba(0,0,0,.5)";
    LANGS.forEach(function (c) {
      var it = document.createElement("button");
      it.type = "button";
      it.style.cssText = "display:block;width:100%;text-align:left;padding:11px 12px;border:0;border-radius:10px;background:none;color:var(--text,#f4f5f7);font-size:15px;cursor:pointer";
      it.textContent = NAMES[c];
      it.addEventListener("click", function (e) { e.stopPropagation(); list.style.display = "none"; setLang(c, true); mark(); });
      list.appendChild(it);
    });
    function mark() {
      Array.prototype.forEach.call(list.children, function (it, i) {
        it.style.color = LANGS[i] === lang ? "var(--accent,#d9b56d)" : "var(--text,#f4f5f7)";
        it.style.fontWeight = LANGS[i] === lang ? "700" : "400";
      });
    }
    btn.addEventListener("click", function (e) { e.stopPropagation(); mark(); list.style.display = list.style.display === "none" ? "block" : "none"; });
    document.addEventListener("click", function () { list.style.display = "none"; });
    wrap.appendChild(btn); wrap.appendChild(list);
    menu.appendChild(wrap);
    listeners.push(function () { if (!wrap.isConnected) return false; mark(); return true; });
  }

  // --- Системные окна: alert/confirm и Telegram showAlert/showConfirm/showPopup ---
  try {
    var _alert = window.alert, _confirm = window.confirm;
    window.alert = function (m) { return _alert.call(window, tr(String(m))); };
    window.confirm = function (m) { return _confirm.call(window, tr(String(m))); };
  } catch (e) {}
  try {
    var W = window.Telegram.WebApp;
    ["showAlert", "showConfirm"].forEach(function (n) {
      var f = W[n]; if (typeof f !== "function") return;
      W[n] = function (m) { var a = Array.prototype.slice.call(arguments); a[0] = tr(String(m)); return f.apply(W, a); };
    });
    var _popup = W.showPopup;
    if (typeof _popup === "function") W.showPopup = function (p) {
      try {
        p = Object.assign({}, p);
        if (p.title) p.title = tr(p.title);
        if (p.message) p.message = tr(p.message);
        if (p.buttons) p.buttons = p.buttons.map(function (b) { return Object.assign({}, b, b.text ? { text: tr(b.text) } : {}); });
      } catch (e) {}
      return _popup.apply(W, [p].concat(Array.prototype.slice.call(arguments, 1)));
    };
  } catch (e) {}

  // --- Старт ---
  var forced = saved();
  lang = forced || (AUTO_DETECT ? detectLocal() : null) || FALLBACK_LANG;
  var needIp = !forced && AUTO_DETECT && IP_DETECT_ENABLED && !(detectLocal());

  window.I18N = { get lang() { return lang; }, set: function (l) { setLang(l, true); }, picker: picker, tr: tr };

  function start() {
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    applyAll(); ensureMenuButton();
    if (needIp) detectByIp(function (l) { if (l && !saved()) setLang(l, false); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
