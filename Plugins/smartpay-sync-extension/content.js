// Content Script - Runs on SmartPay pages
class SmartPayDataCapture {
  constructor() {
    this.setupMessageHandlers();
    this.injectHookScript();
    this.setupBridgeListener();
    this.injectManualSyncButton();
    console.log('[SmartPay Sync][CS] Content script initialized');
  }

  setupMessageHandlers() {
    if (!window.chrome || !chrome.runtime || !chrome.runtime.onMessage) {
      console.warn('[SmartPay Sync][CS] chrome.runtime not available yet');
      return;
    }
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      switch (message.type) {
        case 'REFRESH_DATA':
          this.triggerDataRefresh();
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    });
  }

  injectHookScript() {
    try {
      const script = document.createElement('script');
      script.id = 'sp-sync-hook';
      script.src = chrome.runtime.getURL('pageHook.js');
      (document.head || document.documentElement).appendChild(script);
      console.log('[SmartPay Sync][CS] Hook script injected');
    } catch (e) {
      console.warn('[SmartPay Sync][CS] Failed to inject hook script', e);
    }
  }

  setupBridgeListener() {
    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (!msg || msg.__SP_CAPTURE__ !== true) return;
      console.log('[SmartPay Sync][CS] bridge captured', msg.kind, msg.url);
      this.processApiResponse(msg.payload, msg.url);
    });
  }

  isSmartPayApiCall(url) {
    // SmartPay Hub API patterns
    const smartPayPatterns = [
      /\/v1\/transactions\/list/i,
      /\/api\/transactions/i,
      /\/api\/sales/i,
      /\/api\/payments/i,
      /\/api\/reports/i,
      /\/api\/data/i,
      /\/api\/transactions\/recent/i,
      /\/api\/dashboard\/data/i,
      /\/api\/terminal\/data/i,
      /\/api\/revenue/i,
      /\/api\/analytics/i,
      /\/api\/export/i,
      /\/api\/sync/i
    ];

    const str = typeof url === 'string' ? url : String(url);
    const matchesGeneric = smartPayPatterns.some(pattern => pattern.test(str));
    const matchesSmartpayB2C = /api\.b2c\.(?:prod|uat|test)\.automation\.smartpay\.co\.nz/.test(str) && /\/v1\/transactions\/list/.test(str);
    return matchesGeneric || matchesSmartpayB2C;
  }

  processApiResponse(data, url) {
    const urlStr = typeof url === 'string' ? url : String(url);
    if (urlStr.includes('api.b2c.prod.automation.smartpay.co.nz') && urlStr.includes('/v1/transactions/list')) {
      console.log('[SmartPay Sync] Transactions list response:', data);
    } else {
      console.log('Captured SmartPay API response:', data);
    }
    
    // Also forward to configured webhook via background (avoids mixed-content/CORS)
    try {
      chrome.runtime.sendMessage({ type: 'FORWARD_WEBHOOK', payload: data }, (res) => {
        console.log('[SmartPay Sync][CS] Forward result', res);
      });
    } catch (e) {
      console.warn('[SmartPay Sync] Failed to send payload to background', e);
    }
  }

  extractTransactions(data) {
    // SmartPay Hub data extraction patterns
    let transactions = [];
    
    // Common patterns for extracting transactions from SmartPay Hub
    if (data.transactions) {
      transactions = data.transactions;
    } else if (data.data && Array.isArray(data.data)) {
      transactions = data.data;
    } else if (data.sales) {
      transactions = data.sales;
    } else if (data.payments) {
      transactions = data.payments;
    } else if (data.recent_transactions) {
      transactions = data.recent_transactions;
    } else if (data.dashboard_data && data.dashboard_data.transactions) {
      transactions = data.dashboard_data.transactions;
    } else if (data.terminal_data && data.terminal_data.transactions) {
      transactions = data.terminal_data.transactions;
    } else if (Array.isArray(data)) {
      transactions = data;
    } else if (data.result && Array.isArray(data.result)) {
      transactions = data.result;
    } else if (data.response && Array.isArray(data.response)) {
      transactions = data.response;
    }
    
    // Filter and format transactions
    return transactions
      .filter(tx => this.isValidTransaction(tx))
      .map(tx => this.formatTransaction(tx));
  }

  // posting moved to background service worker

  isValidTransaction(transaction) {
    // Validate that this is a transaction we want to sync
    return transaction && 
           (transaction.amount || transaction.transaction_amount || transaction.total_amount) &&
           (transaction.transaction_date || transaction.date || transaction.created_at || transaction.timestamp);
  }

  formatTransaction(transaction) {
    // Standardize the transaction format for SmartPay Hub
    return {
      transaction_id: transaction.id || transaction.transaction_id || transaction.tx_id,
      amount: transaction.amount || transaction.transaction_amount || transaction.total_amount,
      description: transaction.description || transaction.notes || transaction.memo,
      transaction_date: transaction.transaction_date || transaction.date || transaction.created_at || transaction.timestamp,
      terminal_id: transaction.terminal_id || transaction.terminal || transaction.terminal_name,
      transaction_type: transaction.transaction_type || transaction.type || transaction.transaction_type_name,
      card_type: transaction.card_type || transaction.card_brand,
      last_4: transaction.last_4 || transaction.last_four || transaction.card_last_four,
      purchase: transaction.purchase || transaction.purchase_amount,
      surcharge: transaction.surcharge || transaction.surcharge_amount,
      cash_out: transaction.cash_out || transaction.cash_out_amount,
      tips: transaction.tips || transaction.tip_amount,
      payment_status: transaction.payment_status || transaction.status || transaction.transaction_status,
      // Additional SmartPay Hub fields
      merchant_id: transaction.merchant_id,
      location_id: transaction.location_id,
      device_id: transaction.device_id,
      reference_number: transaction.reference_number || transaction.ref_number,
      auth_code: transaction.auth_code,
      batch_id: transaction.batch_id
    };
  }

  async triggerDataRefresh() {
    // This method can trigger a manual refresh of the SmartPay data
    // Implementation depends on how SmartPay's refresh mechanism works
    
    // Option 1: Click refresh button if it exists
    // Target the rotate icon button on SmartPay Hub transactions page
    let refreshButton = document.querySelector('button.p-button.p-component.p-button-glyph i.fa-arrows-rotate');
    if (refreshButton) {
      const btn = refreshButton.closest('button');
      if (btn) { console.log('[SmartPay Sync][CS] Clicking native refresh button'); btn.click(); return; }
    }
    // Fallback selectors
    refreshButton = document.querySelector('[data-testid="refresh-button"], .refresh-btn, #refresh-btn');
    if (refreshButton) {
      (refreshButton.closest('button') ?? refreshButton).click();
      return;
    }
    
    // Option 2: Trigger a page reload
    // window.location.reload();
    
    // Option 3: Make a direct API call (if you have the endpoint)
    // this.makeDirectApiCall();
    
    console.log('Triggered SmartPay data refresh');
  }

  injectManualSyncButton() {
    const ensureButton = () => {
      const onTransactionsPage = location.hostname.includes('smartpay-hub.com') && location.pathname.startsWith('/transactions');
      if (!onTransactionsPage) return;
      if (document.getElementById('sp-sync-now-button')) return;

      const btn = document.createElement('button');
      btn.id = 'sp-sync-now-button';
      btn.textContent = 'Sync Now';
      btn.style.position = 'fixed';
      btn.style.bottom = '16px';
      btn.style.right = '16px';
      btn.style.zIndex = '2147483647';
      btn.style.background = '#2563eb';
      btn.style.color = '#fff';
      btn.style.border = 'none';
      btn.style.borderRadius = '9999px';
      btn.style.padding = '10px 16px';
      btn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      btn.style.cursor = 'pointer';
      btn.onclick = () => { console.log('[SmartPay Sync][CS] Floating Sync Now clicked'); this.triggerDataRefresh(); };
      const target = document.body || document.documentElement;
      if (!target) { console.warn('[SmartPay Sync][CS] No body to append button'); return; }
      target.appendChild(btn);
    };

    // Try immediately and also observe DOM changes
    const observer = new MutationObserver(() => ensureButton());
    observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
    ensureButton();
  }

  async makeDirectApiCall() {
    // Make the SmartPay API call ourselves using token from localStorage
    try {
      const tokenKey = Object.keys(localStorage).find(k => k.includes('CognitoIdentityServiceProvider') && k.endsWith('.accessToken'));
      const token = tokenKey ? localStorage.getItem(tokenKey) : null;
      if (!token) {
        console.warn('[SmartPay Sync][CS] accessToken not found in localStorage');
        return;
      }

      const body = {
        Search: { Match: { ResultText: ["APPROVED","APPROVED Y1","APPROVED Y3","SIG ACCEPTED","SIGNATURE ACCEPTED"], SiteId: ["TMS_1235269"] }, PrefixMatch: {}, ExcludeMatch: {} },
        Offset: 0,
        Range: { Timestamp: { From: new Date(Date.now() - 24*60*60*1000).toISOString(), To: new Date().toISOString() } },
        Order: [{ Timestamp: 'DESC' }]
      };

      const url = 'https://api.b2c.prod.automation.smartpay.co.nz/v1/transactions/list';
      console.log('[SmartPay Sync][CS] Direct fetch to', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'accept': 'application/json, text/plain, */*',
          'content-type': 'application/json',
          'authorization': `Bearer ${token}`,
          'origin': 'https://smartpay-hub.com'
        },
        body: JSON.stringify(body),
        credentials: 'omit',
        mode: 'cors'
      });
      console.log('[SmartPay Sync][CS] Direct fetch status', response.status);
      if (!response.ok) {
        const t = await response.text();
        console.warn('[SmartPay Sync][CS] Direct fetch failed', response.status, t);
        return;
      }
      const data = await response.json();
      this.processApiResponse(data, url);
    } catch (error) {
      console.error('[SmartPay Sync][CS] Direct API call failed:', error);
    }
  }
}

// Initialize the data capture
const smartPayCapture = new SmartPayDataCapture();
