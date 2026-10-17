/*
 * Макет приложения: переключение экранов, тосты, жесты и отладочная панель.
 * Поверх экрана два слоя, оба живут отдельно: праздничный (seasonal.js) и дудлы (doodles.js).
 * Отсюда им сообщают, на каком мы экране, и передают жесты приложения: тряску и pull-to-refresh.
 */
(function () {
  'use strict';

  var DOODLES_MANIFEST = 'effects/doodles/manifest.json';

  var app = document.getElementById('app');
  var mainScreen = document.getElementById('screen-main');
  var transferScreen = document.getElementById('screen-transfer');
  var toast = document.getElementById('toast');
  var tabbar = document.getElementById('tabbar');
  var ptr = document.getElementById('ptr');
  var toastTimer = 0;

  var debugToggle = document.getElementById('debug-toggle');
  var debugPanel = document.getElementById('debug-panel');
  var debugOverride = document.getElementById('debug-override');
  var debugDate = document.getElementById('debug-date');
  var debugTilt = document.getElementById('debug-tilt');
  var debugStatus = document.getElementById('debug-status');
  var debugDoodles = document.getElementById('debug-doodles');
  var debugReduced = document.getElementById('debug-reduced');
  var debugGold = document.getElementById('debug-gold');
  var debugDoodleStatus = document.getElementById('debug-doodle-status');

  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('is-on');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-on'); }, 1400);
  }

  function openScreen(name) {
    var isTransfer = name === 'transfer';
    transferScreen.hidden = !isTransfer;
    mainScreen.hidden = isTransfer;
    tabbar.hidden = isTransfer;
    Seasonal.setSuppressed(isTransfer);
    Doodles.setSuppressed(isTransfer);
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-open], [data-back], [data-toast]');
    if (!target) return;
    if (target.hasAttribute('data-open')) openScreen(target.getAttribute('data-open'));
    else if (target.hasAttribute('data-back')) openScreen('main');
    else showToast(target.getAttribute('data-toast'));
  });

  Array.prototype.forEach.call(tabbar.querySelectorAll('.tab:not(.tab--paw)'), function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(tabbar.querySelectorAll('.tab'), function (t) { t.classList.remove('tab--active'); });
      tab.classList.add('tab--active');
    });
  });

  // ---------- Жесты приложения ----------

  // Тряска одна на оба слоя. Сначала её получает дудл дня, если он на неё отвечает, иначе праздничный слой.
  // Тряска одна на оба слоя. Идёт комбо дудла — тряска его. Лежит снег — тряска его стряхивает.
  // Иначе сначала дудл дня, если он отвечает на тряску, потом праздничный слой.
  function shake() {
    if (!Doodles.inCombo() && Seasonal.hasSnow()) {
      Seasonal.trigger('shake');
      return 'Стряхнули снег';
    }
    if (Doodles.trigger('shake')) return 'Тряска ушла дудлу';
    var result = Seasonal.trigger('shake');
    return result.effect ? 'Показываем: ' + result.effect.title : result.reason;
  }

  // Перевернули экраном вниз, подержали и вернули — событие 'flip' (ночь со светлячками).
  // Без касания экрана, как в Blackbox: телефон как предмет.
  var FLIP_HOLD = 1200;
  var flipDownSince = 0;
  var flipArmed = false;
  window.addEventListener('deviceorientation', function (event) {
    if (event.beta === null || event.beta === undefined) return;
    var tilt = Math.abs(event.beta);
    var now = Date.now();
    if (tilt > 150) {
      if (!flipDownSince) flipDownSince = now;
      if (now - flipDownSince > FLIP_HOLD) flipArmed = true;
      return;
    }
    flipDownSince = 0;
    if (flipArmed && tilt < 60) {
      flipArmed = false;
      Doodles.event('flip');
    }
  });

  // ---------- Баланс: события «пополнение» и «красивое число» ----------

  var balanceEl = document.getElementById('balance-value');
  var balance = 35688;
  var balanceAnim = 0;

  function formatMoney(value) {
    return Math.round(value).toLocaleString('ru-RU');
  }

  // Сумма досчитывается до нового значения, потом слой проверяет, не «красивое» ли оно.
  // Сама сумма никуда не уходит: проверка идёт на устройстве.
  function setBalance(value) {
    var from = balance;
    var start = 0;
    balance = value;
    window.cancelAnimationFrame(balanceAnim);
    function tick(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / 700);
      balanceEl.textContent = formatMoney(from + (value - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) balanceAnim = window.requestAnimationFrame(tick);
      else Doodles.event('balance', { value: value });
    }
    balanceAnim = window.requestAnimationFrame(tick);
  }

  function topUp(amount) {
    Doodles.event('topup', { amount: amount });
    // Монетки долетают до баланса — тогда он и меняется
    window.setTimeout(function () { setBalance(balance + amount); }, 850);
  }

  // Pull-to-refresh главного экрана: сам жест и индикатор — приложения, дудл только подписывается на 'pull'.
  var PULL_THRESHOLD = 70;
  var pullStartY = null;
  var pullDy = 0;
  var refreshing = false;

  function pullStart(y) {
    if (refreshing || mainScreen.hidden || mainScreen.scrollTop > 0) return;
    pullStartY = y;
    pullDy = 0;
  }

  function pullMove(y) {
    if (pullStartY === null) return;
    pullDy = Math.max(0, y - pullStartY);
    var d = Math.min(pullDy, 110);
    ptr.style.transform = 'translateY(' + d * 0.6 + 'px) rotate(' + d * 3 + 'deg)';
    ptr.style.opacity = Math.min(1, d / PULL_THRESHOLD);
  }

  function pullEnd() {
    if (pullStartY === null) return;
    pullStartY = null;
    if (pullDy >= PULL_THRESHOLD) refresh();
    else resetPull();
  }

  function resetPull() {
    ptr.style.transition = 'transform 0.2s, opacity 0.2s';
    ptr.style.transform = '';
    ptr.style.opacity = 0;
    window.setTimeout(function () { ptr.style.transition = ''; }, 220);
  }

  function refresh() {
    refreshing = true;
    ptr.classList.add('is-loading');
    ptr.style.transform = 'translateY(44px)';
    ptr.style.opacity = 1;
    Doodles.trigger('pull');
    window.setTimeout(function () {
      refreshing = false;
      ptr.classList.remove('is-loading');
      resetPull();
    }, 900);
  }

  mainScreen.addEventListener('touchstart', function (e) { pullStart(e.touches[0].clientY); }, { passive: true });
  mainScreen.addEventListener('touchmove', function (e) { pullMove(e.touches[0].clientY); }, { passive: true });
  mainScreen.addEventListener('touchend', pullEnd);
  mainScreen.addEventListener('touchcancel', pullEnd);
  // Мышью — для демо на ноутбуке
  mainScreen.addEventListener('mousedown', function (e) { if (e.button === 0) pullStart(e.clientY); });
  window.addEventListener('mousemove', function (e) { pullMove(e.clientY); });
  window.addEventListener('mouseup', pullEnd);

  // ---------- Дудлы ----------

  var doodleRun = 0;

  function markDoodle(id) {
    Array.prototype.forEach.call(debugDoodles.querySelectorAll('button'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-id') === id);
    });
  }

  // Дата общая с праздничным слоем: подмена в отладке меняет оба.
  function startDoodles() {
    var run = ++doodleRun;
    debugDoodleStatus.textContent = 'Загрузка дудла…';
    return Doodles.init({
      manifestUrl: DOODLES_MANIFEST,
      root: app,
      layer: document.getElementById('doodle-layer'),
      liveRegion: document.getElementById('doodle-live'),
      date: Seasonal.effectiveDate(),
      reducedMotion: debugReduced.checked
    }).then(function (item) {
      if (run !== doodleRun) return item;
      markDoodle(item ? item.id : null);
      debugDoodleStatus.textContent = item
        ? 'Дудл дня: «' + item.title + '». Комбо: ' + DoodleLabels.combo(item.effect).join(' → ') + '.'
        : 'На эту дату дудла нет';
      return item;
    });
  }

  // Кнопки быстрого перехода к дате дудла: строятся из того же манифеста
  function buildDoodleButtons() {
    if (!window.fetch) return;
    fetch(DOODLES_MANIFEST, { cache: 'no-cache' })
      .then(function (response) { return response.json(); })
      .then(function (manifest) {
        var year = new Date().getFullYear();
        manifest.items.forEach(function (item) {
          var date = DoodleLabels.demoDate(item.when, year);
          if (!date) return;
          var button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('data-id', item.id);
          button.appendChild(document.createTextNode(item.title || item.id));
          var small = document.createElement('small');
          small.textContent = DoodleLabels.when(item.when);
          button.appendChild(small);
          button.addEventListener('click', function () {
            // День рождения живёт в профиле: для демо кладём его на ту же дату
            if (item.when && item.when.type === 'birthday') Doodles.setBirthday(date);
            debugOverride.checked = true;
            debugDate.value = date;
            applyDateOverride();
          });
          debugDoodles.appendChild(button);
        });
      })
      .catch(function () { /* без манифеста — без кнопок */ });
  }

  // ---------- Отладка ----------

  // ?date=2026-12-31 в адресе сразу подменяет дату: удобно открыть демо по ссылке.
  function parseDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
  }

  var params = new URLSearchParams(window.location.search);
  var urlDate = parseDate(params.get('date'));
  // ?birthday=2026-11-15 — день рождения в профиле для демо (галерея открывает так дудл дня рождения)
  if (parseDate(params.get('birthday'))) Doodles.setBirthday(params.get('birthday'));
  debugDate.value = urlDate ? urlDate.toISOString().slice(0, 10) : new Date().getFullYear() + '-12-31';
  debugOverride.checked = !!urlDate;

  function applyDateOverride() {
    Seasonal.setDateOverride(debugOverride.checked ? parseDate(debugDate.value) : null);
    return startDoodles();
  }

  function describe(result) {
    debugStatus.textContent = result.effect ? 'Показываем: ' + result.effect.title : result.reason;
  }

  // На ноутбуке панель видна всегда, класс открывает её шторкой на телефоне
  function setDebugOpen(open) {
    debugPanel.classList.toggle('is-open', open);
    debugToggle.setAttribute('aria-expanded', String(open));
  }

  debugToggle.addEventListener('click', function () {
    setDebugOpen(!debugPanel.classList.contains('is-open'));
  });
  debugOverride.addEventListener('change', applyDateOverride);
  debugDate.addEventListener('change', applyDateOverride);
  debugTilt.addEventListener('input', function () { Seasonal.setManualTilt(debugTilt.value); });
  document.getElementById('debug-show').addEventListener('click', function () {
    describe(Seasonal.trigger('shake'));
  });
  document.getElementById('debug-reset').addEventListener('click', function () {
    Seasonal.resetDailyLimit();
    debugStatus.textContent = 'Лимит сброшен: при следующем входе эффект покажется снова';
  });
  document.getElementById('debug-shake').addEventListener('click', function () {
    debugStatus.textContent = shake();
  });
  document.getElementById('debug-pull').addEventListener('click', refresh);
  document.getElementById('debug-doodle-reset').addEventListener('click', function () {
    // Забывает «найдено», аксессуары на день и увиденные подсказки
    Doodles.reset();
    startDoodles();
  });
  debugReduced.addEventListener('change', startDoodles);
  debugGold.addEventListener('change', function () { Doodles.setGold(debugGold.checked); });
  document.getElementById('debug-topup').addEventListener('click', function () { topUp(500); });
  document.getElementById('debug-flip').addEventListener('click', function () { Doodles.event('flip'); });
  Array.prototype.forEach.call(document.querySelectorAll('[data-balance]'), function (button) {
    button.addEventListener('click', function () { setBalance(Number(button.getAttribute('data-balance'))); });
  });

  var seasonalReady = Seasonal.init({
    host: app,
    canvas: document.getElementById('seasonal-layer'),
    dateOverride: urlDate,
    onShake: shake,
    onChange: function (effect) {
      if (effect) debugStatus.textContent = 'Показываем: ' + effect.title;
    }
  });

  // Дудлы не участвуют в первом рендере: стартуют, когда экран уже отрисован.
  var doodlesReady = new Promise(function (resolve) {
    var idle = window.requestIdleCallback || function (cb) { return window.setTimeout(cb, 200); };
    window.addEventListener('load', function () {
      idle(function () { resolve(startDoodles()); });
    });
  });
  buildDoodleButtons();

  Promise.all([seasonalReady, doodlesReady]).then(function (results) {
    var result = results[0];
    var doodle = results[1];
    if (!result || result.effect) return;
    describe(result);
    // Дудл на сегодня есть: его подсказка уже на экране, дату не трогаем.
    if (doodle) return;
    // На сегодня ни праздника, ни дудла: сразу подсказываем, как посмотреть эффект.
    debugOverride.checked = true;
    applyDateOverride();
    setDebugOpen(true);
    debugStatus.textContent = 'При входе: ' + result.reason.toLowerCase() + '. Дата уже подменена, нажмите «Показать слой».';
  });
})();
