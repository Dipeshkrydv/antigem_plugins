/**
 * Anti-Detection & Human Emulation Layer for Facebook Web
 */
(function() {
  'use strict';
  // Strip navigator.webdriver flag
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
  } catch (e) {}

  // Emulate realistic hardware concurrency & memory
  try {
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => navigator.hardwareConcurrency || 8
    });
  } catch (e) {}
})();
