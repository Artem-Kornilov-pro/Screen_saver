/*
 * Слой эффектов поверх нативного приложения. Под WebView — нативный экран на Kotlin,
 * здесь — праздничный слой (seasonal.js) и дудлы (doodles.js) без изменений.
 *
 * Якоря: приложение присылает прямоугольники своих элементов (setZones), здесь по ним стоят невидимые
 * двойники — шапка, аватар, баланс, карточки, таб-бар. Слои находят их как обычные элементы.
 *
 * Связь с приложением:
 *   Kotlin → JS: window.Overlay.setZones(zones), skip(), pull(), balance(value), setSuppressed(flag)
 *   JS → Kotlin: NativeBridge.requestZones(), setModal(open), setBalance(value), addBalance(amount)
 * Конфиги: дефолт лежит в APK (assets), адрес CDN приходит из приложения в ?cdn= и ложится поверх.
 */
(function () {
  'use strict';

  var DOODLES_MANIFEST = 'effects/doodles/manifest.json';
  var LAYOUT_URL = 'overlay/layout.json';

  var app = document.getElementById('app');
  var ghostsEl = document.getElementById('ghosts');
  var native = window.NativeBridge || null;
  var params = new URLSearchParams(window.location.search);

  var debugToggle = document.getElementById('debug-toggle');
  var debugPanel = document.getElementById('debug-panel');
  var debugOverride = document.getElementById('debug-override');
  var debugDate = document.getElementById('debug-date');
  var debugStatus = document.getElementById('debug-status');
  var debugDoodles = document.getElementById('debug-doodles');
  var debugGold = document.getElementById('debug-gold');
  var debugDoodleStatus = document.getElementById('debug-doodle-status');

  // ---------- Якоря по зонам нативного экрана ----------

  // Зона: { id, rect: [left, top, right, bottom] в CSS px слоя, anchor?, snow?, dock?, debug? }.
  // В приложении зоны присылает Kotlin — с настоящих view, после раскладки и при каждой прокрутке.
  var ghosts = {};
  var zonesReady = null;

  function setBox(el, rect) {
    el.style.left = rect[0] + 'px';
    el.style.top = rect[1] + 'px';
    el.style.width = (rect[2] - rect[0]) + 'px';
    el.style.height = (rect[3] - rect[1]) + 'px';
  }

  function ghostFor(zone) {
    if (ghosts[zone.id]) return ghosts[zone.id];
    var el;
    if (zone.debug) {
      el = debugToggle;
    } else {
      el = document.createElement('div');
      el.className = 'ov-ghost';
      if (zone.anchor) el.setAttribute('data-anchor', zone.anchor);
      if (zone.snow) el.setAttribute('data-snow', '');
      if (zone.dock) el.setAttribute('data-doodle-dock', '');
      el.setAttribute('data-zone', zone.id);
      ghostsEl.appendChild(el);
    }
    ghosts[zone.id] = el;
    return el;
  }

  function setZones(zones) {
    zones.forEach(function (zone) { setBox(ghostFor(zone), zone.rect); });
    if (zonesReady) {
      zonesReady.resolve();
      zonesReady = null;
    }
  }

  // В браузере (?preview=1) приложения нет: зоны считаем из overlay/layout.json по картинке экрана
  function previewZones(data) {
    var img = document.createElement('img');
    img.className = 'ov-preview';
    img.src = data.image;
    img.alt = '';
    app.insertBefore(img, app.firstChild);
    function place() {
      var s = Math.min(window.innerWidth / data.width, window.innerHeight / data.height);
      var x = (window.innerWidth - data.width * s) / 2;
      var px = function (r) { return [x + r[0] * s, r[1] * s, x + r[2] * s, r[3] * s]; };
      setBox(img, px([0, 0, data.width, data.height]));
      setZones(data.zones.map(function (zone) {
        var copy = Object.assign({}, zone);
        copy.rect = px(zone.rect);
        return copy;
      }));
    }
    window.addEventListener('resize', place);
    place();
  }

  // ---------- Жесты ----------

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

  // Перевернули экраном вниз, подержали и вернули — финал комбо или событие «ночь».
  // angle — на сколько градусов экран отвёрнут от неба: 0 — лежит экраном вверх, 180 — экраном вниз.
  // В приложении угол считает Kotlin по акселерометру (Overlay.sensors): deviceorientation в WebView
  // на Android приходит не всегда. В браузере — |beta| из deviceorientation.
  var flipDownSince = 0;
  var flipArmed = false;
  if (!native) {
    window.addEventListener('deviceorientation', function (event) {
      if (event.beta !== null && event.beta !== undefined) onFlipAngle(Math.abs(event.beta));
    });
  }

  function onFlipAngle(tilt) {
    var cfg = Doodles.settings();
    var now = Date.now();
    if (tilt > cfg.flipDownAngle) {
      if (!flipDownSince) flipDownSince = now;
      if (now - flipDownSince > cfg.flipHoldMs) flipArmed = true;
      return;
    }
    flipDownSince = 0;
    if (flipArmed && tilt < cfg.flipUpAngle) {
      flipArmed = false;
      flip();
    }
  }

  function flip() {
    if (Doodles.trigger('flip')) return 'Переворот ушёл дудлу';
    return Doodles.event('flip') ? 'Ночь' : 'На переворот сейчас ничего нет';
  }

  function clockNow(override) {
    var date = Seasonal.effectiveDate();
    var now = new Date();
    var t = {
      month: date.getMonth() + 1, day: date.getDate(), weekday: (date.getDay() + 6) % 7 + 1,
      hour: now.getHours(), minute: now.getMinutes(), date: Doodles.ymd(date)
    };
    if (override) Object.keys(override).forEach(function (k) { t[k] = override[k]; });
    return t;
  }

  function checkClock() {
    Doodles.event('clock', clockNow());
  }
  window.setInterval(checkClock, 60000);

  // ---------- Баланс живёт в нативном экране ----------

  // Приложение досчитало сумму до нового значения — проверяем, не «красивое» ли оно
  function onBalance(value) {
    Doodles.event('balance', { value: value });
  }

  function setBalance(value) {
    if (native) native.setBalance(value);
    else onBalance(value);
  }

  function topUp(amount) {
    Doodles.event('topup', { amount: amount });
    // Монетки долетают до баланса — тогда он и меняется
    window.setTimeout(function () {
      if (native) native.addBalance(amount);
    }, 850);
  }

  // ---------- API для приложения ----------

  window.Overlay = {
    // Нажали кнопку приложения: идущая сцена и снег мягко гаснут, комбо сбрасывается
    skip: function () {
      Doodles.skip();
      Seasonal.skip();
    },
    // Pull-to-refresh приложения: дудл только подписан на жест
    pull: function () { return Doodles.trigger('pull'); },
    shake: shake,
    balance: onBalance,
    setZones: setZones,
    // Критичный экран (перевод): эффектов нет
    setSuppressed: function (flag) {
      Seasonal.setSuppressed(!!flag);
      Doodles.setSuppressed(!!flag);
    },
    // Датчики считает приложение: angle — 0 экраном вверх … 180 экраном вниз, tilt — наклон −1 … 1
    sensors: function (angle, tilt) {
      if (!started) return;
      Seasonal.setTilt(tilt);
      onFlipAngle(angle);
    },
    // Встряска: сила в м/с² без гравитации. Порог тряски решает конфиг праздничного слоя.
    motion: function (force) {
      if (!started) return;
      if (force > 8) lastHuman = Date.now();
      Seasonal.motion(force);
    },
    // Показ: кнопки громкости — следующий / предыдущий дудл
    step: function (dir) { stepDemo(dir < 0 ? -1 : 1); }
  };

  // ---------- Показ: переключение дудлов кнопками громкости и автосмена ----------

  // Круг показа — те же кнопки дудлов, что в отладке. Самое яркое — первым, как в режиме жюри веба.
  var DEMO_FIRST = ['newyear-garland', 'autumn-leaves', 'cosmonautics', 'birthday'];
  var DEMO_AUTOPLAY_MS = 1500;  // сцена уровня 1 сама, чтобы показ не был «пустым»
  var DEMO_GRACE_MS = 10000;    // жюри трогало телефон меньше 10 с назад — автосмена ждёт
  var DEMO_SEASON_MS = 6000;    // сколько даём праздничному слою, прежде чем запустить сцену стикера
  var demoIndex = -1;
  var demoSteps = [];
  var demoTimer = 0;
  var demoCaption = null;
  var demoCaptionTimer = 0;
  var lastHuman = 0;
  var debugAuto = document.getElementById('debug-auto');
  var debugAutoSec = document.getElementById('debug-auto-sec');

  document.addEventListener('pointerdown', function () { lastHuman = Date.now(); }, { capture: true, passive: true });

  // Тап по стикеру дня — в фокусе сцена дудла: праздничный слой на фоне мягко гаснет, чтобы не смешиваться с ней
  document.addEventListener('click', function (event) {
    if (event.target.closest && event.target.closest('.doodle-buddy')) Seasonal.skip();
  }, true);

  function demoOrder() {
    var buttons = Array.prototype.slice.call(debugDoodles.querySelectorAll('button[data-id]'));
    var first = [];
    DEMO_FIRST.forEach(function (id) {
      buttons.forEach(function (b) { if (b.getAttribute('data-id') === id) first.push(b); });
    });
    return first.concat(buttons.filter(function (b) { return first.indexOf(b) === -1; }));
  }

  function showCaption(button, n, total) {
    if (!demoCaption) {
      demoCaption = document.createElement('div');
      demoCaption.className = 'ov-caption';
      document.body.appendChild(demoCaption);
    }
    demoCaption.textContent = '';
    demoCaption.appendChild(document.createTextNode(button.firstChild.textContent));
    var small = document.createElement('small');
    small.textContent = n + '/' + total;
    demoCaption.appendChild(small);
    demoCaption.classList.add('is-on');
    window.clearTimeout(demoCaptionTimer);
    demoCaptionTimer = window.setTimeout(function () { demoCaption.classList.remove('is-on'); }, 2500);
  }

  function stepDemo(dir) {
    var order = demoOrder();
    if (!order.length) return;
    if (debugPanel.classList.contains('is-open')) setDebugOpen(false);
    demoIndex = ((demoIndex + dir) % order.length + order.length) % order.length;
    var button = order[demoIndex];
    button.click();
    showCaption(button, demoIndex + 1, order.length);
    // Быстро листают — прошлый шаг не доигрывает
    demoSteps.forEach(window.clearTimeout);
    demoSteps = [window.setTimeout(function () {
      // Сначала праздничный слой (есть не на каждую дату — trigger сам скажет «нет»),
      // сцена стикера — когда он отыграет: вместе они смешиваются, а тап по стикеру гасит слой
      var shown = Seasonal.trigger('shake').effect;
      demoSteps.push(window.setTimeout(playBuddy, shown ? Math.min(shown.durationMs || DEMO_SEASON_MS, DEMO_SEASON_MS) : 300));
    }, DEMO_AUTOPLAY_MS)];
    if (debugAuto.checked) scheduleAuto();
  }

  // Тап по стикеру — как будто ребёнок его нашёл: уровень 1, аксессуар на аватар
  function playBuddy() {
    var buddy = document.querySelector('.doodle-buddy');
    if (buddy) buddy.click();
  }

  function scheduleAuto() {
    window.clearTimeout(demoTimer);
    if (!debugAuto.checked) return;
    demoTimer = window.setTimeout(function autoNext() {
      var idle = Date.now() - lastHuman;
      if (idle < DEMO_GRACE_MS) {
        demoTimer = window.setTimeout(autoNext, DEMO_GRACE_MS - idle + 200);
        return;
      }
      stepDemo(1);
    }, Number(debugAutoSec.value) * 1000);
  }

  debugAuto.addEventListener('change', function () {
    if (debugAuto.checked) {
      setDebugOpen(false);
      stepDemo(1);
    } else {
      window.clearTimeout(demoTimer);
    }
  });
  debugAutoSec.addEventListener('change', scheduleAuto);

  // ---------- Дудлы ----------

  var doodleRun = 0;

  function markDoodle(id) {
    Array.prototype.forEach.call(debugDoodles.querySelectorAll('button'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-id') === id);
    });
  }

  function startDoodles() {
    var run = ++doodleRun;
    debugDoodleStatus.textContent = 'Загрузка дудла…';
    var show = function (item) {
      markDoodle(item ? item.id : null);
      debugDoodleStatus.textContent = item
        ? 'Дудл дня: «' + item.title + '». Комбо: ' + DoodleLabels.combo(item.effect).join(' → ') + '.'
        : 'На эту дату дудла нет';
      showSources();
    };
    return Doodles.init({
      manifestUrl: DOODLES_MANIFEST,
      cdnUrl: cdnUrl('doodles/manifest.json'),
      root: app,
      layer: document.getElementById('doodle-layer'),
      liveRegion: document.getElementById('doodle-live'),
      date: Seasonal.effectiveDate(),
      onChange: function (item) { if (run === doodleRun) show(item); }
    }).then(function (item) {
      if (run !== doodleRun) return item;
      show(item);
      return item;
    });
  }

  var SOURCE_NAMES = { bundle: 'приложение', cdn: 'CDN', 'cdn-cache': 'кэш CDN', fallback: 'встроенный', none: '—' };
  function showSources() {
    document.getElementById('debug-cdn-status').textContent =
      'Конфиги: слой — ' + (SOURCE_NAMES[Seasonal.source()] || Seasonal.source()) +
      ', дудлы — ' + (SOURCE_NAMES[Doodles.source()] || Doodles.source()) +
      (cdnBase ? '. CDN: ' + cdnBase : '. CDN не задан, работаем на дефолте приложения');
  }

  // Дудл из пула выпадает по очереди: ищем ближайший к началу года день, когда он дудл дня
  function poolDate(manifest, item, year) {
    for (var d = new Date(year, 0, 1, 12); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      var picked = Doodles._pick(manifest, d);
      if (picked && picked.id === item.id) return Doodles.ymd(d);
    }
    return null;
  }

  function demoDate(manifest, item, year) {
    if (item.pool) return poolDate(manifest, item, year);
    var date = DoodleLabels.demoDate(item.when, year);
    if (!date || !item.when || item.when.type !== 'range') return date;
    var parts = date.split('-').map(Number);
    var picked = Doodles._pick(manifest, new Date(parts[0], parts[1] - 1, parts[2], 12));
    return picked && picked.id === item.id ? date : poolDate(manifest, item, year) || date;
  }

  function buildDoodleButtons() {
    fetch(DOODLES_MANIFEST, { cache: 'no-cache' })
      .then(function (response) { return response.json(); })
      .then(function (manifest) {
        var year = new Date().getFullYear();
        manifest.items.forEach(function (item) {
          if (item.enabled === false) return;
          var date = demoDate(manifest, item, year);
          if (!date) return;
          var button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('data-id', item.id);
          button.appendChild(document.createTextNode(item.title || item.id));
          var small = document.createElement('small');
          small.textContent = (item.pool ? 'дудл дня' : DoodleLabels.when(item.when)) + ' · ' + Number(date.slice(8)) + '.' + date.slice(5, 7);
          button.appendChild(small);
          button.addEventListener('click', function () {
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

  function parseDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
  }

  var urlDate = parseDate(params.get('date'));

  // Адрес CDN — настройка приложения: Kotlin передаёт его в ?cdn=. Без него — дефолт из APK.
  var cdnBase = null;
  try { cdnBase = params.get('cdn') ? new URL(params.get('cdn').replace(/\/?$/, '/'), location.href).href : null; } catch (err) { cdnBase = null; }
  function cdnUrl(file) {
    return cdnBase ? new URL(file, cdnBase).href : null;
  }
  debugDate.value = urlDate ? urlDate.toISOString().slice(0, 10) : new Date().getFullYear() + '-12-31';
  debugOverride.checked = !!urlDate;

  function applyDateOverride() {
    Seasonal.setDateOverride(debugOverride.checked ? parseDate(debugDate.value) : null);
    return startDoodles();
  }

  // Пока открыта отладка, касания целиком у WebView, а не у нативного экрана
  function setDebugOpen(open) {
    debugPanel.classList.toggle('is-open', open);
    debugToggle.setAttribute('aria-expanded', String(open));
    if (native) native.setModal(open);
  }

  debugToggle.addEventListener('click', function () {
    setDebugOpen(!debugPanel.classList.contains('is-open'));
  });
  debugOverride.addEventListener('change', applyDateOverride);
  debugDate.addEventListener('change', applyDateOverride);
  document.getElementById('debug-show').addEventListener('click', function () {
    var result = Seasonal.trigger('shake');
    debugStatus.textContent = result.effect ? 'Показываем: ' + result.effect.title : result.reason;
  });
  document.getElementById('debug-reset').addEventListener('click', function () {
    Seasonal.resetDailyLimit();
    debugStatus.textContent = 'Лимит сброшен: при следующем входе эффект покажется снова';
  });
  document.getElementById('debug-shake').addEventListener('click', function () { debugStatus.textContent = shake(); });
  document.getElementById('debug-pull').addEventListener('click', function () { window.Overlay.pull(); });
  document.getElementById('debug-doodle-reset').addEventListener('click', function () {
    Doodles.reset();
    startDoodles();
  });
  debugGold.addEventListener('change', function () { Doodles.setGold(debugGold.checked); });
  document.getElementById('debug-topup').addEventListener('click', function () { topUp(500); });
  document.getElementById('debug-flip').addEventListener('click', function () { debugStatus.textContent = flip(); });
  document.getElementById('debug-clock').addEventListener('click', function () {
    Doodles.event('clock', clockNow({ day: 6, hour: 19, minute: 0, debug: true }));
  });
  document.getElementById('debug-cdn-apply').addEventListener('click', function () {
    var value = document.getElementById('debug-cdn').value.trim();
    var next = new URLSearchParams(window.location.search);
    if (value) next.set('cdn', value); else next.delete('cdn');
    window.location.search = next.toString();
  });
  document.getElementById('debug-cdn').value = params.get('cdn') || '';
  Array.prototype.forEach.call(document.querySelectorAll('[data-balance]'), function (button) {
    button.addEventListener('click', function () { setBalance(Number(button.getAttribute('data-balance'))); });
  });

  // ---------- Старт ----------

  // Якоря нужны обоим слоям: сначала зоны экрана, потом слои
  var layoutReady = new Promise(function (resolve) { zonesReady = { resolve: resolve }; });
  if (native) {
    native.requestZones();
  } else {
    fetch(LAYOUT_URL, { cache: 'no-cache' })
      .then(function (response) { return response.json(); })
      .then(previewZones);
  }

  // Датчики от приложения принимаем, когда оба слоя запущены
  var started = false;

  layoutReady.then(function () {
    started = true;
    var seasonalReady = Seasonal.init({
      host: app,
      canvas: document.getElementById('seasonal-layer'),
      configUrl: 'effects/config.json',
      cdnUrl: cdnUrl('config.json'),
      dateOverride: urlDate,
      nativeSensors: !!native,
      onShake: shake,
      onChange: function (effect) {
        if (effect) debugStatus.textContent = 'Показываем: ' + effect.title;
      }
    });
    var doodlesReady = startDoodles();
    doodlesReady.then(function () { window.setTimeout(checkClock, 1500); });
    buildDoodleButtons();
    Promise.all([seasonalReady, doodlesReady]).then(function (results) {
      var result = results[0];
      if (result && !result.effect) debugStatus.textContent = result.reason;
    });
  });
})();
