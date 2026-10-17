/*
 * Режим «телефон для жюри»: ?present=60 в адресе.
 * Раз в N секунд (по умолчанию 60) переключает «дату» на следующий праздник или дудл дня,
 * сразу показывает его сцену и оставляет жесты жюри: тапы, тряску, переворот.
 * Работает через ту же отладку, что и демо на ноутбуке: кнопки дудлов строит app.js.
 * Без ?present файл ничего не делает.
 */
(function () {
  'use strict';

  var params = new URLSearchParams(window.location.search);
  if (!params.has('present')) return;

  var INTERVAL = Math.max(15, Number(params.get('present')) || 60) * 1000;
  var COMBO_GRACE = 10000;   // жюри трогало телефон меньше 10 с назад — даём доиграть
  var AUTOPLAY_DELAY = 1500; // сцена уровня 1 сама, чтобы телефон не лежал «пустым»
  var CAPTION_MS = 3500;
  // С чего начинаем круг: самое яркое — первым
  var FIRST = ['newyear-garland', 'autumn-leaves', 'cosmonautics', 'birthday'];

  var list = document.getElementById('debug-doodles');
  var order = [];
  var index = -1;
  var timer = 0;
  var caption = null;

  document.documentElement.classList.add('is-present');
  var style = document.createElement('style');
  style.textContent =
    '.is-present .debug-toggle, .is-present #debug-panel { display: none !important; }' +
    '.present-caption { position: fixed; left: 50%; bottom: calc(env(safe-area-inset-bottom) + 112px); z-index: 60;' +
    ' transform: translate(-50%, 8px); opacity: 0; transition: opacity .3s, transform .3s; pointer-events: none;' +
    ' padding: 8px 14px; border-radius: 999px; background: rgba(20, 24, 28, .82); color: #fff;' +
    ' font: 600 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; white-space: nowrap; }' +
    '.present-caption small { margin-left: 6px; font-weight: 400; opacity: .7; }' +
    '.present-caption.is-on { opacity: 1; transform: translate(-50%, 0); }' +
    '.present-hint { bottom: calc(env(safe-area-inset-bottom) + 160px); }';
  document.head.appendChild(style);

  function showCaption(button) {
    if (!caption) {
      caption = document.createElement('div');
      caption.className = 'present-caption';
      caption.setAttribute('aria-live', 'polite');
      document.body.appendChild(caption);
    }
    caption.innerHTML = '';
    caption.appendChild(button.firstChild.cloneNode(true));
    var small = button.querySelector('small');
    if (small) caption.appendChild(small.cloneNode(true));
    caption.classList.add('is-on');
    window.setTimeout(function () { caption.classList.remove('is-on'); }, CAPTION_MS);
  }

  // Тап по язычку дудла — как будто ребёнок его нашёл: уровень 1, шапка на аватар.
  // Аватар и карту не трогаем: их тап — приложению (профиль, карта), он гасит эффекты.
  function autoplay() {
    var buddy = document.querySelector('.doodle-buddy');
    if (buddy) buddy.click();
  }

  function show(i) {
    var button = order[i];
    if (!button) return;
    index = i;
    button.click();
    showCaption(button);
    window.setTimeout(function () {
      // Праздничный слой (снег, ёлка) есть не на каждую дату: trigger сам скажет «нет».
      Seasonal.trigger('shake');
      autoplay();
    }, AUTOPLAY_DELAY);
  }

  // Когда жюри последний раз трогало или трясло телефон. Автотап сюда не считается.
  var lastHuman = 0;
  document.addEventListener('pointerdown', function () { lastHuman = Date.now(); }, { capture: true, passive: true });
  window.addEventListener('devicemotion', function (event) {
    var a = event.acceleration;
    if (a && a.x !== null && Math.abs(a.x) + Math.abs(a.y) + Math.abs(a.z) > 8) lastHuman = Date.now();
  });

  function next() {
    if (Date.now() - lastHuman < COMBO_GRACE) {
      timer = window.setTimeout(next, COMBO_GRACE - (Date.now() - lastHuman) + 200);
      return;
    }
    show((index + 1) % order.length);
    timer = window.setTimeout(next, INTERVAL);
  }

  function start() {
    var buttons = Array.prototype.slice.call(list.querySelectorAll('button[data-id]'));
    if (!buttons.length) return false;
    var first = [];
    FIRST.forEach(function (id) {
      buttons.forEach(function (b) { if (b.getAttribute('data-id') === id) first.push(b); });
    });
    order = first.concat(buttons.filter(function (b) { return first.indexOf(b) === -1; }));
    window.clearTimeout(timer);
    next();
    return true;
  }

  // На iPhone датчики включаются только после тапа и «Разрешить». Пока данных нет — подсказываем.
  function sensorHint() {
    var api = window.DeviceMotionEvent;
    if (!api || typeof api.requestPermission !== 'function') return;
    var hint = document.createElement('div');
    hint.className = 'present-caption present-hint is-on';
    hint.textContent = 'Коснитесь экрана — включится тряска';
    document.body.appendChild(hint);
    function done(event) {
      var a = event.accelerationIncludingGravity;
      if (!a || a.x === null) return;
      hint.remove();
      window.removeEventListener('devicemotion', done);
    }
    window.addEventListener('devicemotion', done);
  }
  sensorHint();

  // Экран не гаснет, пока телефон у жюри (iOS 16.4+, Android Chrome). В обёртке это делает приложение.
  function keepAwake() {
    if (!navigator.wakeLock) return;
    navigator.wakeLock.request('screen').catch(function () { /* не дали — не страшно */ });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) keepAwake(); });
  keepAwake();

  // Кнопки дудлов app.js строит после загрузки манифеста — ждём их появления.
  if (!start()) {
    var observer = new MutationObserver(function () {
      if (start()) observer.disconnect();
    });
    observer.observe(list, { childList: true });
  }
})();
