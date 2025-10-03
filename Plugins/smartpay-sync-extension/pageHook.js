(function () {
  const isMatch = (url) => {
    try { url = String(url); } catch { return false; }
    if (/\/v1\/transactions\/list/i.test(url)) return true;
    if (/api\.b2c\.(?:prod|uat|test)\.automation\.smartpay\.co\.nz/i.test(url) && /\/v1\/transactions\/list/i.test(url)) return true;
    return false;
  };

  const post = (kind, url, payload) => {
    try { window.postMessage({ __SP_CAPTURE__: true, kind, url: String(url), payload }, '*'); } catch {}
  };

  try {
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const res = await origFetch.apply(this, args);
      const url = (args && args[0]) || '';
      if (isMatch(url)) {
        try { const cloned = res.clone(); const data = await cloned.json(); post('fetch', url, data); } catch {}
      }
      return res;
    };
  } catch {}

  try {
    const origOpen = XMLHttpRequest.prototype.open;
    const origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url, ...rest) { this.__sp_url = url; return origOpen.apply(this, [method, url, ...rest]); };
    XMLHttpRequest.prototype.send = function (body) {
      this.addEventListener('readystatechange', function () {
        if (this.readyState === 4) {
          if (isMatch(this.__sp_url)) {
            try { const data = JSON.parse(this.responseText); post('xhr', this.__sp_url, data); } catch {}
          }
        }
      });
      return origSend.apply(this, [body]);
    };
  } catch {}
})();


