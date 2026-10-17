/* QR-приколюхи: собственные DOM/SVG-анимации, без библиотек и сетевых API.
 * BarcodeDetector используется только при наличии поддержки qr_code.
 * Демо-мозаика — иллюстрация, а не платёжный QR. Камера включается по кнопке.
 */
(function () {
  'use strict';
  var themes = [
    { id: 'detective', title: 'Кот-детектив', short: 'Детектив', sub: 'Лапа с лупой находит код', hint: 'Ищем зацепки…', done: 'Дело раскрыто!', art: 'effects/qr/loupe.svg', color: '#d0bfff' },
    { id: 'fishing', title: 'Рыбалка', short: 'Рыбалка', sub: 'Поплавок ныряет — код на крючке', hint: 'Ждём хороший улов…', done: 'Вот это улов!', art: 'effects/qr/bobber.svg', color: '#74c0fc' },
    { id: 'magic', title: 'Магия', short: 'Магия', sub: 'Искры собираются вокруг QR', hint: 'Немного волшебства…', done: 'Код расколдован!', art: 'effects/qr/wand.svg', color: '#d0bfff' },
    { id: 'rocket', title: 'Ракета', short: 'Ракета', sub: 'Сканируем и отправляемся в полёт', hint: 'Готовимся к запуску…', done: 'Код найден. Поехали!', art: 'effects/doodles/packs/cosmonautics/rocket.svg', color: '#ffd43b' },
    { id: 'chase', title: 'Кот ловит мышку', short: 'Догонялки', sub: 'Мышка прячется, кот подкрадывается', hint: 'Кто здесь прячется?', done: 'Попалась!', art: 'effects/qr/mouse.svg', color: '#fcc2d7' }
  ];
  var frames = [
    { id: 'classic', title: 'Обычная', art: null },
    { id: 'loupe', title: 'Лупа', art: 'effects/qr/frame-loupe.svg' },
    { id: 'portal', title: 'Портал', art: 'effects/qr/frame-portal.svg' },
    { id: 'porthole', title: 'Иллюминатор', art: 'effects/qr/frame-porthole.svg' },
    { id: 'cat', title: 'Которамка', art: 'effects/qr/frame-cat.svg' }
  ];
  var icons = {
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.1"/>',
    camera: '<path d="M4 7h4l2-3h4l2 3h4v13H4Z"/><circle cx="12" cy="13" r="4"/>',
    flash: '<path d="m13 2-9 12h7l-1 8 10-13h-8Z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    play: '<path d="m9 5 11 7-11 7Z"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    restart: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
    sound: '<path d="M4 9h4l5-4v14l-5-4H4ZM17 8q5 4 0 8"/>',
    moon: '<path d="M19 15A8 8 0 0 1 9 5a8 8 0 1 0 10 10Z"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + icons[name] + '</svg>'; }
  var app = document.getElementById('app');
  var screen = document.createElement('section');
  screen.id = 'screen-qr'; screen.className = 'qr-screen'; screen.hidden = true;
  screen.setAttribute('aria-label', 'QR-сканер');
  screen.innerHTML =
    '<div class="qr-demo-scene" aria-hidden="true"><div class="qr-terminal"><div class="qr-terminal-brand">Оплата по QR</div><div class="qr-terminal-display"><div class="qr-demo-matrix"></div><span>Демонстрационный код</span></div><div class="qr-terminal-keys">1　2　3<br>4　5　6<br>7　8　9</div></div></div>' +
    '<video class="qr-video" playsinline muted hidden aria-label="Изображение камеры"></video>' +
    '<div class="qr-vignette" aria-hidden="true"></div>' +
    '<div class="statusbar qr-statusbar"><span>09:41</span><span aria-hidden="true">▮▮▮　▰</span></div>' +
    '<div class="qr-toolbar"><button type="button" class="qr-icon-button" data-back aria-label="Закрыть сканер">' + icon('close') + '</button><label class="qr-frame-picker"><span>Рамка</span><select id="qr-frame-select" aria-label="Рамка сканера">' + frames.map(function (f) { return '<option value="' + f.id + '">' + f.title + '</option>'; }).join('') + '</select></label><button type="button" class="qr-icon-button" id="qr-info" aria-label="О сканере" aria-expanded="false">' + icon('info') + '</button></div>' +
    '<div class="qr-heading"><h1>Поймай QR-код<br>в рамку</h1><p id="qr-theme-hint"></p></div>' +
    '<span class="qr-source-label">ДЕМО · БЕЗ КАМЕРЫ</span>' +
    '<div class="qr-finder" aria-hidden="true"><div class="qr-frame-mask" hidden></div><img class="qr-frame-shell qr-art" id="qr-frame-art" alt="" hidden><i class="qr-corner"></i><i class="qr-corner"></i><i class="qr-corner"></i><i class="qr-corner"></i><div class="qr-scan-line"></div><div class="qr-water"></div><div class="qr-frame-glow"></div><div class="qr-particles"></div><div class="qr-actors"></div><div class="qr-found-mark">' + icon('check') + '</div></div>' +
    '<div class="qr-feedback" role="status" aria-live="polite"><strong id="qr-feedback-title"></strong><span id="qr-feedback-sub"></span></div>' +
    '<div class="qr-bottom"><div class="qr-theme-picker"><img id="qr-theme-thumb" alt=""><label class="sr-only" for="qr-theme-select">Сюжет сканирования</label><select id="qr-theme-select">' + themes.map(function (t, i) { return '<option value="' + t.id + '">' + (i + 1) + '/5 · ' + t.title + '</option>'; }).join('') + '</select></div>' +
    '<div class="qr-camera-controls"><button type="button" id="qr-torch" aria-pressed="false">' + icon('flash') + '<span>Фонарик</span></button><button type="button" id="qr-camera">' + icon('camera') + '<span>Камера</span></button><button type="button" id="qr-demo-mode" hidden>' + icon('play') + '<span>Демо</span></button></div>' +
    '<button type="button" class="qr-primary" id="qr-catch">Поймать демо-код ' + icon('arrow') + '</button><span class="qr-bottom-note">Демонстрация сканирования · без оплаты</span></div>' +
    '<div class="qr-help" id="qr-help" hidden><strong>Лови код, а не скуку</strong><p>Выбери сюжет и нажми «Поймать демо-код». Камера для демонстрации не нужна.</p><p>Реальная камера использует встроенный QR-детектор браузера. Кадры остаются на устройстве. Ссылки из кодов не открываются, платежей нет.</p><button type="button" id="qr-help-close">Понятно</button></div>';
  app.appendChild(screen);

  var panel = document.createElement('aside');
  panel.id = 'qr-workshop'; panel.className = 'qr-workshop'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Настройки QR-демо');
  panel.innerHTML = '<div class="qr-eyebrow"><span class="qr-lime-dot"></span> СБЕРKIDS · ПРИКОЛЫ</div><div class="qr-panel-title">Поймал код.<br><span>Поймал настроение.</span></div><p class="qr-panel-lead">Пять маленьких историй в привычном<br>QR-сканере. Попробуй каждую.</p><div class="qr-section-label">ВЫБЕРИ СЮЖЕТ <span>01 — 05</span></div>' +
    '<div class="qr-theme-list">' + themes.map(function (t, i) { return '<button type="button" class="qr-theme-card" data-qr-theme="' + t.id + '" aria-pressed="false"><span class="qr-card-art"><img src="' + t.art + '" alt=""></span><span class="qr-card-copy"><strong>' + t.title + '</strong><small>' + t.sub + '</small></span><span class="qr-card-number">0' + (i + 1) + '</span></button>'; }).join('') + '</div>' +
    '<div class="qr-frame-heading"><span class="qr-section-label">РАМКА СКАНЕРА</span><span class="qr-style-note">сочетай с любым сюжетом</span></div><div class="qr-frame-switch" role="group" aria-label="Варианты рамки">' + frames.map(function (f) { return '<button type="button" data-qr-frame="' + f.id + '" aria-pressed="false">' + (f.art ? '<img src="' + f.art + '" alt="">' : '<span class="qr-classic-thumb" aria-hidden="true"></span>') + '<span>' + f.title + '</span></button>'; }).join('') + '</div>' +
    '<div class="qr-style-heading"><span class="qr-section-label">СТИЛЬ ДУДЛА</span><span class="qr-style-note">как в проекте</span></div><div class="qr-style-switch" role="group" aria-label="Стиль дудла"><button type="button" data-qr-style="sketch" aria-pressed="false">Каракуля</button><button type="button" data-qr-style="sticker" aria-pressed="true">Наклейка</button><button type="button" data-qr-style="neon" aria-pressed="false">Неон</button></div>' +
    '<div class="qr-panel-actions"><button type="button" id="qr-replay">' + icon('restart') + ' Повторить</button><button type="button" id="qr-test-error">Проверить ошибку</button></div>' +
    '<div class="qr-preferences"><label><input type="checkbox" id="qr-reduced"> Меньше движения</label><label><input type="checkbox" id="qr-sound"> Звук</label></div><div class="qr-panel-footer"><span>Чистые HTML · CSS · JS</span><span>Никаких внешних запросов ↗</span></div>';
  document.querySelector('.stage').appendChild(panel);

  var $ = function (id) { return document.getElementById(id); };
  var finder = screen.querySelector('.qr-finder');
  var actors = screen.querySelector('.qr-actors');
  var particles = screen.querySelector('.qr-particles');
  var video = screen.querySelector('video');
  var demoScene = screen.querySelector('.qr-demo-scene');
  var modeLabel = screen.querySelector('.qr-source-label');
  var motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  // WebKit может прокрутить overflow:hidden при фокусе на нижнем select.
  // Сканер — фиксированная сцена, прокрутка нужна только тексту результата.
  screen.addEventListener('scroll', function () { if (screen.scrollTop) screen.scrollTop = 0; });
  var theme = themes[0];
  var style = 'sticker';
  var frameShape = 'classic';
  var state = 'search';
  var opened = false;
  var cameraMode = false;
  var stream = null;
  var cameraToken = 0;
  var detectTimer = 0;
  var pendingCamera = false;
  var visualTimers = [];
  var torch = false;
  var audio = null;
  var crop = document.createElement('canvas');
  crop.width = 480; crop.height = 480;
  var cropContext = crop.getContext('2d', { willReadFrequently: true });
  $('qr-reduced').checked = motionQuery.matches;

  // Собственная декоративная мозаика. Намеренно не кодирует URL или реквизиты.
  var matrix = screen.querySelector('.qr-demo-matrix');
  for (var y = 0; y < 25; y++) {
    for (var x = 0; x < 25; x++) {
      var dark = ((x * 13 + y * 7 + x * y * 3) % 11) < 5;
      [[0, 0], [18, 0], [0, 18]].forEach(function (corner) {
        var dx = x - corner[0]; var dy = y - corner[1];
        if (dx >= -1 && dx <= 7 && dy >= -1 && dy <= 7) {
          dark = dx >= 0 && dx < 7 && dy >= 0 && dy < 7 && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        }
      });
      var cell = document.createElement('i'); if (dark) cell.className = 'is-dark'; matrix.appendChild(cell);
    }
  }

  function later(fn, ms) { visualTimers.push(window.setTimeout(fn, ms)); }
  function clearVisuals() { visualTimers.forEach(window.clearTimeout); visualTimers = []; particles.innerHTML = ''; }
  function reduced() { return $('qr-reduced').checked || motionQuery.matches; }
  function feedback(title, subtitle) { $('qr-feedback-title').textContent = title; $('qr-feedback-sub').textContent = subtitle || ''; }
  function setState(next) {
    state = next;
    screen.setAttribute('data-state', state);
    $('qr-catch').disabled = state === 'catching' || pendingCamera;
    $('qr-catch').innerHTML = state === 'catching' ? 'Ловим код…' : state === 'found' ? 'Сканировать ещё ' + icon('restart') : cameraMode ? 'Вернуться к демо ' + icon('play') : 'Поймать демо-код ' + icon('arrow');
  }
  function renderActors() {
    actors.innerHTML = '<img class="qr-art qr-hero" src="' + theme.art + '" alt="">';
    if (theme.id === 'detective' || theme.id === 'chase') actors.innerHTML += '<img class="qr-art qr-cat" src="effects/qr/cat.svg" alt="">';
    if (theme.id === 'fishing') actors.innerHTML += '<img class="qr-art qr-fish" src="effects/qr/fish.svg" alt="">';
  }
  function reset() {
    clearVisuals(); setState('search'); renderActors();
    feedback(cameraMode ? 'Наведи камеру на QR-код' : 'Готовы поймать код?', cameraMode ? 'Распознавание на устройстве' : 'Нажми кнопку — история оживёт');
  }
  function selectTheme(id) {
    theme = themes.filter(function (t) { return t.id === id; })[0] || themes[0];
    screen.setAttribute('data-theme', theme.id);
    screen.style.setProperty('--qr-accent', theme.color);
    $('qr-theme-select').value = theme.id;
    $('qr-theme-thumb').src = theme.art;
    $('qr-theme-hint').textContent = theme.hint;
    panel.querySelectorAll('[data-qr-theme]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-qr-theme') === theme.id)); });
    reset();
  }
  function selectFrame(id) {
    var frame = frames.filter(function (f) { return f.id === id; })[0] || frames[0];
    frameShape = frame.id;
    screen.setAttribute('data-frame', frameShape);
    $('qr-frame-select').value = frameShape;
    $('qr-frame-art').hidden = !frame.art;
    screen.querySelector('.qr-frame-mask').hidden = !frame.art;
    if (frame.art) $('qr-frame-art').src = frame.art;
    else $('qr-frame-art').removeAttribute('src');
    panel.querySelectorAll('[data-qr-frame]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.getAttribute('data-qr-frame') === frameShape)); });
    // Геометрия области распознавания остаётся квадратной внутри декоративной рамки.
    // При смене оформления событие сканирования и его текущий результат сохраняются.
  }
  function burst(gather) {
    particles.innerHTML = '';
    if (reduced()) return;
    for (var i = 0; i < 16; i++) {
      var p = document.createElement('img');
      p.src = i % 3 ? 'effects/doodles/packs/events/sparkle.svg' : 'effects/doodles/packs/cosmonautics/star1.svg';
      p.className = 'qr-burst-star qr-art' + (gather ? ' qr-gather-star' : ''); p.alt = '';
      var angle = (i / 16) * Math.PI * 2;
      p.style.setProperty('--dx', Math.cos(angle) * (95 + i % 3 * 23) + 'px');
      p.style.setProperty('--dy', Math.sin(angle) * (95 + i % 3 * 23) + 'px');
      p.style.setProperty('--spin', (i % 2 ? 100 : -100) + 'deg');
      p.style.animationDelay = i % 4 * 35 + 'ms';
      particles.appendChild(p);
    }
  }
  function sound() {
    if (!$('qr-sound').checked) return;
    try {
      var Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      if (!audio) audio = new Audio();
      audio.resume().catch(function () {});
      [659, 880, 1047].forEach(function (frequency, i) {
        var oscillator = audio.createOscillator(); var gain = audio.createGain();
        var start = audio.currentTime + i * .085;
        oscillator.type = 'sine'; oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.045, start + .012); gain.gain.exponentialRampToValueAtTime(.001, start + .14);
        oscillator.connect(gain); gain.connect(audio.destination); oscillator.start(start); oscillator.stop(start + .15);
      });
    } catch (err) { /* Звук — необязательное дополнение. */ }
  }
  function found(value, isDemo) {
    if (!opened || state === 'catching' || state === 'found') return;
    clearVisuals(); setState('catching');
    feedback('Есть зацепка…', 'QR распознан');
    if (theme.id === 'magic') burst(true);
    if (cameraMode) stopCamera(false);
    later(function () {
      setState('found'); feedback(theme.done, isDemo ? 'Демо-код · без оплаты' : 'Содержимое: ' + String(value).slice(0, 140));
      burst(); sound();
    }, reduced() ? 120 : 650);
  }
  function simulateError() {
    clearVisuals(); setState('error');
    feedback('Код пока не читается', 'Добавь света или поднеси телефон ближе');
    $('qr-catch').innerHTML = 'Попробовать ещё ' + icon('restart');
  }
  function stopCamera(showDemo) {
    cameraToken++; pendingCamera = false;
    window.clearTimeout(detectTimer);
    if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
    stream = null; torch = false;
    $('qr-torch').setAttribute('aria-pressed', 'false');
    if (showDemo !== false) {
      cameraMode = false; video.srcObject = null; video.hidden = true; demoScene.hidden = false;
      modeLabel.textContent = 'ДЕМО · БЕЗ КАМЕРЫ'; $('qr-demo-mode').hidden = true;
    }
  }
  function cameraError(message) {
    stopCamera(true); setState('error');
    feedback('Можно посмотреть демо', message);
  }
  async function startCamera() {
    if (pendingCamera) return;
    stopCamera(true); clearVisuals();
    var token = cameraToken;
    pendingCamera = true; setState('search');
    feedback('Подключаем камеру…', 'Кадры не покидают устройство');
    try {
      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Камера работает на HTTPS или localhost');
      if (!window.BarcodeDetector) throw new Error('В этом браузере нет встроенного QR-детектора');
      var formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.indexOf('qr_code') === -1) throw new Error('Браузер не поддерживает распознавание QR');
      if (!opened || token !== cameraToken) return;
      var detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      var acquired = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      if (!opened || token !== cameraToken) { acquired.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = acquired; video.srcObject = stream;
      await video.play();
      if (!opened || token !== cameraToken) return;
      cameraMode = true; pendingCamera = false; video.hidden = false; demoScene.hidden = true;
      modeLabel.textContent = 'КАМЕРА · НА УСТРОЙСТВЕ'; $('qr-demo-mode').hidden = false;
      reset();
      async function detect() {
        if (!opened || token !== cameraToken || !stream || document.hidden) return;
        try {
          if (video.readyState >= 2 && video.videoWidth) {
            var bounds = video.getBoundingClientRect(); var frame = finder.getBoundingClientRect();
            var scale = Math.max(bounds.width / video.videoWidth, bounds.height / video.videoHeight);
            var offsetX = (video.videoWidth * scale - bounds.width) / 2;
            var offsetY = (video.videoHeight * scale - bounds.height) / 2;
            cropContext.drawImage(video, (frame.left - bounds.left + offsetX) / scale, (frame.top - bounds.top + offsetY) / scale, frame.width / scale, frame.height / scale, 0, 0, 480, 480);
            var codes = await detector.detect(crop);
            if (!opened || token !== cameraToken) return;
            if (codes.length) { found(codes[0].rawValue, false); return; }
          }
          detectTimer = window.setTimeout(detect, 220);
        } catch (err) { if (token === cameraToken) cameraError('Не удалось прочитать кадр. Перезапусти камеру'); }
      }
      detect();
    } catch (err) {
      if (token !== cameraToken) return;
      var message = err.name === 'NotAllowedError' ? 'Доступ к камере не разрешён' : err.name === 'NotFoundError' ? 'Камера не найдена на устройстве' : err.name === 'NotReadableError' ? 'Камера занята другим приложением' : err.message;
      cameraError(message);
    } finally { if (token === cameraToken) { pendingCamera = false; $('qr-catch').disabled = false; } }
  }
  function setOpen(value) {
    opened = !!value; screen.hidden = !opened; panel.hidden = !opened;
    document.body.classList.toggle('is-qr-open', opened);
    $('debug-panel').hidden = opened;
    $('debug-toggle').hidden = opened;
    if (!opened) {
      stopCamera(true); clearVisuals(); $('qr-help').hidden = true; $('qr-info').setAttribute('aria-expanded', 'false');
      var opener = document.querySelector('[data-open="qr"]'); if (opener) opener.focus();
    } else { reset(); screen.scrollTop = 0; screen.querySelector('[data-back]').focus({ preventScroll: true }); }
  }
  $('qr-catch').addEventListener('click', function () {
    if (state === 'found') { if (cameraMode) startCamera(); else reset(); }
    else if (cameraMode) { stopCamera(true); reset(); }
    else { if (state === 'error') reset(); found('QR-DEMO-2026', true); }
  });
  $('qr-theme-select').addEventListener('change', function () { selectTheme(this.value); });
  $('qr-frame-select').addEventListener('change', function () { selectFrame(this.value); });
  panel.querySelectorAll('[data-qr-frame]').forEach(function (button) { button.addEventListener('click', function () { selectFrame(button.getAttribute('data-qr-frame')); }); });
  panel.querySelectorAll('[data-qr-theme]').forEach(function (button) { button.addEventListener('click', function () { selectTheme(button.getAttribute('data-qr-theme')); }); });
  panel.querySelectorAll('[data-qr-style]').forEach(function (button) {
    button.addEventListener('click', function () {
      style = button.getAttribute('data-qr-style'); screen.setAttribute('data-art-style', style);
      panel.querySelectorAll('[data-qr-style]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
    });
  });
  $('qr-replay').addEventListener('click', function () { stopCamera(true); reset(); found('QR-DEMO-2026', true); });
  $('qr-test-error').addEventListener('click', simulateError);
  $('qr-reduced').addEventListener('change', function () { screen.classList.toggle('qr-reduced', reduced()); });
  motionQuery.addEventListener('change', function () { screen.classList.toggle('qr-reduced', reduced()); });
  $('qr-camera').addEventListener('click', startCamera);
  $('qr-demo-mode').addEventListener('click', function () { stopCamera(true); reset(); });
  $('qr-torch').addEventListener('click', async function () {
    if (!stream) { feedback('Фонарик включается с камерой', 'В демо достаточно нажать «Поймать демо-код»'); return; }
    var track = stream.getVideoTracks()[0];
    try {
      if (!track.getCapabilities || !track.getCapabilities().torch) { feedback('У этой камеры нет фонарика', 'Попробуй добавить освещение'); return; }
      torch = !torch; await track.applyConstraints({ advanced: [{ torch: torch }] });
      $('qr-torch').setAttribute('aria-pressed', String(torch));
    } catch (err) { torch = false; $('qr-torch').setAttribute('aria-pressed', 'false'); feedback('Фонарик недоступен', 'Сканирование продолжится без него'); }
  });
  $('qr-info').addEventListener('click', function () { $('qr-help').hidden = !$('qr-help').hidden; this.setAttribute('aria-expanded', String(!$('qr-help').hidden)); if (!$('qr-help').hidden) $('qr-help-close').focus(); });
  $('qr-help-close').addEventListener('click', function () { $('qr-help').hidden = true; $('qr-info').setAttribute('aria-expanded', 'false'); $('qr-info').focus(); });
  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape' || !opened) return;
    if (!$('qr-help').hidden) $('qr-help-close').click(); else screen.querySelector('[data-back]').click();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && opened) {
      var activeCamera = cameraMode || pendingCamera;
      stopCamera(true); reset();
      if (activeCamera) feedback('Камера приостановлена', 'Вернувшись, нажми «Камера» для продолжения');
    }
  });
  window.addEventListener('pagehide', function () { stopCamera(true); clearVisuals(); });
  screen.setAttribute('data-art-style', style); screen.classList.toggle('qr-reduced', reduced());
  selectTheme('detective');
  selectFrame(new URLSearchParams(window.location.search).get('frame'));
  window.QrFun = { setOpen: setOpen, selectTheme: selectTheme };
})();
