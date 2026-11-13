const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const React = require('react');
const { render } = require('@react-email/render');

const originalTsx = Module._extensions['.tsx'];
Module._extensions['.tsx'] = (module, filename) => {
  const source = fs.readFileSync(filename, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020, esModuleInterop: true }, fileName: filename });
  module._compile(outputText, filename);
};
const { CouponEmail } = require('./CouponEmail.tsx');
Module._extensions['.tsx'] = originalTsx;
const coupon = { code: 'THANKYOU-10', title: 'A treat for your next meal', discount_type: 'percent', discount_value: 10, min_cart_subtotal: 0, max_uses: 1, usage_count: 0, max_uses_per_user: 1, ends_at: null };
const props = { coupon, customerName: 'Alex', businessName: "Pappa's Ocean Catch", logoUrl: 'https://example.com/logo.png', orderUrl: 'https://example.com/order?coupon=THANKYOU-10' };

test('renders brand header/logo, percentage offer, existing code, order link and correct no-expiry terms', async () => {
  const html = await render(React.createElement(CouponEmail, props));
  assert.match(html, /Pappa(?:&#x27;|&#39;|')s Ocean Catch/);
  assert.match(html, /https:\/\/example.com\/logo.png/);
  assert.match(html, /10% off/); assert.match(html, /THANKYOU-10/);
  assert.match(html, /https:\/\/example.com\/order\?coupon=THANKYOU-10/);
  assert.match(html, /No expiry date/); assert.match(html, /No minimum spend/);
  assert.match(html, /1 use\(s\) remaining/);
  if (process.env.COUPON_EMAIL_PREVIEW_DIR) {
    fs.mkdirSync(process.env.COUPON_EMAIL_PREVIEW_DIR, { recursive: true });
    fs.writeFileSync(path.join(process.env.COUPON_EMAIL_PREVIEW_DIR, 'percent.html'), html);
  }
});
test('fixed amount template shows dollars, minimum and Melbourne expiry while escaping customer content', async () => {
  const html = await render(React.createElement(CouponEmail, { ...props, customerName: '<script>alert(1)</script>', coupon: { ...coupon, discount_type: 'fixed', discount_value: 12.5, min_cart_subtotal: 25, ends_at: '2026-12-01T00:00:00Z', title: '<img src=x onerror=alert(1)>' } }));
  assert.match(html, /\$12\.50 off/); assert.match(html, /Minimum subtotal: \$25\.00/);
  assert.match(html, /AEDT/); assert.doesNotMatch(html, /<script>|<img src=x/);
  assert.match(html, /&lt;script&gt;/);
  if (process.env.COUPON_EMAIL_PREVIEW_DIR) fs.writeFileSync(path.join(process.env.COUPON_EMAIL_PREVIEW_DIR, 'fixed.html'), html);
});
