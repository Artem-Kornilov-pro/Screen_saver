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
  var SHAKE_FORCE = 18;       // м/с², без гравитации
  var SHAKE_COOLDOWN = 1500;  // мс
  var SPRITE_SIZE = 64;       // px, заготовка снежинки

  var SUPPORTED_PARTICLES = ['snowflake'];

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
        spin: true, tiltWind: true, tapToPop: true
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
    onShake: null
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

  function normalizeEffect(raw) {
    if (!raw || typeof raw.id !== 'string' || !raw.particles || !raw.dates) return null;
    var from = dayOrdinal(raw.dates.from);
    var to = dayOrdinal(raw.dates.to);
    var p = raw.particles;
    if (from === null || to === null) return null;
    if (SUPPORTED_PARTICLES.indexOf(p.kind) === -1 || !(p.count > 0)) return null;
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
        tapToPop: !!p.tapToPop
      },
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
    return { maxParticles: max > 0 ? Math.min(max, 200) : 80, effects: effects };
  }

  function readStorage(key) {
    try { return window.localStorage.getItem(key); } catch (err) { return null; }
  }

  function writeStorage(key, value) {
    try { window.localStorage.setItem(key, value); } catch (err) { /* хранилище недоступно — живём без него */ }
  }

  function loadConfig() {
    var fallback = sanitizeConfig(FALLBACK_CONFIG);
    var cached = null;
    try { cached = sanitizeConfig(JSON.parse(readStorage(STORAGE_CONFIG))); } catch (err) { cached = null; }
    state.config = cached || fallback;

    if (!window.fetch) return Promise.resolve(state.config);
    return fetch(CONFIG_URL, { cache: 'no-store' })
      .then(function (response) { return response.ok ? response.json() : null; })
      .then(function (raw) {
        var fresh = sanitizeConfig(raw);
        if (fresh) {
          state.config = fresh;
          writeStorage(STORAGE_CONFIG, JSON.stringify(raw));
        }
        return state.config;
      })
      .catch(function () { return state.config; });
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
    if (state.run) return { effect: state.run.effect, reason: 'Эффект уже идёт' };
    var date = effectiveDate();
    // С подменённой датой (демо) лимит «раз в день» не действует, иначе повторно показать эффект нельзя.
    var limited = name === 'first_open_of_day' && !state.dateOverride;
    if (limited && readStorage(STORAGE_DAY) === dayKey(date)) {
      return { effect: null, reason: 'Сегодня эффект уже показывали' };
    }
    var effect = effectFor(date, name);
    if (!effect) return { effect: null, reason: 'На эту дату эффекта нет' };
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
    return {
      x: rand(0, state.width),
      y: seeding ? rand(-state.height * 0.5, state.height * 0.6) : -size - rand(0, 60),
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
      flakes: [],
      sparks: []
    };
    resize();
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
    notify();
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
    for (var i = run.flakes.length - 1; i >= 0; i--) {
      var f = run.flakes[i];
      var sway = Math.sin(run.time * 1.4 + f.phase) * 18 * (0.5 + f.depth);
      f.x += (run.wind * (0.5 + 0.5 * f.depth) + sway) * dt;
      f.y += f.fall * dt;
      f.angle += f.spin * dt;
      if (f.x < -f.size) f.x = w + f.size;
      else if (f.x > w + f.size) f.x = -f.size;
      if (f.y > h + f.size) {
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
    askSensorPermission();
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
    if (!a || a.x === null) return;
    var force = Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
    var now = Date.now();
    if (force > SHAKE_FORCE && now - state.lastShake > SHAKE_COOLDOWN) {
      state.lastShake = now;
      if (state.onShake) state.onShake();
      else trigger('shake');
    }
  }

  // iOS Safari отдаёт датчики только после явного разрешения по жесту пользователя.
  function askSensorPermission() {
    if (state.sensorsAsked) return;
    state.sensorsAsked = true;
    [window.DeviceMotionEvent, window.DeviceOrientationEvent].forEach(function (api) {
      if (api && typeof api.requestPermission === 'function') {
        api.requestPermission().catch(function () { /* отказали — остаётся ручной ветер */ });
      }
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
      ctx.drawImage(snowflakeSprite(f.color), -SPRITE_SIZE / 2, -SPRITE_SIZE / 2);
    });

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    run.sparks.forEach(function (s) {
      ctx.globalAlpha = Math.max(0, s.life / 0.6);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
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

      window.addEventListener('resize', function () { if (state.run) resize(); });
      document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
      window.addEventListener('deviceorientation', onOrientation);
      window.addEventListener('devicemotion', onMotion);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (state.run) endRun();
        } else {
          window.setTimeout(function () { trigger('first_open_of_day'); }, 400);
        }
      });

      return loadConfig().then(function () {
        return new Promise(function (resolve) {
          window.requestAnimationFrame(function () {
            window.setTimeout(function () { resolve(trigger('first_open_of_day')); }, 400);
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

    resetDailyLimit: function () {
      try { window.localStorage.removeItem(STORAGE_DAY); } catch (err) { /* нет хранилища — нечего сбрасывать */ }
    },

    effectiveDate: effectiveDate
  };
})();
