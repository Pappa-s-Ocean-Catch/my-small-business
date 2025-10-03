// Popup Script
class SmartPaySyncPopup {
  constructor() {
    this.setupEventListeners();
    this.loadSettings();
    this.updateStatus();
  }

  setupEventListeners() {
    document.getElementById('startBtn').addEventListener('click', () => {
      this.startSync();
    });

    document.getElementById('stopBtn').addEventListener('click', () => {
      this.stopSync();
    });

    // Save settings on input change
    document.getElementById('webhookUrl').addEventListener('change', () => {
      this.saveSettings();
    });

    document.getElementById('authHeader').addEventListener('change', () => {
      this.saveSettings();
    });

    document.getElementById('syncInterval').addEventListener('change', () => {
      this.saveSettings();
    });
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get([
        'webhookUrl',
        'webhookAuth',
        'syncInterval',
        'isEnabled',
        'lastSyncTime'
      ]);

      document.getElementById('webhookUrl').value = result.webhookUrl || '';
      document.getElementById('authHeader').value = result.webhookAuth || '';
      document.getElementById('syncInterval').value = result.syncInterval || 60;

      if (result.lastSyncTime) {
        this.updateLastSync(result.lastSyncTime);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async saveSettings() {
    try {
      const webhookUrl = document.getElementById('webhookUrl').value;
      const authHeader = document.getElementById('authHeader').value;
      const syncInterval = parseInt(document.getElementById('syncInterval').value) * 1000; // Convert to milliseconds

      await chrome.storage.sync.set({
        webhookUrl: webhookUrl,
        webhookAuth: authHeader,
        syncInterval: syncInterval
      });
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }

  async startSync() {
    const webhookUrl = document.getElementById('webhookUrl').value;
    
    if (!webhookUrl) {
      alert('Please enter a webhook URL');
      return;
    }

    try {
      const authHeader = this.parseAuthHeader(document.getElementById('authHeader').value);
      const syncInterval = parseInt(document.getElementById('syncInterval').value) * 1000;

      const config = {
        webhookUrl: webhookUrl,
        webhookAuth: authHeader,
        syncInterval: syncInterval
      };

      // Send message to background script
      const response = await chrome.runtime.sendMessage({
        type: 'START_SYNC',
        config: config
      });

      if (response.success) {
        this.updateStatus(true);
        this.saveSettings();
      } else {
        alert('Failed to start sync');
      }
    } catch (error) {
      console.error('Error starting sync:', error);
      alert('Error starting sync: ' + error.message);
    }
  }

  async stopSync() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'STOP_SYNC'
      });

      if (response.success) {
        this.updateStatus(false);
      } else {
        alert('Failed to stop sync');
      }
    } catch (error) {
      console.error('Error stopping sync:', error);
      alert('Error stopping sync: ' + error.message);
    }
  }

  parseAuthHeader(authHeader) {
    if (!authHeader.trim()) {
      return {};
    }

    const [key, value] = authHeader.split(':').map(s => s.trim());
    if (key && value) {
      return { [key]: value };
    }

    return {};
  }

  updateStatus(isRunning) {
    const statusEl = document.getElementById('status');
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');

    if (isRunning) {
      statusEl.textContent = 'Status: Running';
      statusEl.className = 'status running';
      startBtn.disabled = true;
      stopBtn.disabled = false;
    } else {
      statusEl.textContent = 'Status: Stopped';
      statusEl.className = 'status stopped';
      startBtn.disabled = false;
      stopBtn.disabled = true;
    }
  }

  updateLastSync(timestamp) {
    const lastSyncEl = document.getElementById('lastSync');
    if (timestamp) {
      const date = new Date(timestamp);
      lastSyncEl.textContent = `Last sync: ${date.toLocaleString()}`;
    } else {
      lastSyncEl.textContent = '';
    }
  }

  async checkStatus() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_STATUS'
      });

      if (response) {
        this.updateStatus(response.isRunning);
        if (response.lastSyncTime) {
          this.updateLastSync(response.lastSyncTime);
        }
      }
    } catch (error) {
      console.error('Error checking status:', error);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new SmartPaySyncPopup();
  
  // Check status every second
  setInterval(() => {
    popup.checkStatus();
  }, 1000);
});
