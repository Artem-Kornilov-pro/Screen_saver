/*
 * Макет приложения: переключение экранов, тосты и отладочная панель.
 * Праздничный слой живёт отдельно в seasonal.js, отсюда ему только сообщают, на каком мы экране.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var mainScreen = document.getElementById('screen-main');
  var transferScreen = document.getElementById('screen-transfer');
  var toast = document.getElementById('toast');
  var toastTimer = 0;

  var debugToggle = document.getElementById('debug-toggle');
  var debugPanel = document.getElementById('debug-panel');
  var debugOverride = document.getElementById('debug-override');
  var debugDate = document.getElementById('debug-date');
  var debugTilt = document.getElementById('debug-tilt');
  var debugStatus = document.getElementById('debug-status');

  function showToast(text) {
    toast.textContent = text;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.hidden = true; }, 2000);
  }

  function openScreen(name) {
    var isTransfer = name === 'transfer';
    transferScreen.hidden = !isTransfer;
    mainScreen.hidden = isTransfer;
    Seasonal.setSuppressed(isTransfer);
  }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-open], [data-back], [data-toast]');
    if (!target) return;
    if (target.hasAttribute('data-open')) openScreen(target.getAttribute('data-open'));
    else if (target.hasAttribute('data-back')) openScreen('main');
    else showToast(target.getAttribute('data-toast'));
  });

  // ---------- Отладка ----------

  // ?date=2026-12-31 в адресе сразу подменяет дату: удобно открыть демо по ссылке.
  function parseDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12) : null;
  }

  var urlDate = parseDate(new URLSearchParams(window.location.search).get('date'));
  debugDate.value = urlDate ? urlDate.toISOString().slice(0, 10) : new Date().getFullYear() + '-12-31';
  debugOverride.checked = !!urlDate;

  function applyDateOverride() {
    Seasonal.setDateOverride(debugOverride.checked ? parseDate(debugDate.value) : null);
  }

  function describe(result) {
    debugStatus.textContent = result.effect ? 'Показываем: ' + result.effect.title : result.reason;
  }

  function setDebugOpen(open) {
    debugPanel.hidden = !open;
    debugToggle.setAttribute('aria-expanded', String(open));
  }

  debugToggle.addEventListener('click', function () {
    setDebugOpen(debugPanel.hidden);
  });
  debugOverride.addEventListener('change', applyDateOverride);
  debugDate.addEventListener('change', applyDateOverride);
  debugTilt.addEventListener('input', function () { Seasonal.setManualTilt(debugTilt.value); });
  document.getElementById('debug-show').addEventListener('click', function () {
    applyDateOverride();
    describe(Seasonal.trigger('shake'));
  });
  document.getElementById('debug-reset').addEventListener('click', function () {
    Seasonal.resetDailyLimit();
    debugStatus.textContent = 'Лимит сброшен: при следующем входе эффект покажется снова';
  });

  Seasonal.init({
    host: app,
    canvas: document.getElementById('seasonal-layer'),
    dateOverride: urlDate,
    onChange: function (effect) {
      if (effect) debugStatus.textContent = 'Показываем: ' + effect.title;
    }
  }).then(function (result) {
    if (!result || result.effect) return;
    // На сегодня праздника нет: сразу подсказываем, как посмотреть эффект.
    debugOverride.checked = true;
    applyDateOverride();
    setDebugOpen(true);
    debugStatus.textContent = 'При входе: ' + result.reason.toLowerCase() + '. Дата уже подменена, нажмите «Показать».';
  });
})();
