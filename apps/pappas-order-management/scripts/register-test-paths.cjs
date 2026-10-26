// Tests run emitted CommonJS, without Metro's workspace/"@/" resolution.
const Module = require('node:module');
const path = require('node:path');
const original = Module._resolveFilename;
const emittedRoot = path.resolve(__dirname, '../dist-test');
const packages = {
  '@my-small-business/marketplace': 'libs/marketplace/index.js',
  '@my-small-business/pos-mirror': 'libs/pos-mirror/index.js',
};
Module._resolveFilename = function (request, parent, ...options) {
  if (request.startsWith('@/')) {
    request = path.join(emittedRoot, 'apps/pappas-order-management', request.slice(2));
  } else if (packages[request]) {
    request = path.join(emittedRoot, packages[request]);
  }
  return original.call(this, request, parent, ...options);
};
