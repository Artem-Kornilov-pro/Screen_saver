/* Галерея дудлов: строится из manifest.json, как и сам прототип. */
(function () {
  'use strict';

  var MANIFEST = 'effects/doodles/manifest.json';
  var ORDER = ['everyday', 'special', 'winter', 'spring', 'summer', 'autumn'];
  var COLORS = { everyday: 'var(--everyday)', special: 'var(--special)', winter: 'var(--winter)', spring: 'var(--spring)', summer: 'var(--summer)', autumn: 'var(--autumn)' };
  var ROLES = { skin: 'аксессуар', sticker: 'стикер', particles: 'частица', secret: 'финал', hint: 'подсказка', buddy: 'стикер дня' };

  var manifestUrl = new URL(MANIFEST, location.href);

  // Все картинки дудла с ролью, в которой они впервые встречаются
  function assetsWithRoles(effect) {
    var seen = {}, list = [];
    function add(name, role) {
      if (!name || seen[name]) return;
      seen[name] = true;
      list.push({ name: name, role: role });
    }
    function walk(e, secret) {
      if (!e) return;
      if (e.type === 'combo') (e.steps || []).forEach(function (s) { walk(s, secret); });
      if (e.type === 'skin') add(e.image, secret ? 'secret' : 'skin');
      if (e.type === 'sticker') add(e.image, secret ? 'secret' : 'sticker');
      if (e.type === 'particles') (e.sprites || []).forEach(function (s) { add(s, secret ? 'secret' : 'particles'); });
    }
    if (effect.buddy) add(effect.buddy.image, 'buddy');
    walk(effect, false);
    if (effect.combo) walk(effect.combo.effect, true);
    if (effect.hint && effect.hint.image) add(effect.hint.image, 'hint');
    return list;
  }

  function heroOf(effect) {
    var best = null;
    (effect.steps || []).forEach(function (s) {
      if (s.type === 'sticker' && (!best || (s.size || 0) > (best.size || 0) || s.fullWidth)) best = s;
    });
    if (best) return best.image;
    var p = (effect.steps || []).filter(function (s) { return s.type === 'particles'; })[0];
    return p ? p.sprites[0] : null;
  }

  function avatarSkin(effect) {
    return (effect.steps || []).filter(function (s) {
      return s.type === 'skin' && (s.anchor || effect.anchor || 'avatar') === 'avatar';
    })[0] || null;
  }

  function packSize(base, names) {
    return Promise.all(names.map(function (n) {
      return fetch(new URL(n, base).href).then(function (r) { return r.blob(); }).then(function (b) { return b.size; });
    })).then(function (sizes) { return sizes.reduce(function (a, b) { return a + b; }, 0); });
  }

  // Дудл из пула: первый день года, когда он выпадает дудлом дня
  var manifestCache = null;
  function poolDate(it, year) {
    if (!manifestCache || !window.Doodles) return null;
    for (var d = new Date(year, 0, 1, 12); d.getFullYear() === year; d.setDate(d.getDate() + 1)) {
      var picked = Doodles._pick(manifestCache, d);
      if (picked && picked.id === it.id) return Doodles.ymd(d);
    }
    return null;
  }

  function kb(bytes) { return (bytes / 1024).toFixed(1).replace('.', ',') + ' КБ'; }

  function buildCard(it, tpl, year) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    var base = new URL(it.pack || 'packs/' + it.id + '/', manifestUrl);
    var url = function (n) { return new URL(n, base).href; };
    var eff = it.effect;
    node.style.setProperty('--accent', COLORS[it.season] || 'var(--green)');

    var skin = avatarSkin(eff);
    if (skin) {
      var s = document.createElement('img');
      s.className = 'skin';
      s.alt = '';
      s.src = url(skin.image);
      s.style.width = 64 * (skin.scale || 1.5) + 'px';
      s.style.marginTop = 64 * (skin.dy || 0) + 'px';
      node.querySelector('.stage-avatar').appendChild(s);
    }
    var hero = heroOf(eff);
    var heroImg = node.querySelector('.stage-hero');
    if (hero) heroImg.src = url(hero); else heroImg.remove();

    node.querySelector('.chip--date').textContent = it.pool ? 'дудл дня по очереди' : DoodleLabels.when(it.when);
    node.querySelector('.chip--prio').textContent = 'приоритет ' + (it.priority || 0);
    node.querySelector('.title').textContent = it.title || it.id;
    var tl = node.querySelector('.triggers');
    DoodleLabels.combo(eff).forEach(function (t, i) {
      var li = document.createElement('li');
      li.textContent = (i + 1) + ' · ' + t;
      tl.appendChild(li);
    });
    // В приложении дудлы пока без текстов, поэтому и в галерее факт не показываем
    node.querySelector('.fact').remove();

    var assets = assetsWithRoles(eff);
    var box = node.querySelector('.assets');
    assets.forEach(function (a) {
      var tile = document.createElement('div');
      tile.className = 'asset';
      var img = document.createElement('img');
      img.src = url(a.name);
      img.alt = a.name;
      img.loading = 'lazy';
      var cap = document.createElement('span');
      cap.textContent = ROLES[a.role];
      tile.appendChild(img);
      tile.appendChild(cap);
      box.appendChild(tile);
    });

    var meta = node.querySelector('.meta');
    meta.textContent = 'Стиль растёт с комбо: каракуля → наклейка → неон.';
    packSize(base, assets.map(function (a) { return a.name; })).then(function (bytes) {
      meta.textContent = 'Пак ' + kb(bytes) + '. ' + meta.textContent;
      it._bytes = bytes;
    });

    var d = it.pool ? poolDate(it, year) : DoodleLabels.demoDate(it.when, year);
    var run = node.querySelector('.run');
    if (d) run.href = 'index.html?date=' + d + (it.when && it.when.type === 'birthday' ? '&birthday=' + d : ''); else run.remove();
    return node;
  }

  fetch(manifestUrl.href, { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (m) {
      manifestCache = m;
      var tpl = document.getElementById('card-tpl');
      var root = document.getElementById('seasons');
      var year = new Date().getFullYear();
      var items = m.items.filter(function (it) { return it.enabled !== false; });

      ORDER.forEach(function (season) {
        var list = items.filter(function (it) { return it.season === season; });
        if (!list.length) return;
        var sec = document.createElement('section');
        sec.className = 'season';
        sec.innerHTML = '<div class="season-head"><i class="season-dot"></i><h2></h2><span></span></div><div class="grid"></div>';
        sec.querySelector('.season-dot').style.background = COLORS[season];
        sec.querySelector('h2').textContent = DoodleLabels.season(season);
        sec.querySelector('span').textContent = list.length + ' ' + (list.length === 1 ? 'дудл' : list.length < 5 ? 'дудла' : 'дудлов');
        var grid = sec.querySelector('.grid');
        list.forEach(function (it) { grid.appendChild(buildCard(it, tpl, year)); });
        root.appendChild(sec);
      });

      var stats = document.getElementById('stats');
      var assetsCount = items.reduce(function (n, it) { return n + assetsWithRoles(it.effect).length; }, 0);
      [['Дудлов', items.length], ['Сезонов', 4], ['Картинок', assetsCount], ['Бюджет', '≤ 6 МБ']].forEach(function (p) {
        var d = document.createElement('div');
        d.innerHTML = '<dt></dt><dd></dd>';
        d.firstChild.textContent = p[0];
        d.lastChild.textContent = p[1];
        stats.appendChild(d);
      });
    });
})();
