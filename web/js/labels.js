/* Человекочитаемые подписи для записей манифеста (отладка и галерея). */
(function (global) {
  'use strict';

  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var WEEKDAYS = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  var SEASONS = { winter: 'Зима', spring: 'Весна', summer: 'Лето', autumn: 'Осень', special: 'Особые дни', everyday: 'Каждый день' };
  // Дудл запускается с язычка у края шапки: аватар и карта отданы приложению (профиль, карта).
  // Стикер по экрану — только если в манифесте явно задан старый режим buddy.mode: peek или float.
  function tapLabel(effect) {
    var mode = effect.buddy && effect.buddy.mode;
    return mode && mode !== 'tab' ? 'Тап по стикеру дня' : 'Тап по язычку справа';
  }

  function mdLabel(md) {
    var p = md.split('-');
    return +p[1] + ' ' + MONTHS[+p[0] - 1];
  }

  function when(w) {
    switch (w && w.type) {
      case 'fixed': return mdLabel(w.md);
      case 'range': return mdLabel(w.from) + ' — ' + mdLabel(w.to);
      case 'nth_weekday':
        return (w.n > 0 ? w.n + '-й ' : 'последний ') + WEEKDAYS[w.weekday - 1] + ' ' + MONTHS[w.month - 1];
      case 'dates': return 'по списку дат';
      case 'birthday': return 'в день рождения';
      default: return '—';
    }
  }

  function triggers(effect) {
    var t = effect.trigger || 'tap';
    return (Array.isArray(t) ? t : [t]).map(function (k) {
      if (k === 'tap') return tapLabel(effect);
      if (k === 'pull') return 'Потянуть список';
      if (k === 'shake') return 'Тряхнуть телефон';
      return k;
    });
  }

  // Лестница комбо: тап → быстрые тапы → финальный жест
  var FINALES = { pull: 'Потянуть список', shake: 'Тряхнуть телефон', flip: 'Перевернуть экраном вниз' };

  function combo(effect) {
    var c = effect.combo || {};
    return [
      tapLabel(effect),
      c.mode === 'trace' ? 'Провести пальцем по узору' : (c.taps || 3) + ' быстрых тапа',
      FINALES[c.finale] || FINALES.shake
    ];
  }

  // Дата, на которую дудл точно сработает: для показа в прототипе
  function demoDate(w, year) {
    if (!w) return null;
    if (w.type === 'fixed') return year + '-' + w.md;
    if (w.type === 'range') {
      // Второй день диапазона: первый часто занят праздником (1 июня, 1 сентября)
      var p = w.from.split('-');
      var d = new Date(year, +p[0] - 1, +p[1] + 1);
      return year + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    }
    if (w.type === 'dates' && w.list && w.list.length) return w.list[0];
    // День рождения берётся из профиля, для демо ставим его на свободную дату
    if (w.type === 'birthday') return year + '-11-15';
    return null;
  }

  global.DoodleLabels = {
    when: when,
    triggers: triggers,
    combo: combo,
    season: function (s) { return SEASONS[s] || ''; },
    demoDate: demoDate
  };
})(window);
