(() => {
  const provider = location.hostname === 'merchants.ubereats.com'
    ? 'uber_eats'
    : location.hostname === 'www.doordash.com'
      ? 'doordash'
      : null;
  if (!provider) return;

  const mount = () => {
    if (document.querySelector('[data-marketplace-session-sync]')) return;
    const button = document.createElement('button');
    const status = document.createElement('span');
    button.dataset.marketplaceSessionSync = 'true';
    button.type = 'button';
    button.textContent = 'Sync marketplace session';
    button.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;border:0;border-radius:999px;padding:10px 16px;background:#0f766e;color:#fff;font:600 14px Arial,sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.25);cursor:pointer;';
    status.style.cssText = 'position:fixed;right:16px;bottom:60px;z-index:2147483647;max-width:260px;padding:6px 10px;border-radius:6px;background:#fff;color:#111;font:12px Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.2);display:none;';
    const openReviewDialog = (cookies) => {
      document.querySelector('[data-marketplace-session-review]')?.remove();
      const overlay = document.createElement('div');
      overlay.dataset.marketplaceSessionReview = 'true';
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:rgba(15,23,42,.55);font:14px Arial,sans-serif;';
      const dialog = document.createElement('section');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.setAttribute('aria-label', 'Review marketplace session cookies');
      dialog.style.cssText = 'width:min(680px,100%);padding:20px;border-radius:12px;background:#fff;color:#111;box-shadow:0 20px 48px rgba(0,0,0,.35);';
      const title = document.createElement('h2');
      title.textContent = 'Review marketplace session';
      title.style.cssText = 'margin:0 0 8px;font-size:20px;';
      const description = document.createElement('p');
      description.textContent = 'Review the cookie header below. It is not sent until you choose Submit session.';
      description.style.cssText = 'margin:0 0 12px;color:#475569;line-height:1.4;';
      const field = document.createElement('textarea');
      field.readOnly = true;
      field.value = cookies;
      field.setAttribute('aria-label', 'Marketplace cookie header');
      field.style.cssText = 'box-sizing:border-box;width:100%;min-height:180px;resize:vertical;padding:10px;border:1px solid #94a3b8;border-radius:6px;background:#f8fafc;color:#111;font:12px ui-monospace,SFMono-Regular,Menlo,monospace;';
      const feedback = document.createElement('p');
      feedback.style.cssText = 'min-height:18px;margin:10px 0 0;color:#475569;';
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
      const makeAction = (label, style) => {
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = label;
        action.style.cssText = `border:0;border-radius:6px;padding:9px 12px;font:600 14px Arial,sans-serif;cursor:pointer;${style}`;
        return action;
      };
      const cancel = makeAction('Cancel', 'background:#e2e8f0;color:#0f172a;');
      const copy = makeAction('Copy', 'background:#dbeafe;color:#1d4ed8;');
      const submit = makeAction('Submit session', 'background:#0f766e;color:#fff;');
      cancel.addEventListener('click', () => overlay.remove());
      copy.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(cookies);
          feedback.textContent = 'Cookie header copied.';
        } catch {
          field.focus();
          field.select();
          feedback.textContent = 'Copy was blocked. The cookie header has been selected for manual copy.';
        }
      });
      submit.addEventListener('click', async () => {
        submit.disabled = true;
        copy.disabled = true;
        feedback.textContent = 'Submitting marketplace session…';
        const result = await chrome.runtime.sendMessage({ type: 'SYNC_PROVIDER_SESSION', provider, cookies });
        if (result?.success) {
          overlay.remove();
          status.textContent = 'Marketplace session updated.';
          return;
        }
        feedback.textContent = result?.error || 'Marketplace session sync failed.';
        submit.disabled = false;
        copy.disabled = false;
      });
      actions.append(cancel, copy, submit);
      dialog.append(title, description, field, feedback, actions);
      overlay.append(dialog);
      (document.body || document.documentElement).append(overlay);
      field.focus();
    };
    button.addEventListener('click', async () => {
      button.disabled = true;
      status.textContent = 'Reading marketplace session…';
      status.style.display = 'block';
      const result = await chrome.runtime.sendMessage({ type: 'PREVIEW_PROVIDER_SESSION', provider });
      if (result?.success && result.cookies) {
        status.style.display = 'none';
        openReviewDialog(result.cookies);
      } else {
        status.textContent = result?.error || 'Could not read the marketplace session.';
      }
      button.disabled = false;
    });
    (document.body || document.documentElement).append(button, status);
  };

  new MutationObserver(mount).observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();
