/*
 * QR-детектор от приложения. В Android WebView встроенного BarcodeDetector может не быть
 * (или он есть, но без qr_code — зависит от сервисов на телефоне). Поэтому в приложении
 * кадр из рамки распознаёт Kotlin (NativeBridge.decodeQr, ZXing), а qr.js работает как обычно.
 * В браузере без NativeBridge файл ничего не делает: остаётся встроенный BarcodeDetector.
 */
(function () {
  'use strict';
  var native = window.NativeBridge;
  if (!native || typeof native.decodeQr !== 'function') return;

  function NativeBarcodeDetector() {}
  NativeBarcodeDetector.getSupportedFormats = function () { return Promise.resolve(['qr_code']); };
  // canvas — квадрат 480×480 с кадром из рамки (его вырезает qr.js)
  NativeBarcodeDetector.prototype.detect = function (canvas) {
    var data = canvas.toDataURL('image/jpeg', 0.85);
    var value = native.decodeQr(data.slice(data.indexOf(',') + 1));
    return Promise.resolve(value ? [{ rawValue: String(value), format: 'qr_code' }] : []);
  };
  window.BarcodeDetector = NativeBarcodeDetector;
})();
