/*
 * Сезонный слой: праздничный эффект поверх приложения.
 * Что и когда показать, решает конфиг (effects/config.json), этот файл только исполняет его.
 * Слой не перехватывает касания: canvas с pointer-events: none, тапы слушаются без отмены.
 */
(function () {
  'use strict';

  var CONFIG_URL = 'effects/config.json';
  var STORAGE_DAY = 'seasonal.lastShownDay';
  var STORAGE_CONFIG = 'seasonal.cachedConfig';

  var FADE_IN = 0.6;          // с, появление
  var FADE_OUT = 1.5;         // с, исчезание в конце показа
  var GUARD_FADE = 0.2;       // с, исчезание при входе на критичный экран
  var MAX_DT = 1 / 20;        // с, защита от скачка после паузы вкладки
  var SHAKE_FORCE = 15;       // м/с², без гравитации (~1,5 g: ребёнок трясёт несильно)
  var SHAKE_COOLDOWN = 1500;  // мс
  var SPRITE_SIZE = 64;       // px, заготовка снежинки
  var CAP_BIN = 4;            // px, ширина столбика сугроба

  // snowflake рисуется кодом; sprites — картинки из конфига (листья, лепестки, пузыри), без релиза
  var SUPPORTED_PARTICLES = ['snowflake', 'sprites'];
  var FIRST_SHOW_DELAY = 400; // мс после первого кадра

  // Пороги и тайминги из конфига (settings), зажатые в безопасные границы: [мин, макс, по умолчанию]
  var SETTINGS_LIMITS = {
    shakeForce: [8, 40, 15],
    shakeCooldownMs: [500, 5000, 1500],
    firstShowDelayMs: [0, 3000, 400],
    fadeInMs: [100, 3000, 600],
    fadeOutMs: [200, 5000, 1500]
  };

  function applySettings(raw) {
    var v = {};
    Object.keys(SETTINGS_LIMITS).forEach(function (key) {
      var lim = SETTINGS_LIMITS[key];
      var n = Number(raw && raw[key]);
      v[key] = raw && raw[key] != null && isFinite(n) ? Math.max(lim[0], Math.min(lim[1], n)) : lim[2];
    });
    SHAKE_FORCE = v.shakeForce;
    SHAKE_COOLDOWN = v.shakeCooldownMs;
    FIRST_SHOW_DELAY = v.firstShowDelayMs;
    FADE_IN = v.fadeInMs / 1000;
    FADE_OUT = v.fadeOutMs / 1000;
  }

  // ---------- Дефолт в приложении + CDN поверх ----------
  //
  // Как у дудлов: конфиг из приложения — база, конфиг с CDN дополняет его по id эффекта
  // (вложенные объекты сливаются, массивы заменяются, enabled: false выключает).

  function isPlain(v) { return v && typeof v === 'object' && !Array.isArray(v); }

  function deepMerge(base, over) {
    if (!isPlain(base) || !isPlain(over)) return over === undefined ? base : over;
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(over).forEach(function (k) { out[k] = deepMerge(base[k], over[k]); });
    return out;
  }

  function mergeConfig(base, cdn) {
    var useCdn = isPlain(cdn) && cdn.version === base.version;
    var m = deepMerge(base, {});
    if (useCdn && 'maxParticles' in cdn) m.maxParticles = cdn.maxParticles;
    m.settings = deepMerge(base.settings || {}, useCdn && isPlain(cdn.settings) ? cdn.settings : {});
    var effects = (base.effects || []).map(function (e) { return deepMerge(e, { _src: 'bundle' }); });
    (useCdn && Array.isArray(cdn.effects) ? cdn.effects : []).forEach(function (e) {
      if (!isPlain(e) || typeof e.id !== 'string') return;
      for (var i = 0; i < effects.length; i++) {
        if (effects[i].id === e.id) {
          // Новые картинки на CDN — ищем сначала там; иначе CDN поменял только числа
          var newSprites = isPlain(e.particles) && Array.isArray(e.particles.sprites);
          effects[i] = deepMerge(effects[i], deepMerge(e, { _src: 'cdn', _cdnFirst: newSprites }));
          return;
        }
      }
      effects.push(deepMerge(e, { _src: 'cdn', _cdnFirst: true }));
    });
    m.effects = effects;
    return m;
  }

  // Встроенная копия конфига: работает без сети и при битом файле на CDN.
  var FALLBACK_CONFIG = {
    version: 1,
    maxParticles: 80,
    effects: [{
      id: 'new_year',
      title: 'Новый год',
      dates: { from: '12-20', to: '01-10' },
      priority: 100,
      triggers: ['first_open_of_day', 'shake'],
      durationMs: 9000,
      particles: {
        kind: 'snowflake', count: 60, speed: [45, 110], size: [12, 30],
        colors: ['#8EC5FF', '#B6DAFF', '#6FAEF0'],
        spin: true, tiltWind: true, tapToPop: true,
        settle: { chance: 0.4, maxDepth: 10, meltMs: 25000 }
      },
      decor: [
        { kind: 'tree', anchor: 'bottom_end', widthPct: 0.34 },
        { kind: 'garland', anchor: 'top' }
      ]
    }]
  };

  var TREE = {
    tiers: [
      { apex: 0.42, base: 0.88, half: 0.50 },
      { apex: 0.25, base: 0.64, half: 0.39 },
      { apex: 0.08, base: 0.41, half: 0.28 }
    ],
    ornaments: [
      [0.50, 0.30], [0.38, 0.50], [0.63, 0.53], [0.29, 0.75],
      [0.52, 0.71], [0.73, 0.79], [0.44, 0.85]
    ]
  };
  var FESTIVE = ['#E8453C', '#FFC83D', '#3D8BFF', '#FF7EB6', '#3CCB7F'];
  var SPARK_COLORS = ['#FFC83D', '#E8453C', '#3D8BFF', '#FFFFFF'];

  var state = {
    host: null,
    canvas: null,
    ctx: null,
    dpr: 1,
    width: 0,
    height: 0,
    topInset: 0,
    config: null,
    run: null,
    suppressed: false,
    dateOverride: null,
    tilt: 0,
    manualTilt: 0,
    hasSensor: false,
    sensorsAsked: false,
    lastShake: 0,
    lastVibration: 0,
    rafId: 0,
    lastTs: 0,
    sprites: {},
    reduceMotion: false,
    onChange: null,
    onShake: null,
    caps: [],
    settle: null,
    meltTimer: 0
  };

  // ---------- Конфиг ----------

  function dayOrdinal(value) {
    if (typeof value !== 'string') return null;
    var parts = value.split('-').map(Number);
    if (parts.length !== 2 || !(parts[0] >= 1 && parts[0] <= 12) || !(parts[1] >= 1 && parts[1] <= 31)) return null;
    return parts[0] * 100 + parts[1];
  }

  function range(values, fallback) {
    if (!Array.isArray(values) || !values.length) return fallback;
    var low = Math.max(Number(values[0]) || fallback[0], 1);
    var high = Math.max(Number(values[1]) || low, low);
    return [low, high];
  }

  // Снег оседает на элементах с data-snow. null — не оседает.
  function normalizeSettle(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      targets: typeof raw.targets === 'string' ? raw.targets : '[data-snow]',
      chance: Math.max(0, Math.min(1, Number(raw.chance) || 0.3)),
      maxDepth: Math.max(3, Math.min(20, Number(raw.maxDepth) || 9)),
      meltMs: Math.max(3000, Number(raw.meltMs) || 25000)
    };
  }

  function normalizeEffect(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.particles || !raw.dates) return null;
    var from = dayOrdinal(raw.dates.from);
    var to = dayOrdinal(raw.dates.to);
    var p = raw.particles;
    if (from === null || to === null) return null;
    if (raw.enabled === false) return null;
    if (SUPPORTED_PARTICLES.indexOf(p.kind) === -1 || !(p.count > 0)) return null;
    var sprites = (Array.isArray(p.sprites) ? p.sprites : []).filter(function (n) { return typeof n === 'string'; });
    if (p.kind === 'sprites' && !sprites.length) return null;
    var colors = (Array.isArray(p.colors) ? p.colors : []).filter(function (c) {
      return /^#[0-9a-f]{6}$/i.test(c);
    });
    return {
      id: raw.id,
      title: typeof raw.title === 'string' ? raw.title : raw.id,
      from: from,
      to: to,
      priority: Number(raw.priority) || 0,
      triggers: Array.isArray(raw.triggers) ? raw.triggers.map(String) : [],
      duration: Math.max(Number(raw.durationMs) || 0, 2000) / 1000,
      particles: {
        kind: p.kind,
        count: Math.floor(p.count),
        speed: range(p.speed, [40, 90]),
        size: range(p.size, [10, 24]),
        colors: colors.length ? colors : ['#8EC5FF'],
        spin: !!p.spin,
        tiltWind: !!p.tiltWind,
        tapToPop: !!p.tapToPop,
        settle: p.rise ? null : normalizeSettle(p.settle),
        sprites: sprites,
        rise: !!p.rise,
        images: []
      },
      src: raw._src || 'bundle',
      cdnFirst: !!raw._cdnFirst,
      decor: (Array.isArray(raw.decor) ? raw.decor : []).filter(function (d) {
        return d && typeof d.kind === 'string';
      })
    };
  }

  // Пустой, битый или чужой версии конфиг даёт null: приложение просто остаётся без эффекта.
  function sanitizeConfig(raw) {
    if (!raw || raw.version !== 1 || !Array.isArray(raw.effects)) return null;
    var effects = raw.effects.map(function (e) {
      try { return normalizeEffect(e); } catch (err) { return null; }
    }).filter(Boolean);
    if (!effects.length) return null;
    var max = Number(raw.maxParticles);
    return { maxParticles: max > 0 ? Math.min(max, 200) : 80, effects: effects, settings: raw.settings || {} };
  }

  // ---------- Картинки частиц (только свой CDN) ----------

  var allowedOrigins = [location.origin];

  function isAllowed(href) {
    try { return allowedOrigins.indexOf(new URL(href).origin) !== -1; } catch (err) { return false; }
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  // SVG берём текстом и кэшируем: без сети картинки берутся из прошлой загрузки
  function loadSvg(href) {
    if (!isAllowed(href)) return Promise.reject(new Error('blocked'));
    var key = 'seasonal.asset.' + href;
    return fetch(href)
      .then(function (r) {
        if (!r.ok) throw new Error('asset');
        return r.text();
      })
      .then(function (text) {
        writeStorage(key, text);
        return text;
      }, function () {
        var cached = readStorage(key);
        if (cached === null) throw new Error('asset');
        return cached;
      })
      .then(function (text) { return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)); });
  }

  function loadFirst(hrefs) {
    var i = 0;
    function next() {
      if (i >= hrefs.length) return Promise.reject(new Error('asset'));
      return loadSvg(hrefs[i++]).catch(next);
    }
    return next();
  }

  // Картинка растеризуется один раз в заготовку SPRITE_SIZE, с сохранением пропорций
  function rasterize(img) {
    var c = document.createElement('canvas');
    c.width = c.height = SPRITE_SIZE;
    var ratio = (img.naturalWidth / img.naturalHeight) || 1;
    var w = ratio >= 1 ? SPRITE_SIZE : SPRITE_SIZE * ratio;
    var h = ratio >= 1 ? SPRITE_SIZE / ratio : SPRITE_SIZE;
    c.getContext('2d').drawImage(img, (SPRITE_SIZE - w) / 2, (SPRITE_SIZE - h) / 2, w, h);
    return c;
  }

  // Картинки эффекта: пришёл с CDN — ищем сначала там, потом в приложении
  function preloadSprites(config, sources) {
    if (!config || !window.fetch) return Promise.resolve();
    return Promise.all(config.effects.map(function (e) {
      if (e.particles.kind !== 'sprites') return null;
      var bases = e.src !== 'cdn' || !sources.cdn ? [sources.bundle]
        : e.cdnFirst ? [sources.cdn, sources.bundle] : [sources.bundle, sources.cdn];
      return Promise.all(e.particles.sprites.map(function (name) {
        return loadFirst(bases.map(function (b) { return new URL(name, b).href; })).then(rasterize, function () { return null; });
      })).then(function (images) { e.particles.images = images.filter(Boolean); });
    }));
  }

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }

  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* хранилище недоступно — живём без него */ }
  }

  function readJson(key) {
    try { return JSON.parse(readStorage(key)); } catch (err) { return null; }
  }

  function setConfig(config) {
    state.config = config;
    applySettings(config && config.settings);
  }

  // Дефолт из приложения сразу; конфиг с CDN — в фоне, применяется, как только не идёт показ
  function loadConfig(options) {
    var bundleUrl = new URL(options.configUrl || CONFIG_URL, location.href);
    var cdnUrl = options.cdnUrl ? new URL(options.cdnUrl, location.href) : null;
    var sources = { bundle: bundleUrl, cdn: cdnUrl };
    allowedOrigins = [location.origin, bundleUrl.origin].concat(cdnUrl ? [cdnUrl.origin] : []);
    var cdnKey = cdnUrl ? 'seasonal.cdn.' + cdnUrl.href : null;
    var fallbackRaw = FALLBACK_CONFIG;
    setConfig(sanitizeConfig(fallbackRaw));
    state.source = 'fallback';

    if (!window.fetch) return Promise.resolve(state.config);
    return fetch(bundleUrl.href, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (bundleRaw) {
        // Дефолт из приложения; если не прочитался — его прошлая копия, потом встроенная
        var base = sanitizeConfig(bundleRaw) ? bundleRaw : (sanitizeConfig(readJson(STORAGE_CONFIG)) ? readJson(STORAGE_CONFIG) : fallbackRaw);
        if (sanitizeConfig(bundleRaw)) writeStorage(STORAGE_CONFIG, JSON.stringify(bundleRaw));
        var cached = cdnKey ? readJson(cdnKey) : null;
        var merged = sanitizeConfig(mergeConfig(base, cached)) || sanitizeConfig(base);
        state.source = cached ? 'cdn-cache' : 'bundle';
        if (cdnUrl) fetchCdn(cdnUrl, cdnKey, cached, base, sources);
        return preloadSprites(merged, sources).then(function () {
          setConfig(merged);
          return state.config;
        });
      });
  }

  function fetchCdn(cdnUrl, cdnKey, cached, base, sources) {
    fetch(cdnUrl.href, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('cdn');
        return r.json();
      })
      .then(function (fresh) {
        if (JSON.stringify(fresh) === JSON.stringify(cached)) {
          state.source = 'cdn';
          return;
        }
        var next = sanitizeConfig(mergeConfig(base, fresh));
        if (!next) return;
        writeStorage(cdnKey, JSON.stringify(fresh));
        preloadSprites(next, sources).then(function () {
          // Не посреди показа: применим, когда он закончится
          if (state.run) state.pendingConfig = next;
          else setConfig(next);
          state.source = 'cdn';
        });
      })
      .catch(function () { /* CDN недоступен — остаёмся на дефолте или кэше */ });
  }

  // ---------- Когда показывать ----------

  function effectiveDate() {
    return state.dateOverride || new Date();
  }

  function dayKey(date) {
    return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
  }

  function effectFor(date, trigger) {
    if (!state.config) return null;
    var day = (date.getMonth() + 1) * 100 + date.getDate();
    var best = null;
    state.config.effects.forEach(function (e) {
      var inRange = e.from <= e.to ? day >= e.from && day <= e.to : day >= e.from || day <= e.to;
      if (inRange && e.triggers.indexOf(trigger) !== -1 && (!best || e.priority > best.priority)) best = e;
    });
    return best;
  }

  /** Возвращает показанный эффект или null с причиной в reason. */
  function trigger(name) {
    if (state.suppressed) return { effect: null, reason: 'Экран критичный, эффект запрещён' };
    // Тряска стряхивает осевший снег, и сразу идёт новый
    if (name === 'shake' && hasSnow()) {
      if (!state.run) {
        var again = effectFor(effectiveDate(), 'shake');
        if (again) startRun(again);
      }
      if (state.run) {
        shakeOff(state.run);
        return { effect: state.run.effect, reason: '' };
      }
      clearCaps();
      return { effect: null, reason: 'Снег стряхнули' };
    }
    if (state.run) return { effect: state.run.effect, reason: 'Эффект уже идёт' };
    var date = effectiveDate();
    // С подменённой датой (демо) лимит «раз в день» не действует, иначе повторно показать эффект нельзя.
    var limited = name === 'first_open_of_day' && !state.dateOverride;
    if (limited && readStorage(STORAGE_DAY) === dayKey(date)) {
      return { effect: null, reason: 'Сегодня эффект уже показывали' };
    }
    var effect = effectFor(date, name);
    if (!effect) return { effect: null, reason: 'На эту дату эффекта нет' };
    if (effect.particles.kind === 'sprites' && !effect.particles.images.length) {
      return { effect: null, reason: 'Картинки эффекта не загрузились' };
    }
    if (limited) writeStorage(STORAGE_DAY, dayKey(date));
    startRun(effect);
    return { effect: effect, reason: '' };
  }

  // ---------- Симуляция ----------

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerp(r, t) {
    return r[0] + (r[1] - r[0]) * t;
  }

  function makeFlake(run, seeding) {
    var spec = run.effect.particles;
    var depth = Math.random();
    var size = lerp(spec.size, depth);
    var h = state.height;
    var y = spec.rise
      ? (seeding ? rand(h * 0.4, h * 1.5) : h + size + rand(0, 60))
      : (seeding ? rand(-h * 0.5, h * 0.6) : -size - rand(0, 60));
    return {
      x: rand(0, state.width),
      y: y,
      sprite: spec.images.length ? Math.floor(Math.random() * spec.images.length) : -1,
      size: size,
      depth: depth,
      fall: lerp(spec.speed, depth) * rand(0.85, 1.15),
      angle: rand(0, Math.PI * 2),
      spin: run.spin ? rand(-1.2, 1.2) : 0,
      phase: rand(0, Math.PI * 2),
      color: spec.colors[Math.floor(Math.random() * spec.colors.length)]
    };
  }

  function startRun(effect) {
    var count = Math.min(effect.particles.count, state.config.maxParticles);
    var run = {
      effect: effect,
      time: 0,
      duration: effect.duration,
      targetCount: state.reduceMotion ? Math.ceil(count / 3) : count,
      spin: effect.particles.spin && !state.reduceMotion,
      wind: 0,
      opacity: 0,
      guard: 1,
      closing: false,
      treeTapAt: -10,
      settle: state.reduceMotion ? null : effect.particles.settle,
      flakes: [],
      sparks: []
    };
    resize();
    if (run.settle) {
      state.settle = run.settle;
      window.clearTimeout(state.meltTimer);
      prepareCaps(run.settle);
    }
    for (var i = 0; i < run.targetCount; i++) run.flakes.push(makeFlake(run, true));
    state.run = run;
    state.lastTs = 0;
    state.canvas.hidden = false;
    state.rafId = window.requestAnimationFrame(frame);
    notify();
  }

  function endRun() {
    window.cancelAnimationFrame(state.rafId);
    state.run = null;
    state.ctx.setTransform(1, 0, 0, 1, 0, 0);
    state.ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    state.canvas.hidden = true;
    if (state.caps.length) scheduleMelt();
    if (state.pendingConfig) {
      setConfig(state.pendingConfig);
      state.pendingConfig = null;
    }
    notify();
  }

  // ---------- Снег оседает на интерфейсе ----------
  //
  // Сугроб — маленький canvas над верхним краем элемента. Он лежит внутри элемента (или рядом,
  // в прокручиваемом экране, если элемент обрезает содержимое), поэтому скроллится вместе с ним.
  // Касания не ловит. Тряска стряхивает снег, через meltMs он тает сам.

  function capContainer(target) {
    return window.getComputedStyle(target).overflow === 'hidden' ? (target.closest('.screen') || state.host) : target;
  }

  function prepareCaps(settle) {
    var targets = state.host.querySelectorAll(settle.targets);
    Array.prototype.forEach.call(targets, function (target) {
      if (!target.getClientRects().length || target.offsetWidth < 30) return;
      for (var i = 0; i < state.caps.length; i++) if (state.caps[i].target === target) return;
      var container = capContainer(target);
      if (container === target && window.getComputedStyle(target).position === 'static') target.style.position = 'relative';
      var w = target.offsetWidth;
      var h = settle.maxDepth + 6;
      var canvas = document.createElement('canvas');
      canvas.className = 'snow-cap';
      canvas.setAttribute('aria-hidden', 'true');
      canvas.width = Math.round(w * state.dpr);
      canvas.height = Math.round(h * state.dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      canvas.style.left = (container === target ? 0 : target.offsetLeft) + 'px';
      canvas.style.top = (container === target ? 0 : target.offsetTop) + 2 - h + 'px';
      container.appendChild(canvas);
      var bins = Math.ceil(w / CAP_BIN) + 1;
      state.caps.push({
        target: target, canvas: canvas, g: canvas.getContext('2d'), w: w, h: h, bins: bins,
        depth: new Float32Array(bins), radius: parseFloat(window.getComputedStyle(target).borderTopLeftRadius) || 0,
        dirty: false, rect: null
      });
    });
  }

  // У скруглённых углов снег тоньше: сугроб «стекает» с края
  function capLimit(cap, x, maxDepth) {
    var edge = Math.min(x, cap.w - x);
    var k = Math.min(1, edge / Math.max(cap.radius, 8));
    return maxDepth * k * k * (3 - 2 * k);
  }

  function deposit(cap, x, size, maxDepth) {
    var center = x / CAP_BIN;
    var spread = Math.max(1.5, size / CAP_BIN * 0.7);
    var amount = size * 0.14;
    var from = Math.max(0, Math.floor(center - spread * 2));
    var to = Math.min(cap.bins - 1, Math.ceil(center + spread * 2));
    for (var i = from; i <= to; i++) {
      var d = (i - center) / spread;
      cap.depth[i] = Math.min(capLimit(cap, i * CAP_BIN, maxDepth), cap.depth[i] + amount * Math.exp(-d * d));
    }
    cap.dirty = true;
  }

  function capRects() {
    var host = state.host.getBoundingClientRect();
    state.caps.forEach(function (cap) {
      var r = cap.target.getBoundingClientRect();
      cap.rect = r.width ? { left: r.left - host.left, right: r.right - host.left, top: r.top - host.top } : null;
    });
  }

  function drawCap(cap) {
    var g = cap.g;
    var H = cap.h;
    g.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    g.clearRect(0, 0, cap.w, H);
    g.beginPath();
    g.moveTo(0, H);
    var px = 0;
    var py = H - cap.depth[0];
    g.lineTo(px, py);
    for (var i = 1; i < cap.bins; i++) {
      var x = Math.min(cap.w, i * CAP_BIN);
      var y = H - cap.depth[i];
      g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
      px = x;
      py = y;
    }
    g.lineTo(cap.w, H);
    g.closePath();
    var grad = g.createLinearGradient(0, H - 12, 0, H);
    grad.addColorStop(0, '#FFFFFF');
    grad.addColorStop(1, '#D6E6FF');
    g.fillStyle = grad;
    g.fill();
    cap.dirty = false;
  }

  function hasSnow() {
    return state.caps.some(function (cap) {
      for (var i = 0; i < cap.bins; i++) if (cap.depth[i] > 0.8) return true;
      return false;
    });
  }

  function clearCaps() {
    window.clearTimeout(state.meltTimer);
    state.caps.forEach(function (cap) { cap.canvas.remove(); });
    state.caps = [];
  }

  function scheduleMelt() {
    window.clearTimeout(state.meltTimer);
    state.meltTimer = window.setTimeout(function () {
      var caps = state.caps;
      state.caps = [];
      caps.forEach(function (cap) {
        cap.canvas.style.transition = 'opacity 1.5s';
        cap.canvas.style.opacity = '0';
      });
      window.setTimeout(function () { caps.forEach(function (cap) { cap.canvas.remove(); }); }, 1600);
    }, state.settle ? state.settle.meltMs : 25000);
  }

  // Снег с элементов разлетается комьями и падает
  function shakeOff(run) {
    capRects();
    state.caps.forEach(function (cap) {
      var r = cap.rect;
      if (!r) return;
      for (var i = 0; i < cap.bins; i += 2) {
        var d = cap.depth[i];
        if (d < 1.2) continue;
        run.sparks.push({
          x: r.left + i * CAP_BIN, y: r.top - d / 2,
          vx: rand(-80, 80), vy: rand(-200, -40),
          life: 1.1, color: '#FFFFFF', r: 1.4 + d * 0.3
        });
      }
    });
    clearCaps();
  }

  function step(run, dt) {
    run.time += dt;
    var spawning = run.time < run.duration - FADE_OUT && !run.closing;
    if (run.closing) run.guard = Math.max(0, run.guard - dt / GUARD_FADE);
    run.opacity = Math.min(1, run.time / FADE_IN, Math.max(0, (run.duration - run.time) / FADE_OUT)) * run.guard;

    var tilt = state.hasSensor ? state.tilt : state.manualTilt;
    var targetWind = run.effect.particles.tiltWind ? tilt * 240 : 0;
    run.wind += (targetWind - run.wind) * Math.min(1, dt * 2.5);

    var w = state.width;
    var h = state.height;
    var settle = run.settle && !run.closing && state.caps.length ? run.settle : null;
    if (settle) capRects();
    for (var i = run.flakes.length - 1; i >= 0; i--) {
      var f = run.flakes[i];
      var prevY = f.y;
      var sway = Math.sin(run.time * 1.4 + f.phase) * 18 * (0.5 + f.depth);
      f.x += (run.wind * (0.5 + 0.5 * f.depth) + sway) * dt;
      f.y += f.fall * dt * (run.effect.particles.rise ? -1 : 1);
      // Снежинка переднего плана, пересёкшая верхний край элемента, может на нём остаться
      if (settle && f.depth > 0.25 && landOnCap(f, prevY, settle)) {
        if (spawning) run.flakes[i] = makeFlake(run, false);
        else run.flakes.splice(i, 1);
        continue;
      }
      f.angle += f.spin * dt;
      if (f.x < -f.size) f.x = w + f.size;
      else if (f.x > w + f.size) f.x = -f.size;
      if (run.effect.particles.rise ? f.y < -f.size : f.y > h + f.size) {
        if (spawning) run.flakes[i] = makeFlake(run, false);
        else run.flakes.splice(i, 1);
      }
    }

    for (var j = run.sparks.length - 1; j >= 0; j--) {
      var s = run.sparks[j];
      s.life -= dt;
      s.vy += 260 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.life <= 0) run.sparks.splice(j, 1);
    }
  }

  function landOnCap(f, prevY, settle) {
    for (var k = 0; k < state.caps.length; k++) {
      var cap = state.caps[k];
      var r = cap.rect;
      if (r && prevY < r.top && f.y >= r.top && f.x > r.left + 2 && f.x < r.right - 2 && Math.random() < settle.chance) {
        deposit(cap, f.x - r.left, f.size, settle.maxDepth);
        return true;
      }
    }
    return false;
  }

  function burst(run, x, y, count, speed) {
    for (var i = 0; i < count; i++) {
      var a = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
      var v = rand(speed * 0.6, speed);
      run.sparks.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        life: 0.6, color: SPARK_COLORS[i % SPARK_COLORS.length]
      });
    }
  }

  // ---------- Тапы ----------

  function vibrate() {
    var now = Date.now();
    if (now - state.lastVibration < 120) return;
    state.lastVibration = now;
    // Контракт приложения: тактильный отклик просим через канал сообщений.
    window.postMessage({ type: 'VIBRATION_EVENT' }, '*');
  }

  function onPointerDown(event) {
    var run = state.run;
    if (!run || run.closing || run.opacity < 0.2) return;
    var rect = state.host.getBoundingClientRect();
    var x = event.clientX - rect.left;
    var y = event.clientY - rect.top;

    if (run.effect.particles.tapToPop) {
      var best = -1;
      var bestDist = Infinity;
      run.flakes.forEach(function (f, i) {
        var d = Math.hypot(f.x - x, f.y - y);
        if (d < f.size * 0.9 + 14 && d < bestDist) { best = i; bestDist = d; }
      });
      if (best !== -1) {
        var popped = run.flakes[best];
        burst(run, popped.x, popped.y, 8, 190);
        run.flakes[best] = makeFlake(run, false);
        vibrate();
        return;
      }
    }

    var tree = treeLayout(run);
    if (tree && x >= tree.x - 8 && x <= tree.x + tree.w + 8 && y >= tree.y - 8 && y <= tree.y + tree.h + 8) {
      run.treeTapAt = run.time;
      burst(run, tree.x + tree.w / 2, tree.y + tree.h * 0.07, 14, 230);
      vibrate();
    }
  }

  // ---------- Датчики ----------

  function onOrientation(event) {
    if (event.gamma === null || event.gamma === undefined) return;
    state.hasSensor = true;
    state.tilt = Math.max(-1, Math.min(1, event.gamma / 45));
  }

  function onMotion(event) {
    var a = event.acceleration;
    var force;
    if (a && a.x !== null) {
      force = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    } else {
      // Без гироскопа браузер даёт только ускорение с гравитацией: считаем отклонение от 1 g
      var g = event.accelerationIncludingGravity;
      if (!g || g.x === null) return;
      force = Math.abs(Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) - 9.81);
    }
    var now = Date.now();
    if (force > SHAKE_FORCE && now - state.lastShake > SHAKE_COOLDOWN) {
      state.lastShake = now;
      if (state.onShake) state.onShake();
      else trigger('shake');
    }
  }

  // iOS Safari отдаёт датчики только после разрешения, а спросить можно только из жеста,
  // который iOS считает настоящим: touchend или click. Касание пальцем (pointerdown) не считается —
  // запрос молча отклоняется. Поэтому спрашиваем, пока не получим ответ «разрешить» или «запретить».
  function askSensorPermission() {
    if (state.sensorsAsked) return;
    var apis = [window.DeviceMotionEvent, window.DeviceOrientationEvent].filter(function (api) {
      return api && typeof api.requestPermission === 'function';
    });
    if (!apis.length) {
      state.sensorsAsked = true;
      return;
    }
    apis.forEach(function (api) {
      api.requestPermission()
        .then(function () { state.sensorsAsked = true; })
        .catch(function () { /* вызов не из жеста — спросим на следующем тапе */ });
    });
  }

  // ---------- Отрисовка ----------

  function resize() {
    var rect = state.host.getBoundingClientRect();
    state.dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.width = rect.width;
    state.height = rect.height;
    state.canvas.width = Math.round(rect.width * state.dpr);
    state.canvas.height = Math.round(rect.height * state.dpr);
    var probe = document.getElementById('safe-top-probe');
    state.topInset = probe ? probe.getBoundingClientRect().height : 0;
  }

  function snowflakeSprite(color) {
    if (state.sprites[color]) return state.sprites[color];
    var sprite = document.createElement('canvas');
    sprite.width = sprite.height = SPRITE_SIZE;
    var c = sprite.getContext('2d');
    var r = SPRITE_SIZE / 2 - 4;
    c.translate(SPRITE_SIZE / 2, SPRITE_SIZE / 2);
    c.lineCap = 'round';
    function arms() {
      c.beginPath();
      for (var k = 0; k < 6; k++) {
        c.save();
        c.rotate(k * Math.PI / 3);
        c.moveTo(0, 0); c.lineTo(0, -r);
        c.moveTo(0, -r * 0.5); c.lineTo(-r * 0.24, -r * 0.72);
        c.moveTo(0, -r * 0.5); c.lineTo(r * 0.24, -r * 0.72);
        c.moveTo(0, -r * 0.76); c.lineTo(-r * 0.14, -r * 0.9);
        c.moveTo(0, -r * 0.76); c.lineTo(r * 0.14, -r * 0.9);
        c.restore();
      }
    }
    arms();
    c.strokeStyle = 'rgba(41, 97, 178, 0.28)';
    c.lineWidth = 7;
    c.stroke();
    arms();
    c.strokeStyle = color;
    c.lineWidth = 3.4;
    c.stroke();
    state.sprites[color] = sprite;
    return sprite;
  }

  function treeLayout(run) {
    var spec = run.effect.decor.filter(function (d) { return d.kind === 'tree'; })[0];
    if (!spec) return null;
    var pct = Math.max(0.15, Math.min(0.5, Number(spec.widthPct) || 0.3));
    var w = state.width * pct;
    var h = w * 1.4;
    var rise = 1 - easeOut(Math.min(1, run.time / 0.8));
    return {
      x: spec.anchor === 'bottom_start' ? 12 : state.width - w - 12,
      y: state.height - h - 16 + rise * h * 0.4,
      w: w,
      h: h
    };
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function starPath(ctx, cx, cy, outer) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? outer * 0.45 : outer;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath();
  }

  function drawTree(ctx, run) {
    var t = treeLayout(run);
    if (!t) return;
    var since = run.time - run.treeTapAt;
    var wiggle = since < 1.5 ? 0.07 * Math.sin(since * 18) * Math.exp(-since * 3) : 0;

    ctx.save();
    ctx.translate(t.x + t.w / 2, t.y + t.h);
    ctx.rotate(wiggle);
    ctx.translate(-t.w / 2, -t.h);

    // ствол
    ctx.fillStyle = '#7A4B2A';
    ctx.fillRect(t.w * 0.42, t.h * 0.86, t.w * 0.16, t.h * 0.13);

    // ярусы, нижний первым
    TREE.tiers.forEach(function (tier, i) {
      ctx.beginPath();
      ctx.moveTo(t.w / 2, t.h * tier.apex);
      ctx.lineTo(t.w / 2 + t.w * tier.half, t.h * tier.base);
      ctx.quadraticCurveTo(t.w / 2, t.h * (tier.base + 0.05), t.w / 2 - t.w * tier.half, t.h * tier.base);
      ctx.closePath();
      ctx.fillStyle = i === 2 ? '#3BB26B' : i === 1 ? '#2E9E5B' : '#25894D';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1D6B3E';
      ctx.stroke();
    });

    // игрушки мигают по очереди
    TREE.ornaments.forEach(function (o, i) {
      var glow = 0.55 + 0.45 * Math.sin(run.time * 3 + i * 1.3);
      var r = t.w * 0.045;
      ctx.globalAlpha = 0.35 * glow;
      ctx.fillStyle = FESTIVE[i % FESTIVE.length];
      ctx.beginPath();
      ctx.arc(t.w * o[0], t.h * o[1], r * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(t.w * o[0], t.h * o[1], r, 0, Math.PI * 2);
      ctx.fill();
    });

    // звезда, после тапа вспыхивает
    var flash = since < 0.8 ? 1 - since / 0.8 : 0;
    var starR = t.w * 0.09 * (1 + flash * 0.4);
    ctx.globalAlpha = 0.3 + flash * 0.5;
    ctx.fillStyle = '#FFE38A';
    ctx.beginPath();
    ctx.arc(t.w / 2, t.h * 0.07, starR * 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#FFC83D';
    starPath(ctx, t.w / 2, t.h * 0.07, starR);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#E0A100';
    ctx.stroke();

    ctx.restore();
  }

  function drawGarland(ctx, run) {
    var segments = 3;
    var sag = 22;
    var drop = (1 - easeOut(Math.min(1, run.time / 0.8))) * 40;
    var y = state.topInset + 2 - drop;
    var segW = state.width / segments;
    var colors = ['#E8453C', '#FFC83D', '#3CCB7F', '#3D8BFF'];
    var bulb = 0;

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#24543A';
    for (var s = 0; s < segments; s++) {
      var x0 = s * segW;
      var x1 = x0 + segW;
      var cx = x0 + segW / 2;
      var cy = y + sag * 2;
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.quadraticCurveTo(cx, cy, x1, y);
      ctx.stroke();

      for (var k = 0; k < 5; k++) {
        var t = 0.1 + k * 0.2;
        var bx = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * cx + t * t * x1;
        var by = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * cy + t * t * y + 7;
        var lit = Math.sin(run.time * 4 + (bulb % 2) * Math.PI) > 0;
        var color = colors[bulb % colors.length];
        if (lit) {
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(bx, by, 11, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = lit ? 1 : 0.55;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(bx, by, 4.5, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#24543A';
        ctx.fillRect(bx - 2.5, by - 9, 5, 4);
        bulb++;
      }
    }
  }

  function draw(run) {
    var ctx = state.ctx;
    var dpr = state.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
    ctx.globalAlpha = 1;
    state.canvas.style.opacity = run.opacity.toFixed(3);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var kinds = run.effect.decor.map(function (d) { return d.kind; });
    if (kinds.indexOf('tree') !== -1) drawTree(ctx, run);
    if (kinds.indexOf('garland') !== -1) drawGarland(ctx, run);

    run.flakes.forEach(function (f) {
      var scale = f.size / SPRITE_SIZE * dpr;
      var cos = Math.cos(f.angle) * scale;
      var sin = Math.sin(f.angle) * scale;
      ctx.setTransform(cos, sin, -sin, cos, f.x * dpr, f.y * dpr);
      var images = run.effect.particles.images;
      ctx.drawImage(f.sprite >= 0 && images[f.sprite] ? images[f.sprite] : snowflakeSprite(f.color), -SPRITE_SIZE / 2, -SPRITE_SIZE / 2);
    });

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    run.sparks.forEach(function (s) {
      ctx.globalAlpha = Math.max(0, Math.min(1, s.life / 0.6));
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r || 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    state.caps.forEach(function (cap) { if (cap.dirty) drawCap(cap); });
  }

  function frame(ts) {
    var run = state.run;
    if (!run) return;
    var dt = state.lastTs ? Math.min((ts - state.lastTs) / 1000, MAX_DT) : 0;
    state.lastTs = ts;
    step(run, dt);
    draw(run);
    if (run.time >= run.duration || (run.closing && run.guard <= 0)) {
      endRun();
      return;
    }
    state.rafId = window.requestAnimationFrame(frame);
  }

  function notify() {
    if (state.onChange) state.onChange(state.run ? state.run.effect : null);
  }

  // ---------- Публичный API ----------

  window.Seasonal = {
    /**
     * host — элемент, поверх которого рисуется слой; canvas — его холст.
     * onShake — если задан, тряску решает приложение (например, отдаёт её дудлу), а не слой.
     * configUrl — конфиг по умолчанию из приложения, cdnUrl — конфиг с CDN поверх него (адрес даёт приложение).
     * Первый показ — через 400 мс после загрузки, чтобы не тормозить запуск экрана.
     */
    init: function (options) {
      state.host = options.host;
      state.canvas = options.canvas;
      state.ctx = state.canvas.getContext('2d');
      state.canvas.hidden = true;
      state.onChange = options.onChange || null;
      state.onShake = options.onShake || null;
      state.reduceMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
      if (options.dateOverride) state.dateOverride = options.dateOverride;

      window.addEventListener('resize', function () {
        if (state.run) resize();
        clearCaps();
      });
      document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
      document.addEventListener('touchend', askSensorPermission, { capture: true, passive: true });
      document.addEventListener('click', askSensorPermission, true);
      window.addEventListener('deviceorientation', onOrientation);
      window.addEventListener('devicemotion', onMotion);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (state.run) endRun();
        } else {
          window.setTimeout(function () { trigger('first_open_of_day'); }, FIRST_SHOW_DELAY);
        }
      });

      return loadConfig(options).then(function () {
        return new Promise(function (resolve) {
          window.requestAnimationFrame(function () {
            window.setTimeout(function () { resolve(trigger('first_open_of_day')); }, FIRST_SHOW_DELAY);
          });
        });
      });
    },

    trigger: trigger,

    /** На критичных экранах (оплата, перевод, реквизиты, лимиты) слой гаснет за 200 мс и не запускается. */
    setSuppressed: function (value) {
      state.suppressed = !!value;
      if (state.suppressed && state.run) state.run.closing = true;
    },

    setDateOverride: function (date) {
      state.dateOverride = date || null;
    },

    /** Ветер вручную, когда датчика наклона нет (ноутбук на демо): −1 … 1. */
    setManualTilt: function (value) {
      state.manualTilt = Math.max(-1, Math.min(1, Number(value) || 0));
    },

    /** Лежит ли осевший снег: тогда тряска стряхивает его. */
    hasSnow: hasSnow,

    /** Ребёнок нажал кнопку приложения или начал листать: показ мягко гаснет. Осевший снег остаётся. */
    skip: function () {
      if (state.run && !state.run.closing) state.run.closing = true;
    },

    /** Откуда конфиг: 'fallback', 'bundle', 'cdn-cache', 'cdn'. */
    source: function () { return state.source; },

    resetDailyLimit: function () {
      try { window.localStorage.removeItem(STORAGE_DAY); } catch (err) { /* нет хранилища — нечего сбрасывать */ }
    },

    effectiveDate: effectiveDate
  };
})();
