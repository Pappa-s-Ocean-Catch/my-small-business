// Background Service Worker
class SmartPaySync {
  constructor() {
    this.isRunning = false;
    this.intervalId = null;
    this.webhookUrl = null;
    this.webhookAuth = null;
    this.lastSyncTime = null;
    this.setupMessageHandlers();
    this.loadSettings();
    console.log('[SmartPay Sync][BG] Service worker initialized');
  }

  setupMessageHandlers() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('[SmartPay Sync][BG] Message received', { type: message?.type, fromTab: sender?.tab?.id });
      switch (message.type) {
        case 'START_SYNC':
          this.startSync(message.config);
          sendResponse({ success: true });
          break;
        case 'STOP_SYNC':
          this.stopSync();
          sendResponse({ success: true });
          break;
        case 'GET_STATUS':
          sendResponse({
            isRunning: this.isRunning,
            lastSyncTime: this.lastSyncTime,
            webhookUrl: this.webhookUrl
          });
          break;
        case 'FORWARD_WEBHOOK': {
          (async () => {
            try {
              const { webhookUrl, webhookAuth } = await chrome.storage.sync.get(['webhookUrl', 'webhookAuth']);
              if (webhookUrl) this.webhookUrl = webhookUrl;
              if (webhookAuth) this.webhookAuth = webhookAuth;
              console.log('[SmartPay Sync][BG] Forwarding payload to webhook', {
                url: this.webhookUrl,
                hasAuth: !!this.webhookAuth
              });
              await this.sendToWebhook(message.payload);
              sendResponse({ success: true });
            } catch (e) {
              console.error('[SmartPay Sync][BG] Forward failed', e);
              sendResponse({ success: false, error: e instanceof Error ? e.message : String(e) });
            }
          })();
          return true; // async response
        }
        case 'SMARTPAY_DATA':
          this.processSmartPayData(message.data);
          sendResponse({ success: true });
          break;
        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'webhookUrl',
        'webhookAuth',
        'syncInterval',
        'isEnabled'
      ]);
      
      this.webhookUrl = result.webhookUrl;
      this.webhookAuth = result.webhookAuth;
      this.syncInterval = result.syncInterval || 60000; // Default 1 minute
      this.isEnabled = result.isEnabled || false;

      if (this.isEnabled && this.webhookUrl) {
        this.startSync();
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      await chrome.storage.sync.set({
        webhookUrl: this.webhookUrl,
        webhookAuth: this.webhookAuth,
        syncInterval: this.syncInterval,
        isEnabled: this.isEnabled
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  startSync(config = null) {
    if (config) {
      this.webhookUrl = config.webhookUrl;
      this.webhookAuth = config.webhookAuth;
      this.syncInterval = config.syncInterval || 60000;
      this.isEnabled = true;
      this.saveSettings();
    }

    if (!this.webhookUrl) {
      console.error('Webhook URL not configured');
      return;
    }

    if (this.isRunning) {
      console.log('Sync already running');
      return;
    }

    this.isRunning = true;
    console.log('Starting SmartPay sync...');

    // Start interval
    this.intervalId = setInterval(() => {
      this.triggerDataRefresh();
    }, this.syncInterval);

    // Trigger initial sync
    this.triggerDataRefresh();
  }

  stopSync() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRunning = false;
    this.isEnabled = false;
    this.saveSettings();
    console.log('SmartPay sync stopped');
  }

  async triggerDataRefresh() {
    try {
      // Get the active SmartPay tab
      const tabs = await chrome.tabs.query({ 
        url: "https://smartpay-hub.com/*" 
      });
      
      if (tabs.length === 0) {
        console.log('No SmartPay tab found');
        return;
      }

      const smartPayTab = tabs[0];
      
      // Send message to content script to trigger data refresh
      chrome.tabs.sendMessage(smartPayTab.id, {
        type: 'REFRESH_DATA'
      });

    } catch (error) {
      console.error('Error triggering data refresh:', error);
    }
  }

  async processSmartPayData(data) {
    if (!this.webhookUrl) {
      console.error('Webhook URL not configured');
      return;
    }

    try {
      console.log('Processing SmartPay data:', data);
      
      // Transform SmartPay data to your app's format
      const transformedData = this.transformSmartPayData(data);
      
      // Send to your webhook
      await this.sendToWebhook(transformedData);
      
      this.lastSyncTime = new Date().toISOString();
      
    } catch (error) {
      console.error('Error processing SmartPay data:', error);
    }
  }

  transformSmartPayData(smartPayData) {
    // Transform SmartPay API response to your webhook format
    return {
      type: 'transaction',
      amount: smartPayData.amount,
      description: smartPayData.description || 'SmartPay Transaction',
      date: smartPayData.transaction_date || new Date().toISOString(),
      category: 'Sales',
      payment_method: 'card',
      reference: `SmartPay-${smartPayData.transaction_id}`,
      notes: `SmartPay Terminal: ${smartPayData.terminal_id}`,
      // Include original SmartPay data for reference
      smartpay_data: {
        terminal_id: smartPayData.terminal_id,
        transaction_type: smartPayData.transaction_type,
        card_type: smartPayData.card_type,
        last_4: smartPayData.last_4,
        purchase: smartPayData.purchase,
        surcharge: smartPayData.surcharge,
        cash_out: smartPayData.cash_out,
        tips: smartPayData.tips,
        payment_status: smartPayData.payment_status
      }
    };
  }

  async sendToWebhook(data) {
    try {
      if (!this.webhookUrl) {
        console.warn('[SmartPay Sync][BG] webhookUrl not configured');
        return;
      }
      const headers = {
        'Content-Type': 'application/json',
        ...(this.webhookAuth || {})
      };
      console.log('[SmartPay Sync][BG] POST', this.webhookUrl, { headers });
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      console.log('[SmartPay Sync][BG] Response status', response.status, response.statusText);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error('[SmartPay Sync][BG] Webhook failed body:', text);
        throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('[SmartPay Sync][BG] Webhook success JSON:', result);
      
    } catch (error) {
      console.error('[SmartPay Sync][BG] Error sending to webhook:', error);
      throw error;
    }
  }
}

// Initialize the sync service
const smartPaySync = new SmartPaySync();
