/*
 * Движок дудлов СберKids: выбирает дудл по дате из manifest.json,
 * предзагружает пак и рисует эффекты в слое поверх экрана.
 * Чистый JS, без зависимостей и без сетевых запросов, кроме манифеста и пака.
 */
(function (global) {
  'use strict';

  var APP_VERSION = '1.0.0';
  var MAX_PARTICLES = 80;
  var LS = 'sbkids.doodles.';

  var HINT_SPARKLE =
    '<svg viewBox="0 0 48 48" width="18" height="18"><path d="M24 2 C26 16 32 22 46 24 C32 26 26 32 24 46 ' +
    'C22 32 16 26 2 24 C16 22 22 16 24 2 Z" fill="#c3f73a"/><circle cx="24" cy="24" r="4" fill="#fff"/></svg>';

  // ---------- Хранилище (только локально) ----------

  function lsGet(key) {
    try { var v = localStorage.getItem(LS + key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch (e) { /* хранилище недоступно */ }
  }
  function lsClear() {
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf(LS) === 0) localStorage.removeItem(k); });
    } catch (e) { /* хранилище недоступно */ }
  }

  // ---------- Даты ----------

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function md(d) { return pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function profile() {
    var p = lsGet('profile') || {};
    return { age: p.age || 9, birthday: p.birthday || null };
  }

  function matches(when, d) {
    if (!when) return false;
    var x = md(d);
    switch (when.type) {
      case 'fixed':
        return x === when.md;
      case 'range':
        return when.from <= when.to ? x >= when.from && x <= when.to : x >= when.from || x <= when.to;
      case 'nth_weekday': {
        if (d.getMonth() + 1 !== when.month) return false;
        if ((d.getDay() + 6) % 7 + 1 !== when.weekday) return false;
        if (when.n > 0) return Math.ceil(d.getDate() / 7) === when.n;
        var dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return Math.ceil((dim - d.getDate() + 1) / 7) === -when.n;
      }
      case 'dates':
        return (when.list || []).indexOf(ymd(d)) !== -1;
      case 'birthday': {
        var b = profile().birthday;
        return !!b && b.slice(5) === x;
      }
      default:
        return false;
    }
  }

  function versionGte(a, b) {
    a = String(a).split('.').map(Number);
    b = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) {
      if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
    }
    return true;
  }

  var HOLIDAY_PRIORITY = 40;

  function dayNumber(d) {
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  }

  function eligible(it, p) {
    if (it.enabled === false || !it.effect || !RENDERERS[it.effect.type]) return false;
    if (it.minAppVersion && !versionGte(APP_VERSION, it.minAppVersion)) return false;
    if (it.age && (p.age < it.age.min || p.age > it.age.max)) return false;
    return true;
  }

  function pick(manifest, d) {
    if (!manifest || manifest.enabled === false || manifest.schema !== 1) return null;
    var p = profile();
    var items = (manifest.items || []).filter(function (it) { return eligible(it, p); });
    var dated = items.filter(function (it) { return !it.pool && matches(it.when, d); });
    var rank = function (it) { return it.when.type === 'birthday' ? Infinity : it.priority || 0; };
    dated.sort(function (a, b) { return rank(b) - rank(a); });
    // Праздник и день рождения всегда главные
    if (dated[0] && rank(dated[0]) >= HOLIDAY_PRIORITY) return dated[0];
    // Обычный день: дудл дня по очереди — сезонный и «обыденные» из пула. У всех детей в этот день одинаковый.
    var rotation = dated.concat(items.filter(function (it) { return it.pool; }));
    return rotation.length ? rotation[dayNumber(d) % rotation.length] : null;
  }

  function seasonOf(manifest, d) {
    var seasons = manifest.seasons || {};
    var month = d.getMonth() + 1;
    for (var id in seasons) {
      if ((seasons[id].months || []).indexOf(month) !== -1) return { id: id, def: seasons[id] };
    }
    return null;
  }

  // «Обыденный» дудл надевает сезонную одежду: аксессуар на стикер дня и частицы сезона в сцену и финал
  function dressForSeason(item, manifest, manifestUrl, d) {
    var dressed = JSON.parse(JSON.stringify(item));
    var season = seasonOf(manifest, d);
    if (!season) return dressed;
    var base = new URL(season.def.pack || 'packs/' + season.id + '/', manifestUrl);
    var abs = function (name) { return new URL(name, base).href; };
    var eff = dressed.effect;
    if (season.def.wear && eff.buddy) {
      eff.buddy.wear = abs(season.def.wear);
      eff.buddy.wearScale = season.def.wearScale || 1.2;
      eff.buddy.wearTop = season.def.wearTop == null ? -0.5 : season.def.wearTop;
    }
    if (season.def.particles && season.def.particles.length) {
      var fall = {
        type: 'particles', sprites: season.def.particles.map(abs), count: 14, origin: 'top', angle: [70, 110],
        speed: [90, 180], gravity: 80, sway: 50, size: [14, 26], durationMs: 3200, delayMs: 200
      };
      eff.steps = (eff.steps || []).concat([fall]);
      var finale = eff.combo && eff.combo.effect;
      if (finale && finale.type === 'combo') finale.steps = (finale.steps || []).concat([JSON.parse(JSON.stringify(fall))]);
    }
    dressed.seasonId = season.id;
    return dressed;
  }

  // ---------- Пак ----------

  function collectAssets(obj, out) {
    if (Array.isArray(obj)) { obj.forEach(function (v) { collectAssets(v, out); }); return out; }
    if (obj && typeof obj === 'object') {
      Object.keys(obj).forEach(function (k) {
        var v = obj[k];
        if ((k === 'image' || k === 'wear') && typeof v === 'string') out[v] = true;
        else if (k === 'sprites' && Array.isArray(v)) v.forEach(function (s) { out[s] = true; });
        else collectAssets(v, out);
      });
    }
    return out;
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('asset ' + src)); };
      img.src = src;
    });
  }

  // Картинки пака берём текстом и кладём в localStorage: без сети дудл всё равно покажется
  function loadAsset(href) {
    if (!/\.svg(\?|$)/i.test(href) || !global.fetch) return loadImage(href);
    var key = 'asset.' + href;
    return fetch(href)
      .then(function (r) {
        if (!r.ok) throw new Error('asset ' + r.status);
        return r.text();
      })
      .then(function (text) {
        lsSet(key, text);
        return text;
      }, function () {
        var cached = lsGet(key);
        if (typeof cached !== 'string') throw new Error('asset ' + href);
        return cached;
      })
      .then(function (text) { return loadImage('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text)); });
  }

  // Манифест тоже: при ошибке сети берём последнюю удачную копию
  function loadManifest(href) {
    return fetch(href, { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('manifest ' + r.status);
        return r.json();
      })
      .then(function (m) {
        lsSet('manifest', m);
        return m;
      }, function () {
        var cached = lsGet('manifest');
        if (!cached) throw new Error('no manifest');
        return cached;
      });
  }

  // ---------- Утилиты эффектов ----------

  function rand(a, b) { return a + Math.random() * (b - a); }

  function triggersOf(effect) {
    var t = effect.trigger || 'tap';
    return Array.isArray(t) ? t : [t];
  }

  function later(ctx, ms, fn) {
    if (!ms) { fn(); return; }
    ctx.timers.push(setTimeout(fn, ms));
  }

  function anchorEl(ctx, name) {
    return name ? ctx.root.querySelector('[data-anchor="' + name + '"]') : ctx.anchor;
  }

  // Центр якоря в координатах слоя эффектов
  function anchorPoint(ctx, name) {
    var el = anchorEl(ctx, name) || ctx.anchor;
    var r = el.getBoundingClientRect();
    var l = ctx.layer.getBoundingClientRect();
    return {
      x: r.left - l.left + r.width / 2,
      y: r.top - l.top + r.height / 2,
      left: r.left - l.left,
      bottom: r.bottom - l.top
    };
  }

  function track(ctx, el, anim) {
    ctx.live.push(el);
    anim.onfinish = function () { untrack(ctx, el); };
  }
  function untrack(ctx, el) {
    el.remove();
    var i = ctx.live.indexOf(el);
    if (i !== -1) ctx.live.splice(i, 1);
  }

  function haptic() {
    // Браузер разрешает вибрацию только после первого касания пользователя
    var ua = navigator.userActivation;
    if (ua && !ua.hasBeenActive) return;
    // Контракт приложения, как в seasonal.js: тактильный отклик просим через канал сообщений
    global.postMessage({ type: 'VIBRATION_EVENT' }, '*');
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { /* нет вибро */ }
  }

  function setPath(obj, path, value) {
    var keys = path.split('.');
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (cur[keys[i]] == null) return;
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function withVariant(effect) {
    var vs = effect.variants;
    var e = JSON.parse(JSON.stringify(effect));
    if (!vs || !vs.length) return e;
    var total = vs.reduce(function (s, v) { return s + (v.weight || 0); }, 0);
    var r = Math.random() * total;
    for (var i = 0; i < vs.length; i++) {
      r -= vs[i].weight || 0;
      if (r < 0) {
        var ov = vs[i].override || {};
        Object.keys(ov).forEach(function (p) { setPath(e, p, ov[p]); });
        break;
      }
    }
    return e;
  }

  // ---------- Плавность: кривые, пружины, сэмплирование ----------

  var EASE = {
    inOutSine: function (t) { return -(Math.cos(Math.PI * t) - 1) / 2; },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    inQuad: function (t) { return t * t; },
    outBack: function (t) { var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    smooth: function (t) { return t * t * (3 - 2 * t); }
  };

  // Затухающая пружина: 0 → 1 с перелётом ~15 %
  function spring(t) { return 1 - Math.exp(-6 * t) * Math.cos(10 * t); }

  function bez(a, b, c, d, t) {
    var u = 1 - t;
    return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
  }

  function T(x, y, rot, sx, sy) {
    sx = sx == null ? 1 : sx;
    sy = sy == null ? sx : sy;
    return 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) rotate(' + (rot || 0).toFixed(2) +
      'deg) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';
  }

  // Траектория задаётся функцией состояния от t ∈ [0..1] и сэмплируется в плотные кадры:
  // между соседними кадрами WAAPI интерполирует линейно, поэтому движение без «углов».
  function sample(n, fn) {
    var frames = [];
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      var s = fn(t);
      frames.push({ offset: t, transform: T(s.x, s.y, s.r, s.sx, s.sy), opacity: s.o == null ? 1 : s.o });
    }
    return frames;
  }

  // Угол касательной к траектории в градусах (для наклона по движению)
  function heading(pos, t) {
    var a = pos(Math.max(0, t - 0.01)), b = pos(Math.min(1, t + 0.01));
    return Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
  }

  // ---------- Траектории стикеров ----------

  // Каждая траектория получает: W, H — размер слоя; w, h — размер стикера;
  // from — точка якоря-триггера; to — точка якоря из `at` (или тот же якорь).
  var PATHS = {
    // Ракета: взлёт по кривой из левого нижнего угла в правый верхний, нос по курсу
    fly: function (W, H, w, h) {
      var X = [-w, W * 0.18, W * 0.6, W + w], Y = [H * 0.85, H * 0.6, H * 0.3, -h * 1.2];
      var pos = function (k) { return { x: bez(X[0], X[1], X[2], X[3], k), y: bez(Y[0], Y[1], Y[2], Y[3], k) }; };
      return {
        frames: sample(60, function (t) {
          var k = 0.3 * t + 0.7 * t * t; // разгон
          var p = pos(k);
          return { x: p.x - w / 2, y: p.y - h / 2, r: heading(pos, k) + 90 + Math.sin(t * Math.PI * 8) * 1.5 };
        })
      };
    },
    // Горизонтальный пролёт с мягкой волной
    drift: function (W, H, w, h) {
      return {
        frames: sample(60, function (t) {
          var k = EASE.inOutSine(t) * 0.3 + t * 0.7;
          var wave = Math.sin(k * Math.PI * 3);
          return { x: -w + (W + 2 * w) * k, y: H * 0.26 + wave * 16, r: Math.cos(k * Math.PI * 3) * 8 };
        })
      };
    },
    // Падение, как у листа: маятник из стороны в сторону, наклон по движению
    float: function (W, H, w, h) {
      return {
        frames: sample(72, function (t) {
          var ph = t * Math.PI * 3;
          return {
            x: W * 0.38 - w / 2 + Math.sin(ph) * W * 0.22,
            y: -h + (H + 2 * h) * (0.85 * t + 0.15 * EASE.inOutSine(t)),
            r: Math.cos(ph) * 16
          };
        })
      };
    },
    // Спуск с горы: склон с кочками, разгон, корпус наклоняется по касательной
    ski: function (W, H, w, h) {
      var x0 = -w, x1 = W + w * 0.3, y0 = H * 0.1 - h, y1 = H * 0.6;
      var pos = function (k) {
        var hop = Math.max(0, Math.sin(k * Math.PI * 4 - 0.6)) * 16 * (1 - k * 0.4);
        return { x: x0 + (x1 - x0) * k, y: y0 + (y1 - y0) * (0.8 * k + 0.2 * k * k) - hop };
      };
      return {
        frames: sample(72, function (t) {
          var k = 0.55 * t + 0.45 * t * t;
          var p = pos(k);
          return { x: p.x, y: p.y, r: Math.max(-12, Math.min(32, heading(pos, k) * 0.85)) };
        })
      };
    },
    // Пешком по низу над таб-баром: ровный шаг, лёгкое подпрыгивание и «сжатие» на шаге
    walk: function (W, H, w, h) {
      var base = H - 96 - h, steps = 7;
      return {
        frames: sample(84, function (t) {
          var s = Math.sin(t * Math.PI * steps * 2);
          var lift = Math.abs(s);
          return { x: -w + (W + 2 * w) * t, y: base - lift * 5, r: s * 4, sx: 1 + (1 - lift) * 0.03, sy: 1 - (1 - lift) * 0.04 };
        })
      };
    },
    // Плывёт по «ручью» над таб-баром, качается на волнах
    sail: function (W, H, w, h) {
      var base = H - 92 - h;
      return {
        frames: sample(72, function (t) {
          var ph = t * Math.PI * 4;
          return { x: -w + (W + 2 * w) * t, y: base + Math.sin(ph) * 5, r: Math.cos(ph) * 7 };
        })
      };
    },
    // Мяч: 4 прыжка с затуханием, сжатие при касании пола, вращение
    bounce: function (W, H, w, h) {
      var floor = H * 0.64 - h, hops = 4;
      return {
        frames: sample(96, function (t) {
          var f = t * hops, i = Math.min(hops - 1, Math.floor(f)), u = f - i;
          var height = H * 0.3 * Math.pow(0.68, i);
          var y = floor - 4 * u * (1 - u) * height;
          var contact = Math.max(0, 1 - Math.min(u, 1 - u) / 0.06);
          var sy = 1 - 0.2 * contact, sx = 1 + 0.14 * contact;
          return { x: -w + (W + 2 * w) * t, y: y + h * (1 - sy) / 2, r: t * 600, sx: sx, sy: sy };
        })
      };
    },
    // Гирлянда разворачивается во всю ширину у верхнего края и мягко уходит вверх
    unroll: function (W, H, w, h) {
      return {
        easing: 'linear',
        frames: [0, 0.06, 0.12, 0.18, 0.24, 0.3, 0.86, 0.93, 1].map(function (o) {
          var open = EASE.outCubic(Math.min(1, o / 0.3));
          var leave = o > 0.86 ? EASE.inQuad((o - 0.86) / 0.14) : 0;
          return {
            offset: o,
            transform: 'translate(0px,' + (-12 * leave).toFixed(2) + 'px)',
            clipPath: 'inset(0 ' + ((1 - open) * 100).toFixed(1) + '% 0 0)',
            opacity: 1 - leave
          };
        })
      };
    },
    // Полёт по дуге от якоря-триггера к якорю `at` (монетка в копилку)
    arc: function (W, H, w, h, from, to) {
      var lift = Math.max(90, Math.abs(to.y - from.y) * 0.35);
      var cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - lift;
      return {
        frames: sample(48, function (t) {
          var k = EASE.inOutSine(t), u = 1 - k;
          var x = u * u * from.x + 2 * u * k * cx + k * k * to.x;
          var y = u * u * from.y + 2 * u * k * cy + k * k * to.y;
          return { x: x - w / 2, y: y - h / 2, r: k * 360, sx: 1 - 0.45 * k, o: t > 0.88 ? (1 - t) / 0.12 : 1 };
        })
      };
    },
    // Выпрыгивает над якорем на пружине, покачивается и уходит вниз
    pop: function (W, H, w, h, from, to) {
      var x = to.x - w / 2, y = to.y - h * 0.8;
      return {
        frames: sample(64, function (t) {
          if (t < 0.3) {
            var s = spring(t / 0.3 * 1.25);
            return { x: x, y: y + (1 - s) * h * 0.4, r: (1 - s) * -10, sx: s, sy: s };
          }
          if (t < 0.82) {
            var b = (t - 0.3) / 0.52;
            return { x: x, y: y + Math.sin(b * Math.PI * 2) * -3, r: Math.sin(b * Math.PI * 2) * 4 };
          }
          var e = EASE.inQuad((t - 0.82) / 0.18);
          return { x: x, y: y + e * 14, sx: 1 - e * 0.25, o: 1 - e };
        })
      };
    },
    // Ряд блоков над таб-баром: проявляется слева направо, мигает и «сгорает», как собранная линия
    rowclear: function (W, H, w, h) {
      var y = H - 120 - h;
      return {
        easing: 'linear',
        frames: [0, 0.25, 0.4, 0.48, 0.56, 0.64, 0.72, 0.85, 1].map(function (o) {
          var open = Math.min(1, o / 0.25);
          var blink = o > 0.4 && o < 0.72 ? (Math.floor((o - 0.4) / 0.08) % 2 ? 0.35 : 1) : 1;
          var gone = o > 0.72 ? EASE.inQuad((o - 0.72) / 0.28) : 0;
          return {
            offset: o,
            transform: 'translate(0px,' + y.toFixed(1) + 'px) scale(' + (1 + gone * 0.05).toFixed(3) + ',' + (1 - gone).toFixed(3) + ')',
            clipPath: 'inset(0 ' + ((1 - open) * 100).toFixed(1) + '% 0 0)',
            opacity: (1 - gone) * blink
          };
        })
      };
    },
    // Три прыжка через экран без вращения, с приседанием на приземлении (блочный человечек)
    hop: function (W, H, w, h) {
      var floor = H - 110 - h, hops = 3;
      return {
        frames: sample(90, function (t) {
          var f = t * hops, i = Math.min(hops - 1, Math.floor(f)), u = f - i;
          var contact = Math.max(0, 1 - Math.min(u, 1 - u) / 0.08);
          var sy = 1 - 0.15 * contact, sx = 1 + 0.1 * contact;
          return { x: -w + (W + 2 * w) * t, y: floor - 4 * u * (1 - u) * H * 0.22 + h * (1 - sy), r: (u - 0.5) * 10, sx: sx, sy: sy };
        })
      };
    },
    // Трюк на BMX: едет по низу, взлетает с трамплина и делает полный оборот
    trick: function (W, H, w, h) {
      var base = H - 100 - h;
      return {
        frames: sample(90, function (t) {
          var air = t > 0.35 && t < 0.7 ? (t - 0.35) / 0.35 : -1;
          var y = air >= 0 ? base - Math.sin(air * Math.PI) * H * 0.25 : base + Math.sin(t * 40) * 1.5;
          return { x: -w + (W + 2 * w) * t, y: y, r: air >= 0 ? -EASE.inOutSine(air) * 360 : 0 };
        })
      };
    },
    // Две картинки качаются навстречу друг другу, как ладони в меме «67»
    seesaw: function (W, H, w, h, from, to, e) {
      var side = e && e.side ? 1 : 0;
      var x = W / 2 + (side ? 0.55 : -0.55) * w - w / 2, y = H * 0.34;
      return {
        frames: sample(72, function (t) {
          var o = t < 0.1 ? EASE.smooth(t / 0.1) : t > 0.88 ? EASE.smooth((1 - t) / 0.12) : 1;
          var s = t < 0.15 ? spring(t / 0.15 * 1.2) : 1;
          var ph = t * Math.PI * 8 + side * Math.PI;
          return { x: x, y: y + Math.sin(ph) * 30, r: Math.sin(ph) * 10 * (side ? -1 : 1), sx: s, sy: s, o: o };
        })
      };
    },
    // Появляется в правом верхнем углу и покачивается (луна ночью)
    hang: function (W, H, w, h) {
      var x = W * 0.74 - w / 2, y = 58;
      return {
        frames: sample(60, function (t) {
          var o = t < 0.1 ? EASE.smooth(t / 0.1) : t > 0.85 ? EASE.smooth((1 - t) / 0.15) : 1;
          var s = t < 0.15 ? spring(t / 0.15 * 1.2) : 1;
          return { x: x, y: y + Math.sin(t * Math.PI * 4) * 4, r: Math.sin(t * Math.PI * 3) * 4, sx: s, sy: s, o: o };
        })
      };
    },
    // Reduced motion: стикер просто проявляется и гаснет
    fade: function (W, H, w, h) {
      var x = W / 2 - w / 2, y = H * 0.35;
      return {
        frames: sample(20, function (t) {
          var o = t < 0.2 ? EASE.smooth(t / 0.2) : t > 0.8 ? EASE.smooth((1 - t) / 0.2) : 1;
          return { x: x, y: y, o: o };
        })
      };
    }
  };

  // ---------- Частицы ----------

  function fxCanvas(ctx) {
    var owner = ctx.base || ctx;
    var fx = owner.fx;
    if (!fx) {
      var c = document.createElement('canvas');
      ctx.layer.appendChild(c);
      fx = owner.fx = { c: c, g: c.getContext('2d'), list: [], raf: 0 };
    }
    var dpr = Math.min(global.devicePixelRatio || 1, 2);
    var w = ctx.layer.clientWidth, h = ctx.layer.clientHeight;
    if (fx.w !== w || fx.h !== h || fx.dpr !== dpr) {
      fx.c.width = Math.round(w * dpr);
      fx.c.height = Math.round(h * dpr);
      fx.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      fx.w = w; fx.h = h; fx.dpr = dpr;
    }
    return fx;
  }

  // SVG растеризуется один раз под нужный размер: рисовать SVG в canvas каждый кадр дорого
  function bitmap(img, h, dpr) {
    var px = Math.ceil(Math.ceil(h * dpr) / 16) * 16;
    img._bmp = img._bmp || {};
    if (!img._bmp[px]) {
      var ratio = (img.naturalWidth / img.naturalHeight) || 1;
      var c = document.createElement('canvas');
      c.height = px;
      c.width = Math.ceil(px * ratio);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      img._bmp[px] = c;
    }
    return img._bmp[px];
  }

  // ---------- Стили уровней комбо: скетч → наклейка → неон ----------

  var NEON = ['#39ff88', '#3dd5ff', '#ff4fd8', '#ffe14d'];
  var GOLD = '#ffd43b';

  // Искра для золотого дождя: встроена в движок, сетевого запроса нет
  var SPARK_KEY = 'doodle:spark';
  var SPARK_SRC = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
    '<path d="M24 2 C26 16 32 22 46 24 C32 26 26 32 24 46 C22 32 16 26 2 24 C16 22 22 16 24 2 Z" fill="#ffd43b"/>' +
    '<circle cx="24" cy="24" r="5" fill="#fff9db"/></svg>');

  function neonOf(src) {
    var h = 0;
    for (var i = 0; i < src.length; i++) h = (h * 31 + src.charCodeAt(i)) | 0;
    return NEON[Math.abs(h) % NEON.length];
  }

  function canvasOf(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // Силуэт картинки одним цветом: из него собираются обводка и свечение
  function silhouette(src, color) {
    var c = canvasOf(src.width, src.height);
    var g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }

  // Силуэт, разнесённый по кругу, — толстая обводка без фильтров
  function ring(g, sil, x, y, r, steps) {
    for (var i = 0; i < steps; i++) {
      var a = i / steps * Math.PI * 2;
      g.drawImage(sil, x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
  }

  // Готовые кадры частицы в стиле уровня. Считаются один раз на картинку и размер.
  // У скетча три кадра с разным «дрожанием» линии: их смена даёт эффект живой каракули.
  function styledBitmap(img, h, dpr, style) {
    var core = bitmap(img, h, dpr);
    if (!style || style === 'plain') return { list: [core], kw: 1, kh: 1 };
    var key = style + core.height;
    img._sty = img._sty || {};
    if (img._sty[key]) return img._sty[key];
    var px = core.height;
    var glowing = style === 'neon' || style === 'gold';
    var pad = Math.ceil(px * (glowing ? 0.3 : 0.14));
    var W = core.width + pad * 2, H = core.height + pad * 2;
    var list = [];
    var frames = style === 'sketch' ? 3 : 1;
    for (var f = 0; f < frames; f++) {
      var c = canvasOf(W, H);
      var g = c.getContext('2d');
      if (style === 'sticker') {
        var outline = canvasOf(W, H);
        ring(outline.getContext('2d'), silhouette(core, '#ffffff'), pad, pad, Math.max(2, px * 0.07), 16);
        g.shadowColor = 'rgba(0, 0, 0, .4)';
        g.shadowBlur = px * 0.08;
        g.shadowOffsetY = px * 0.05;
        g.drawImage(outline, 0, 0);
        g.shadowColor = 'transparent';
        g.drawImage(core, pad, pad);
      } else if (glowing) {
        var color = style === 'gold' ? GOLD : neonOf(img.src);
        var glow = silhouette(core, color);
        g.shadowColor = color;
        g.shadowBlur = px * 0.22;
        g.drawImage(glow, pad, pad);
        g.drawImage(glow, pad, pad);
        g.shadowColor = 'transparent';
        g.drawImage(core, pad, pad);
        g.globalCompositeOperation = 'source-atop';
        g.globalAlpha = 0.28;
        g.fillStyle = color;
        g.fillRect(0, 0, W, H);
      } else {
        var amp = px * 0.035;
        var strip = Math.max(2, Math.round(px / 10));
        g.globalAlpha = 0.85;
        ring(g, silhouette(core, '#f4f1e6'), pad + rand(-amp, amp), pad + rand(-amp, amp), Math.max(1.5, px * 0.035), 8);
        g.globalAlpha = 1;
        for (var y = 0; y < core.height; y += strip) {
          var sh = Math.min(strip, core.height - y);
          g.drawImage(core, 0, y, core.width, sh, pad + rand(-amp, amp), pad + y, core.width, sh);
        }
      }
      list.push(c);
    }
    img._sty[key] = { list: list, kw: W / core.width, kh: H / core.height };
    return img._sty[key];
  }

  function runLoop(fx) {
    if (fx.raf) return;
    var last = performance.now();
    function frame(t) {
      var dt = Math.min((t - last) / 1000, 0.05);
      last = t;
      var g = fx.g;
      g.clearRect(0, 0, fx.w, fx.h);
      for (var i = fx.list.length - 1; i >= 0; i--) {
        var p = fx.list[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.age += dt;
        if (p.age >= p.life) { fx.list.splice(i, 1); continue; }
        var damp = 1 / (1 + p.drag * dt);
        p.vx *= damp;
        p.vy = p.vy * damp + p.g * dt;
        p.vr *= 1 / (1 + 0.4 * dt);
        p.x += (p.vx + Math.cos(p.age * p.swf + p.ph) * p.sway) * dt;
        p.y += p.vy * dt;
        p.r += p.vr * dt;
        var k = p.age / p.life;
        var scale = 0.35 + 0.65 * EASE.outBack(Math.min(1, k / 0.14));
        g.globalAlpha = k < 0.05 ? k / 0.05 : k > 0.62 ? 1 - EASE.smooth((k - 0.62) / 0.38) : 1;
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.r + (p.sway ? Math.sin(p.age * p.swf + p.ph) * 0.35 : 0));
        var set = p.set;
        var bmp = set.list.length > 1 ? set.list[Math.floor(p.age * 7 + p.ph) % set.list.length] : set.list[0];
        var dw = p.w * scale * set.kw, dh = p.h * scale * set.kh;
        g.drawImage(bmp, -dw / 2, -dh / 2, dw, dh);
        g.restore();
      }
      g.globalAlpha = 1;
      if (fx.list.length) {
        fx.raf = requestAnimationFrame(frame);
      } else {
        fx.raf = 0;
        g.clearRect(0, 0, fx.w, fx.h);
      }
    }
    fx.raf = requestAnimationFrame(frame);
  }

  // ---------- Рендереры ----------

  var RENDERERS = {
    combo: function (e, ctx) {
      (e.steps || []).forEach(function (s) {
        if (s.auto) return; // такие шаги уже показаны при запуске дня
        later(ctx, s.delayMs, function () { run(s, ctx); });
      });
    },

    // Аксессуар на элементе интерфейса: шапка на аватаре, глаза на карте
    skin: function (e, ctx, silent) {
      var a = anchorEl(ctx, e.anchor);
      if (!a) return;
      var el = a.querySelector('.doodle-skin[data-src="' + e.image + '"]');
      if (!el) {
        el = document.createElement('img');
        el.className = 'doodle-skin';
        el.alt = '';
        el.setAttribute('data-src', e.image);
        el.src = ctx.src(e.image);
        el.style.width = a.offsetWidth * (e.scale || 1.5) + 'px';
        el.style.marginLeft = a.offsetWidth * (e.dx || 0) + 'px';
        el.style.marginTop = a.offsetWidth * (e.dy || 0) + 'px';
        a.appendChild(el);
        ctx.skins.push(el);
      }
      if (!silent && !ctx.reduced) {
        // Аксессуар «падает» на место на пружине
        var frames = [];
        for (var i = 0; i <= 30; i++) {
          var t = i / 30, s = spring(t * 1.3);
          frames.push({
            offset: t,
            transform: 'translate(-50%,-50%) translateY(' + ((1 - s) * -18).toFixed(2) + 'px) scale(' + s.toFixed(3) + ')',
            opacity: Math.min(1, t * 6)
          });
        }
        el.animate(frames, { duration: 650, easing: 'linear' });
      }
      if (e.ttl === 'day' && !e.auto) lsSet('skin.' + ctx.item.id, ctx.dayKey);
    },

    sticker: function (e, ctx) {
      var img = ctx.img(e.image);
      if (!img) return;
      var count = e.repeat || 1;
      for (var i = 0; i < count; i++) {
        later(ctx, i * (e.staggerMs || 0), function () { spawnSticker(e, ctx, img); });
      }
    },

    particles: function (e, ctx) {
      if (ctx.reduced) return;
      var sprites = (e.sprites || []).map(ctx.img).filter(Boolean);
      if (!sprites.length) return;
      var fx = fxCanvas(ctx);
      var n = Math.min(Math.round((e.count || 30) * (ctx.mult || 1)), MAX_PARTICLES - fx.list.length);
      var origin = e.origin === 'anchor' ? anchorPoint(ctx) : e.origin === 'at' ? anchorPoint(ctx, e.at) : null;
      var ang = e.angle || [-30, 120], sp = e.speed || [200, 600], sz = e.size || [14, 30];
      var spin = e.spin == null ? 3 : e.spin;
      var life = (e.durationMs || 2400) / 1000;
      // Взрыв из точки тормозится воздухом; дождь сверху/снизу идёт волной, а не залпом
      var burst = !!origin;
      var drag = e.drag == null ? (burst ? 1.6 : 0) : e.drag;
      for (var i = 0; i < n; i++) {
        var img = sprites[i % sprites.length];
        var a = rand(ang[0], ang[1]) * Math.PI / 180;
        var s = rand(sp[0], sp[1]) * (burst ? 1.35 : 1);
        var size = rand(sz[0], sz[1]);
        var x, y;
        if (origin) { x = origin.x; y = origin.y; }
        else if (e.origin === 'bottom') { x = rand(0, fx.w); y = fx.h + size; }
        else { x = rand(0, fx.w); y = -size; }
        fx.list.push({
          set: styledBitmap(img, sz[1], fx.dpr, ctx.style), x: x, y: y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          g: e.gravity == null ? 650 : e.gravity,
          drag: drag,
          sway: e.sway || 0,
          swf: rand(1.8, 2.8),
          ph: rand(0, 6.28),
          r: spin >= 1 ? rand(0, 6.28) : rand(-0.2, 0.2) * spin,
          vr: rand(-spin, spin),
          h: size,
          w: size * ((img.naturalWidth / img.naturalHeight) || 1),
          age: 0,
          delay: burst ? rand(0, 0.06) : rand(0, life * 0.35),
          life: life * rand(0.7, 1)
        });
      }
      runLoop(fx);
    }
  };

  // Лучи-взрыв из якоря
  RENDERERS.rays = function (e, ctx) {
    if (ctx.reduced) return;
    var p = anchorPoint(ctx);
    var colors = e.colors || NEON;
    var stops = [];
    for (var i = 0; i < 12; i++) {
      var a = i * 30, col = colors[i % colors.length];
      stops.push(col + ' ' + a + 'deg ' + (a + 10) + 'deg', 'transparent ' + (a + 10) + 'deg ' + (a + 30) + 'deg');
    }
    var el = document.createElement('div');
    el.className = 'doodle-rays';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.background = 'conic-gradient(' + stops.join(', ') + ')';
    ctx.layer.appendChild(el);
    var anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1) rotate(25deg)', opacity: 0.9, offset: 0.25 },
      { transform: 'translate(-50%,-50%) scale(1.25) rotate(60deg)', opacity: 0 }
    ], { duration: e.durationMs || 1800, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'forwards' });
    track(ctx, el, anim);
  };

  // Глянцевая звезда с числом над якорем: «красивое» число в балансе. Число — сама сумма, не текст.
  RENDERERS.badge = function (e, ctx) {
    var img = ctx.img(e.image);
    if (!img) return;
    var p = anchorPoint(ctx);
    var size = e.size || 140;
    var label = (ctx.eventData && ctx.eventData.label) || '';
    var el = document.createElement('div');
    el.className = 'doodle-badge';
    el.style.width = el.style.height = size + 'px';
    el.style.left = p.x - size / 2 + 'px';
    el.style.top = p.y - size / 2 + 'px';
    var pic = document.createElement('img');
    pic.src = img.src;
    pic.alt = '';
    var num = document.createElement('span');
    num.className = 'doodle-badge-num';
    num.textContent = label;
    num.style.fontSize = Math.round(size * (label.length > 5 ? 0.15 : 0.19)) + 'px';
    el.appendChild(pic);
    el.appendChild(num);
    ctx.layer.appendChild(el);
    var frames = ctx.reduced ? PATHS.fade(0, 0, 0, 0).frames.map(function (f) {
      return { offset: f.offset, opacity: f.opacity };
    }) : sample(60, function (t) {
      if (t < 0.25) {
        var s = spring(t / 0.25 * 1.25);
        return { x: 0, y: (1 - s) * 20, r: (1 - s) * -20, sx: s, sy: s };
      }
      if (t < 0.8) {
        var b = (t - 0.25) / 0.55;
        return { x: 0, y: Math.sin(b * Math.PI * 2) * -4, r: Math.sin(b * Math.PI * 3) * 5 };
      }
      var k = EASE.inQuad((t - 0.8) / 0.2);
      return { x: 0, y: -40 * k, sx: 1 + k * 0.15, o: 1 - k };
    });
    var anim = el.animate(frames, { duration: e.durationMs || 2600, easing: 'linear', fill: 'forwards' });
    track(ctx, el, anim);
  };

  // Ночь: экран мягко темнеет поверх интерфейса и светлеет обратно. Касания проходят насквозь.
  RENDERERS.night = function (e, ctx) {
    var el = document.createElement('div');
    el.className = 'doodle-night';
    ctx.layer.appendChild(el);
    var anim = el.animate([
      { opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.82 }, { opacity: 0 }
    ], { duration: e.durationMs || 6000, easing: 'ease-in-out', fill: 'forwards' });
    track(ctx, el, anim);
  };

  function spawnSticker(e, ctx, img) {
    var W = ctx.layer.clientWidth, H = ctx.layer.clientHeight;
    var ratio = (img.naturalWidth / img.naturalHeight) || 1;
    var w, h;
    if (e.fullWidth) { w = W; h = W / ratio; }
    else { h = e.size || 72; w = h * ratio; }
    var el = document.createElement('img');
    el.className = 'doodle-sticker' + (ctx.style ? ' doodle-sticker--' + ctx.style : '');
    if (ctx.style === 'neon') el.style.setProperty('--neon', neonOf(img.src));
    if (ctx.style === 'gold') el.style.setProperty('--neon', GOLD);
    el.alt = '';
    el.src = img.src;
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    ctx.layer.appendChild(el);
    var from = anchorPoint(ctx);
    var to = e.at ? anchorPoint(ctx, e.at) : from;
    if (e.jitter) {
      from = { x: from.x + rand(-e.jitter, e.jitter), y: from.y + rand(-e.jitter, e.jitter) };
    }
    var path = (ctx.reduced ? PATHS.fade : PATHS[e.anim] || PATHS.pop)(W, H, w, h, from, to, e);
    var anim = el.animate(path.frames, {
      duration: ctx.reduced ? 1600 : e.durationMs || 2000,
      easing: path.easing || 'linear',
      fill: 'forwards'
    });
    track(ctx, el, anim);
  }

  function run(effect, ctx) {
    var r = effect && RENDERERS[effect.type];
    if (r) r(effect, ctx);
  }

  // ---------- Подсказка, факт, альбом ----------

  function showHint(ctx) {
    var hint = ctx.item.effect.hint;
    if (!hint || lsGet('seen.' + ctx.item.id) === ctx.dayKey) return;
    var el = document.createElement('span');
    el.className = 'doodle-hint';
    if (hint.image) {
      var img = document.createElement('img');
      img.src = ctx.src(hint.image);
      img.alt = '';
      el.appendChild(img);
    } else {
      el.innerHTML = HINT_SPARKLE;
    }
    ctx.anchor.appendChild(el);
    ctx.hint = el;
  }

  function hideHint(ctx) {
    lsSet('seen.' + ctx.item.id, ctx.dayKey);
    if (ctx.hint) { ctx.hint.remove(); ctx.hint = null; }
  }

  function showFact(ctx) {
    if (!ctx.item.fact) return;
    var old = ctx.layer.querySelector('.doodle-fact');
    if (old) untrack(ctx, old);
    // Плашка справа от аватара, в пустой части шапки: не закрывает баланс и карту
    var a = anchorEl(ctx, 'avatar') || ctx.anchor;
    var r = a.getBoundingClientRect();
    var l = ctx.layer.getBoundingClientRect();
    var left = r.right - l.left + 18;
    var el = document.createElement('div');
    el.className = 'doodle-fact';
    el.textContent = ctx.item.fact;
    el.style.left = left + 'px';
    el.style.top = r.top - l.top - 6 + 'px';
    el.style.maxWidth = ctx.layer.clientWidth - left - 16 + 'px';
    ctx.layer.appendChild(el);
    // Появление на пружине от «хвостика» у аватара, мягкий уход через 5,5 с
    var frames = [];
    for (var i = 0; i <= 24; i++) {
      var t = i / 24, s = spring(t * 1.2);
      frames.push({ offset: t, opacity: Math.min(1, t * 4), transform: 'translateX(' + ((1 - s) * -10).toFixed(2) + 'px) scale(' + (0.8 + 0.2 * s).toFixed(3) + ')' });
    }
    el.animate(frames, { duration: 520, easing: 'linear', fill: 'both' });
    var out = el.animate([
      { opacity: 1, transform: 'none' },
      { opacity: 0, transform: 'translateY(-6px) scale(.96)' }
    ], { duration: 320, delay: 5500, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    track(ctx, el, out);
    // Для скринридера факт дублируется в live-регион: сам слой эффектов скрыт от него
    if (ctx.live_region) ctx.live_region.textContent = ctx.item.fact;
  }

  // Сколько раз за год выпал золотой финал: только локально, для будущего альбома
  function markGold(ctx) {
    var gold = lsGet('gold') || {};
    var key = ctx.item.id + '.' + ctx.date.getFullYear();
    gold[key] = (gold[key] || 0) + 1;
    lsSet('gold', gold);
  }

  function markFound(ctx) {
    var album = lsGet('album') || {};
    var year = ctx.date.getFullYear();
    var years = album[ctx.item.id] || [];
    if (years.indexOf(year) === -1) years.push(year);
    album[ctx.item.id] = years;
    lsSet('album', album);
  }

  // ---------- Жизненный цикл ----------

  var ctx = null;
  var seq = 0;
  var suppressed = false;
  var forceGold = false;

  // ---------- Комбо: тап → 3 быстрых тапа → финальный жест ----------
  //
  // Каждая ступень показывает больше и «круче»: 1 — каракуля из тетради, 2 — наклейка, 3 — неон.
  // После первой ступени у якоря появляется шкала ●○○ и пиктограмма следующего жеста, без текста.

  var COMBO_IDLE_MS = 7000;   // без действий комбо сбрасывается на ноль
  var FINALE_MS = 3200;       // столько держится финал, потом комбо можно пройти снова

  var GESTURE_ICONS = {
    tap3: '<svg viewBox="0 0 24 24"><circle class="g-ripple" cx="10.6" cy="4.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.5"/>' +
      '<g class="g-hand" fill="currentColor"><rect x="9" y="4" width="3.2" height="11" rx="1.6"/><rect x="7.2" y="11" width="9.6" height="9.5" rx="3.2"/></g></svg>',
    pull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="g-pull" stroke-width="2.4"><path d="M12 3v12M7 10.5l5 5 5-5"/></g><path d="M5 21h14" stroke-width="2" opacity=".5"/></svg>',
    shake: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round">' +
      '<g class="g-shake"><rect x="8" y="3" width="8" height="18" rx="2.2" stroke-width="2"/><circle cx="12" cy="17.4" r=".6" stroke-width="1.6"/></g>' +
      '<path d="M4.2 8.5q-1.6 3.5 0 7M19.8 8.5q1.6 3.5 0 7" stroke-width="1.6" opacity=".7"/></svg>',
    flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<g class="g-flip"><rect x="7" y="3" width="10" height="18" rx="2.2" stroke-width="2"/><circle cx="12" cy="6.4" r=".6" stroke-width="1.6"/></g>' +
      '<path d="M3.5 10 A9 9 0 0 1 7 4.5 M20.5 14 A9 9 0 0 1 17 19.5" stroke-width="1.6"/>' +
      '<path d="M5 3.8 L7 4.5 L6.6 6.6 M19 20.2 L17 19.5 L17.4 17.4" stroke-width="1.6"/></svg>',
    trace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' +
      '<path class="g-trace" d="M2 16 L7 8 L12 16 L17 8 L22 14" stroke-width="2.2"/>' +
      '<circle cx="2.5" cy="16" r="2.2" fill="currentColor" stroke="none"/></svg>'
  };

  var TRACE_RADIUS = 30;      // px: насколько близко палец должен пройти мимо точки узора

  // Дрожащая линия скетч-стикеров: SVG-фильтр, один на страницу
  function ensureDefs() {
    if (document.getElementById('doodle-defs')) return;
    var holder = document.createElement('div');
    holder.innerHTML =
      '<svg id="doodle-defs" width="0" height="0" style="position:absolute" aria-hidden="true">' +
      '<filter id="doodle-boil" x="-10%" y="-10%" width="120%" height="120%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="1" result="n">' +
      '<animate attributeName="seed" values="1;2;3" dur="0.36s" repeatCount="indefinite" calcMode="discrete"/></feTurbulence>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter></svg>';
    document.body.appendChild(holder.firstChild);
  }

  function comboOf(eff) {
    var c = eff.combo || {};
    return {
      taps: c.taps || 3, windowMs: c.windowMs || 2500, finale: c.finale || 'shake', effect: c.effect || null,
      gold: c.goldChance == null ? 0.1 : c.goldChance, mode: c.mode || 'taps', trace: c.trace || null
    };
  }

  // Тот же контекст, но со стилем уровня и множителем частиц. Таймеры и живые элементы общие.
  function styled(c, style, mult) {
    var s = Object.create(c);
    s.base = c;
    s.style = style;
    s.mult = mult;
    return s;
  }

  // Все картинки частиц дудла: из них собираются всплески у якоря
  function particleSprites(eff) {
    var out = [];
    (eff.steps || []).forEach(function (s) {
      if (s.type === 'particles') (s.sprites || []).forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); });
    });
    return out;
  }

  function burstFrom(c, style, count) {
    var sprites = particleSprites(c.item.effect);
    if (!sprites.length) return;
    run({
      type: 'particles', sprites: sprites, count: count, origin: 'anchor',
      angle: [-170, -10], speed: [200, 460], gravity: 700, size: [12, 26], durationMs: 1500
    }, styled(c, style, 1));
  }

  // Вспышка-кольцо из якоря: финал виден на весь экран
  function flash(c, color, delay) {
    if (c.reduced) return;
    var p = anchorPoint(c);
    var el = document.createElement('div');
    el.className = 'doodle-flash';
    el.style.left = p.x + 'px';
    el.style.top = p.y + 'px';
    el.style.setProperty('--neon', color || NEON[Math.floor(Math.random() * NEON.length)]);
    c.layer.appendChild(el);
    var anim = el.animate([
      { transform: 'scale(.2)', opacity: 1 },
      { transform: 'scale(7)', opacity: 0 }
    ], { duration: 750, delay: delay || 0, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    track(c, el, anim);
  }

  // Отклик на каждый тап: якорь пружинит, из него вылетает пара частиц
  function tapFeedback(c) {
    if (!c.reduced) {
      c.anchor.animate([
        { transform: 'scale(1)' }, { transform: 'scale(.88)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }
      ], { duration: 280, easing: 'ease-out' });
    }
    burstFrom(c, c.level >= 2 ? 'sticker' : 'sketch', 4);
    haptic();
  }

  // Ребёнок сделал не тот жест: пиктограмма нужного жеста подпрыгивает
  function nudge(c) {
    var g = c.hud && c.hud.querySelector('.doodle-combo-gesture');
    if (g && !c.reduced) {
      g.animate([
        { transform: 'scale(1)' }, { transform: 'scale(1.35) rotate(-10deg)' }, { transform: 'scale(1)' }
      ], { duration: 360, easing: 'ease-out' });
    }
  }

  // Большая пиктограмма финального жеста посреди экрана: «теперь тряхни» или «теперь переверни»
  function bigHint(c, gesture) {
    if (!GESTURE_ICONS[gesture]) return;
    var el = document.createElement('div');
    el.className = 'doodle-bighint';
    el.innerHTML = GESTURE_ICONS[gesture];
    c.layer.appendChild(el);
    var anim = el.animate([
      { opacity: 0, transform: 'translate(-50%,-50%) scale(.6)' },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.15 },
      { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%,-50%) scale(1.1)' }
    ], { duration: 2800, easing: 'ease-out', fill: 'forwards' });
    track(c, el, anim);
  }

  // ---------- Обводка узора (ковёр) ----------
  //
  // На уровне 1 поверх экрана появляется картинка с узором и светящейся дорожкой.
  // Ребёнок ведёт пальцем по дорожке через все точки по порядку — это уровень 2.
  // Касания не перехватываются: слушаем touchmove и mousemove пассивно, как и всё остальное.

  function startTrace(c) {
    var t = comboOf(c.item.effect).trace;
    var img = t && c.img(t.image);
    if (!img) return;
    var W = c.layer.clientWidth, H = c.layer.clientHeight;
    var w = W * (t.width || 0.8);
    var h = w / ((img.naturalWidth / img.naturalHeight) || 1);
    // Над карточкой баланса: там нет кнопок, и ведущий палец ничего случайно не нажмёт
    var left = (W - w) / 2, top = H * 0.25 - h / 2;
    var pts = t.path.map(function (pt) { return [pt[0] * w, pt[1] * h]; });
    var d = 'M' + pts.map(function (pt) { return pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' L');
    var box = document.createElement('div');
    box.className = 'doodle-trace';
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = w + 'px';
    box.style.height = h + 'px';
    var pic = document.createElement('img');
    pic.src = img.src;
    pic.alt = '';
    box.appendChild(pic);
    box.insertAdjacentHTML('beforeend',
      '<svg viewBox="0 0 ' + w.toFixed(1) + ' ' + h.toFixed(1) + '"><path class="doodle-trace-path" d="' + d + '"/>' +
      '<path class="doodle-trace-done" d="M0 0"/><circle class="doodle-trace-dot" r="9">' +
      '<animateMotion dur="2.4s" repeatCount="indefinite" path="' + d + '"/></circle></svg>');
    c.layer.appendChild(box);
    box.animate([
      { opacity: 0, transform: 'scale(.6) rotate(-6deg)' },
      { opacity: 1, transform: 'scale(1.04) rotate(1deg)', offset: 0.7 },
      { opacity: 1, transform: 'none' }
    ], { duration: 520, easing: 'ease-out' });
    c.trace = { box: box, pts: pts, next: 0, left: left, top: top, done: box.querySelector('.doodle-trace-done') };
  }

  function endTrace(c) {
    if (!c || !c.trace) return;
    var box = c.trace.box;
    c.trace = null;
    var out = box.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.1)' }], { duration: 300, fill: 'forwards' });
    out.onfinish = function () { box.remove(); };
  }

  function traceMove(clientX, clientY) {
    var c = ctx;
    if (!c || !c.trace || suppressed) return;
    var tr = c.trace;
    var l = c.layer.getBoundingClientRect();
    var p = tr.pts[tr.next];
    if (Math.hypot(clientX - l.left - tr.left - p[0], clientY - l.top - tr.top - p[1]) > TRACE_RADIUS) return;
    tr.next++;
    c.lastAction = Date.now();
    tr.done.setAttribute('d', 'M' + tr.pts.slice(0, tr.next).map(function (pt) { return pt[0].toFixed(1) + ' ' + pt[1].toFixed(1); }).join(' L'));
    if (tr.next % 2) haptic();
    if (tr.next >= tr.pts.length) {
      endTrace(c);
      playLevel(c, 2);
    } else {
      updateHud(c);
    }
  }

  var mouseIsDown = false;
  document.addEventListener('touchstart', function (e) { if (e.touches[0]) traceMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchmove', function (e) { if (e.touches[0]) traceMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('mousedown', function (e) { mouseIsDown = true; traceMove(e.clientX, e.clientY); }, { capture: true, passive: true });
  document.addEventListener('mouseup', function () { mouseIsDown = false; }, { capture: true, passive: true });
  document.addEventListener('mousemove', function (e) { if (mouseIsDown) traceMove(e.clientX, e.clientY); }, { passive: true });

  // ---------- Стикер дня поверх экрана («обыденные» дудлы) ----------
  //
  // Один день стикер выглядывает из-за края элемента, другой — проплывает по экрану.
  // Это единственное, что ловит касание в дудле, поэтому стикер маленький и стоит у краёв.

  function createBuddy(c) {
    var b = c.item.effect.buddy;
    var img = c.img(b.image);
    if (!img) return null;
    var size = b.size || 44;
    var ratio = (img.naturalWidth / img.naturalHeight) || 1;
    var width = Math.round(size * ratio);
    var day = dayNumber(c.date);
    var mode = b.mode || (day % 2 ? 'float' : 'peek');
    var el = document.createElement('button');
    el.type = 'button';
    el.className = 'doodle-buddy';
    el.setAttribute('aria-label', 'Дудл дня');
    el.style.width = width + 'px';
    el.style.height = size + 'px';
    var pic = document.createElement('img');
    pic.className = 'doodle-buddy-img';
    pic.src = img.src;
    pic.alt = '';
    el.appendChild(pic);
    var wearImg = b.wear && c.img(b.wear);
    if (wearImg) {
      var wear = document.createElement('img');
      var ws = size * (b.wearScale || 1.2);
      wear.className = 'doodle-buddy-wear';
      wear.src = wearImg.src;
      wear.alt = '';
      wear.style.width = ws + 'px';
      wear.style.left = (width - ws) / 2 + 'px';
      wear.style.top = size * b.wearTop + 'px';
      el.appendChild(wear);
    }
    var holder = el;
    if (mode === 'peek') {
      var hosts = Array.prototype.filter.call(c.root.querySelectorAll('[data-snow]'), function (host) {
        return host.getClientRects().length && window.getComputedStyle(host).overflow !== 'hidden';
      });
      if (hosts.length) {
        var target = hosts[day % hosts.length];
        if (window.getComputedStyle(target).position === 'static') target.style.position = 'relative';
        holder = document.createElement('span');
        holder.className = 'doodle-peek';
        holder.style.width = width + 'px';
        holder.style.height = Math.round(size * 1.7) + 'px';
        holder.style.left = 14 + (day * 37) % Math.max(1, target.offsetWidth - width - 28) + 'px';
        holder.appendChild(el);
        target.appendChild(holder);
      } else {
        mode = 'float';
      }
    }
    if (mode === 'float') {
      el.classList.add('doodle-buddy--float');
      el.style.top = 24 + (day * 13) % 40 + '%';
      c.root.appendChild(el);
    }
    c.buddyHolder = holder;
    c.buddyMode = mode;
    return el;
  }

  // После первого тапа стикер перестаёт прятаться и уплывать: дальше комбо
  function parkBuddy(c) {
    if (!c.buddyMode || c.buddyParked) return;
    c.buddyParked = true;
    if (c.buddyMode === 'peek') {
      c.buddyHolder.classList.add('is-out');
    } else {
      var r = c.anchor.getBoundingClientRect();
      var root = c.root.getBoundingClientRect();
      c.anchor.style.left = Math.max(8, Math.min(root.width - r.width - 8, r.left - root.left)) + 'px';
      c.anchor.style.top = r.top - root.top + 'px';
      c.anchor.classList.add('is-parked');
    }
  }

  function updateHud(c) {
    var combo = comboOf(c.item.effect);
    if (!c.hud) {
      var hud = document.createElement('span');
      hud.className = 'doodle-combo';
      hud.innerHTML = '<span class="doodle-combo-dots"><i></i><i></i><i></i></span><span class="doodle-combo-gesture"></span>';
      // Шкала встаёт с той стороны якоря, где есть место
      var r = c.anchor.getBoundingClientRect(), l = c.layer.getBoundingClientRect();
      if (r.right + 100 > l.right) hud.classList.add('doodle-combo--left');
      c.anchor.appendChild(hud);
      c.hud = hud;
    }
    var dots = c.hud.querySelectorAll('.doodle-combo-dots i');
    for (var i = 0; i < dots.length; i++) {
      dots[i].classList.toggle('is-on', i < c.level);
      var progress = combo.mode === 'trace' ? (c.trace ? c.trace.next / c.trace.pts.length : 0) : c.taps.length / combo.taps;
      dots[i].style.setProperty('--p', i === c.level && c.level === 1 ? String(progress) : '0');
    }
    var next = c.level === 1 ? (combo.mode === 'trace' ? 'trace' : 'tap3') : c.level === 2 ? combo.finale : '';
    var gesture = c.hud.querySelector('.doodle-combo-gesture');
    if (gesture.getAttribute('data-gesture') !== next) {
      gesture.setAttribute('data-gesture', next);
      gesture.innerHTML = GESTURE_ICONS[next] || '';
    }
    c.hud.classList.toggle('is-done', c.level >= 3);
    c.hud.classList.toggle('is-gold', c.level >= 3 && !!c.gold);
  }

  function resetCombo(c) {
    c.level = 0;
    c.gold = false;
    endTrace(c);
    c.taps = [];
    if (c.hud) { c.hud.remove(); c.hud = null; }
  }

  function playLevel(c, level) {
    var eff = c.item.effect;
    c.level = level;
    haptic();
    if (level === 1) {
      hideHint(c);
      parkBuddy(c);
      run(withVariant(eff), styled(c, 'sketch', 1));
      if (comboOf(eff).mode === 'trace') startTrace(c);
      if (c.facts) showFact(c);
      markFound(c);
    } else if (level === 2) {
      run(withVariant(eff), styled(c, 'sticker', 1.4));
      burstFrom(c, 'sticker', 12);
      later(c, 1100, function () { bigHint(c, comboOf(eff).finale); });
    } else {
      // Редкий золотой финал: тот же финал, но золотом и с дождём искр. Наград с ценностью нет.
      var combo = comboOf(eff);
      var gold = forceGold || Math.random() < combo.gold;
      var style = gold ? 'gold' : 'neon';
      c.gold = gold;
      flash(c, gold ? GOLD : null);
      if (gold) flash(c, '#fff3bf', 180);
      if (combo.effect) run(combo.effect, styled(c, style, 1));
      burstFrom(c, style, 22);
      later(c, 250, function () { burstFrom(c, style, 14); });
      if (gold) {
        run({
          type: 'particles', sprites: [SPARK_KEY], count: 30, origin: 'top', angle: [75, 105],
          speed: [140, 300], gravity: 260, sway: 30, spin: 2, size: [14, 28], durationMs: 3000, delayMs: 150
        }, styled(c, 'gold', 1));
        markGold(c);
      }
      later(c, FINALE_MS, function () { resetCombo(c); });
    }
    updateHud(c);
  }

  /** Жест ребёнка: 'tap' по якорю, 'pull' или 'shake' от приложения. true — дудл откликнулся. */
  function fire(kind) {
    if (suppressed || !ctx) return false;
    var c = ctx;
    var eff = c.item.effect;
    var combo = comboOf(eff);
    var accepts = triggersOf(eff).indexOf(kind) !== -1;
    var now = Date.now();
    if (c.level && c.level < 3 && now - c.lastAction > COMBO_IDLE_MS) resetCombo(c);

    if (c.level === 0) {
      if (!accepts) return false;
      c.lastAction = now;
      playLevel(c, 1);
      return true;
    }
    if (c.level === 1) {
      if (kind !== 'tap') {
        if (!accepts && kind !== combo.finale) return false;
        c.lastAction = now;
        nudge(c);
        return true;
      }
      c.lastAction = now;
      // В обводке тапы не считаются: подсказываем, что нужно вести пальцем
      if (combo.mode === 'trace') {
        nudge(c);
        return true;
      }
      c.taps = c.taps.filter(function (t) { return now - t < combo.windowMs; });
      c.taps.push(now);
      tapFeedback(c);
      if (c.taps.length >= combo.taps) {
        c.taps = [];
        playLevel(c, 2);
      } else {
        updateHud(c);
      }
      return true;
    }
    if (c.level === 2) {
      if (kind === combo.finale) {
        c.lastAction = now;
        playLevel(c, 3);
        return true;
      }
      if (kind !== 'tap') return false;
      c.lastAction = now;
      tapFeedback(c);
      nudge(c);
      return true;
    }
    // Финал ещё идёт: жесты съедаем, чтобы не запустить праздничный слой поверх
    return kind === 'tap' || kind === combo.finale;
  }

  function onTap() { fire('tap'); }

  function stepsOf(effect, type) {
    var list = effect.type === type ? [effect] : [];
    (effect.steps || []).forEach(function (s) { if (s.type === type) list.push(s); });
    return list;
  }

  function arm(c) {
    var eff = c.item.effect;
    if (eff.anchor === 'buddy') {
      c.anchor = eff.buddy ? createBuddy(c) : null;
      if (!c.anchor) return false;
      ctx = c;
      c.anchor.addEventListener('click', onTap);
      c.cleanups.push(function () { c.buddyHolder.remove(); });
      if (suppressed) c.buddyHolder.style.visibility = 'hidden';
      return true;
    }
    c.anchor = c.root.querySelector('[data-anchor="' + (eff.anchor || 'avatar') + '"]');
    if (!c.anchor) return false;
    ctx = c;
    var skinDay = lsGet('skin.' + c.item.id) === c.dayKey;
    stepsOf(eff, 'skin').forEach(function (s) {
      if (s.auto) RENDERERS.skin(s, c, false);
      else if (skinDay && s.ttl === 'day') RENDERERS.skin(s, c, true);
    });
    showHint(c);
    if (triggersOf(eff).indexOf('tap') !== -1) {
      c.anchor.addEventListener('click', onTap);
      c.cleanups.push(function () { c.anchor.removeEventListener('click', onTap); });
    }
    return true;
  }

  function stopAll(c) {
    if (!c) return;
    c.timers.forEach(clearTimeout);
    c.timers = [];
    c.live.slice().forEach(function (el) { untrack(c, el); });
    if (c.fx) {
      cancelAnimationFrame(c.fx.raf);
      c.fx.raf = 0;
      c.fx.list = [];
      c.fx.g.clearRect(0, 0, c.fx.w, c.fx.h);
    }
    resetCombo(c);
  }

  // ---------- События приложения ----------
  //
  // Не зависят от даты: работают каждый день. Приложение сообщает о событии через Doodles.event(),
  // манифест решает, отвечать ли на него и как (раздел events).

  var ectx = null;

  function isSequence(s) {
    var step = Number(s[1]) - Number(s[0]);
    if (Math.abs(step) !== 1) return false;
    for (var i = 2; i < s.length; i++) if (Number(s[i]) - Number(s[i - 1]) !== step) return false;
    return true;
  }

  // «Красивое» число: 777, 5 555 · 1 000, 35 000 · 1 234, 9 876 · 12 321
  function nicePattern(value, patterns) {
    var n = Math.floor(Math.abs(Number(value)));
    if (!isFinite(n) || n < 10) return null;
    var str = String(n);
    var checks = {
      repdigit: /^(\d)\1{2,}$/.test(str),
      round: n >= 1000 && n % 1000 === 0,
      sequence: str.length >= 3 && isSequence(str),
      mirror: str.length >= 4 && str === str.split('').reverse().join('') && !/^(\d)\1+$/.test(str),
      sixseven: str.indexOf('67') !== -1
    };
    for (var i = 0; i < patterns.length; i++) if (checks[patterns[i]]) return patterns[i];
    return null;
  }

  function armEvents(manifest, manifestUrl, opts, reduced, token) {
    if (manifest.enabled === false) return Promise.resolve(null);
    var defs = (manifest.events || []).filter(function (d) {
      return d && d.enabled !== false && d.on && d.effect && RENDERERS[d.effect.type];
    });
    if (!defs.length) return Promise.resolve(null);
    var imgs = {};
    var loads = [];
    defs.forEach(function (d) {
      var base = new URL(d.pack || 'packs/events/', manifestUrl);
      d._url = function (name) { return new URL(name, base).href; };
      d._img = function (name) { return imgs[d._url(name)]; };
      Object.keys(collectAssets(d.effect, {})).forEach(function (n) {
        loads.push(loadAsset(d._url(n)).then(function (img) { imgs[d._url(n)] = img; }, function () {
          // Нет картинки — этот шаг просто пропустится
        }));
      });
    });
    return Promise.all(loads).then(function () {
      if (token !== seq) return null;
      ectx = {
        root: opts.root, layer: opts.layer, reduced: reduced, defs: defs, item: { id: 'events', effect: {} },
        timers: [], live: [], cleanups: [], skins: [], taps: [], level: 0, fx: null, anchor: null
      };
      return ectx;
    });
  }

  /** Событие приложения: 'balance' { value }, 'topup' { amount }, 'flip'. true — что-то показали. */
  function fireEvent(name, data) {
    if (suppressed || !ectx) return false;
    var now = Date.now();
    var fired = false;
    ectx.defs.forEach(function (d) {
      if (d.on !== name || now - (d._last || 0) < (d.cooldownMs || 0)) return;
      var info = { label: '', pattern: null };
      if (name === 'clock') {
        var m = d.match || {};
        if ((m.day != null && (!data || data.day !== m.day)) || (m.hour != null && (!data || data.hour !== m.hour))) return;
      }
      if (name === 'balance') {
        info.pattern = nicePattern(data && data.value, d.patterns || ['repdigit', 'round', 'sequence', 'mirror']);
        if (!info.pattern) return;
        info.label = Math.floor(data.value).toLocaleString('ru-RU');
      } else if (data && data.amount) {
        info.label = '+' + Math.floor(data.amount).toLocaleString('ru-RU');
      }
      var anchor = anchorEl(ectx, d.anchor || 'avatar');
      if (!anchor) return;
      d._last = now;
      var c = styled(ectx, d.style || 'sticker', 1);
      c.anchor = anchor;
      c.url = d._url;
      c.img = d._img;
      c.src = function (n) { return (d._img(n) || {}).src || d._url(n); };
      c.eventData = info;
      run(d.effect, c);
      fired = true;
    });
    if (fired) haptic();
    return fired;
  }

  function destroyEvents() {
    if (!ectx) return;
    stopAll(ectx);
    if (ectx.fx) ectx.fx.c.remove();
    ectx = null;
  }

  function destroy() {
    seq++;
    destroyEvents();
    if (!ctx) return;
    stopAll(ctx);
    ctx.cleanups.forEach(function (fn) { fn(); });
    if (ctx.hint) ctx.hint.remove();
    ctx.skins.forEach(function (el) { el.remove(); });
    if (ctx.fx) ctx.fx.c.remove();
    ctx = null;
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stopAll(ctx);
      stopAll(ectx);
    }
  });

  function init(opts) {
    destroy();
    var token = seq;
    var manifestUrl = new URL(opts.manifestUrl, location.href);
    var reduced = !!opts.reducedMotion ||
      (global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches);

    return loadManifest(manifestUrl.href)
      .then(function (manifest) {
        armEvents(manifest, manifestUrl, opts, reduced, token);
        var item = pick(manifest, opts.date);
        if (!item) return null;
        if (item.pool) item = dressForSeason(item, manifest, manifestUrl, opts.date);
        var base = new URL(item.pack || 'packs/' + item.id + '/', manifestUrl);
        var url = function (name) { return new URL(name, base).href; };
        var imgs = {};
        var names = Object.keys(collectAssets(item.effect, {}));
        var loads = names.map(function (n) {
          return loadAsset(url(n)).then(function (img) { imgs[url(n)] = img; });
        });
        loads.push(loadImage(SPARK_SRC).then(function (img) { imgs[SPARK_KEY] = img; }));
        return Promise.all(loads).then(function () {
          if (token !== seq) return null;
          var c = {
            item: item, root: opts.root, layer: opts.layer, live_region: opts.liveRegion || null,
            date: opts.date, dayKey: ymd(opts.date), reduced: reduced, facts: !!opts.facts,
            url: url, img: function (n) { return imgs[url(n)]; },
            src: function (n) { return (imgs[url(n)] || {}).src || url(n); },
            timers: [], live: [], cleanups: [], skins: [], taps: [],
            level: 0, lastAction: 0, hud: null,
            fx: null, hint: null, anchor: null
          };
          ensureDefs();
          return arm(c) ? item : null;
        });
      })
      .catch(function () {
        // Нет манифеста или пака — просто не показываем дудл.
        return null;
      });
  }

  global.Doodles = {
    init: init,
    destroy: destroy,
    // Внешние триггеры от приложения: 'pull' (потянули список), 'shake' (тряхнули телефон).
    // Возвращает true, если дудл откликнулся.
    trigger: function (kind) { return fire(kind); },
    // Критичный экран (оплата, перевод, реквизиты, лимиты): сцена гаснет, триггеры не работают
    setSuppressed: function (value) {
      suppressed = !!value;
      if (suppressed) {
        stopAll(ctx);
        stopAll(ectx);
      }
      if (ctx && ctx.buddyHolder) ctx.buddyHolder.style.visibility = suppressed ? 'hidden' : '';
    },
    // События приложения: 'balance' { value }, 'topup' { amount }, 'flip' (перевернули экраном вниз и обратно)
    event: fireEvent,
    // Ребёнок сейчас проходит комбо: тряску и жесты отдаём дудлу, а не праздничному слою
    inCombo: function () { return !!ctx && ctx.level > 0; },
    reset: function () { destroy(); lsClear(); },
    // Отладка: золотой финал каждый раз, а не с шансом из манифеста
    setGold: function (value) { forceGold = !!value; },
    // День рождения из профиля (только локально). Для демо: 'YYYY-MM-DD' или null
    setBirthday: function (value) {
      var p = lsGet('profile') || {};
      p.birthday = value || null;
      lsSet('profile', p);
    },
    ymd: ymd,
    collectAssets: collectAssets,
    _pick: pick
  };
})(window);
