// Setup script to help configure the extension
// Run this in your browser console on the SmartPay page to test data capture

class SmartPaySetup {
  constructor() {
    this.setupNetworkMonitoring();
    this.setupTestDataCapture();
  }

  setupNetworkMonitoring() {
    console.log('🔍 Setting up SmartPay network monitoring...');

    // Monitor all network requests
    const originalFetch = window.fetch;
    const self = this;

    window.fetch = async function (...args) {
      const response = await originalFetch.apply(this, args);

      // Log all API calls
      console.log('📡 API Call:', args[0], response.status);

      // Check if this looks like a SmartPay API
      if (self.isSmartPayApi(args[0])) {
        console.log('✅ SmartPay API detected:', args[0]);

        try {
          const clonedResponse = response.clone();
          const data = await clonedResponse.json();
          console.log('📊 SmartPay Data:', data);
          self.analyzeDataStructure(data);
        } catch (error) {
          console.log('⚠️ Response is not JSON');
        }
      }

      return response;
    };

    console.log('✅ Network monitoring active');
  }

  isSmartPayApi(url) {
    // SmartPay Hub API patterns
    const patterns = [
      /\/api\//i,
      /\/transactions/i,
      /\/sales/i,
      /\/payments/i,
      /\/reports/i,
      /\/data/i,
      /\/dashboard/i,
      /\/terminal/i,
      /\/revenue/i,
      /\/analytics/i,
      /\/export/i,
      /\/sync/i
    ];

    return patterns.some(pattern => pattern.test(url));
  }

  analyzeDataStructure(data) {
    console.log('🔍 Analyzing data structure...');

    // Look for common transaction patterns
    const transactionKeys = ['transactions', 'data', 'sales', 'payments', 'results'];
    const foundKeys = transactionKeys.filter(key => data[key]);

    if (foundKeys.length > 0) {
      console.log('✅ Found transaction data in keys:', foundKeys);

      foundKeys.forEach(key => {
        const transactions = data[key];
        if (Array.isArray(transactions) && transactions.length > 0) {
          console.log(`📋 Sample transaction from ${key}:`, transactions[0]);
          this.analyzeTransactionStructure(transactions[0]);
        }
      });
    } else {
      console.log('⚠️ No transaction data found in common keys');
      console.log('📋 Available keys:', Object.keys(data));
    }
  }

  analyzeTransactionStructure(transaction) {
    console.log('🔍 Analyzing transaction structure...');

    const importantFields = [
      'id', 'transaction_id', 'amount', 'transaction_amount',
      'date', 'transaction_date', 'created_at',
      'description', 'notes', 'terminal_id', 'terminal',
      'card_type', 'last_4', 'last_four', 'status', 'payment_status'
    ];

    const foundFields = importantFields.filter(field =>
      transaction.hasOwnProperty(field) && transaction[field] !== null
    );

    console.log('✅ Found fields:', foundFields);
    console.log('❌ Missing fields:', importantFields.filter(field => !foundFields.includes(field)));

    // Generate sample webhook payload
    this.generateSamplePayload(transaction);
  }

  generateSamplePayload(transaction) {
    console.log('📤 Generating sample webhook payload...');

    const payload = {
      type: 'transaction',
      amount: transaction.amount || transaction.transaction_amount || 0,
      description: transaction.description || transaction.notes || 'SmartPay Transaction',
      date: transaction.date || transaction.transaction_date || transaction.created_at || new Date().toISOString(),
      category: 'Sales',
      payment_method: 'card',
      reference: `SmartPay-${transaction.id || transaction.transaction_id || 'unknown'}`,
      notes: `SmartPay Terminal: ${transaction.terminal_id || transaction.terminal || 'unknown'}`,
      smartpay_data: transaction
    };

    console.log('📤 Sample webhook payload:', JSON.stringify(payload, null, 2));

    // Test webhook delivery
    this.testWebhookDelivery(payload);
  }

  async testWebhookDelivery(payload) {
    const webhookUrl = prompt('Enter your webhook URL to test:', 'https://localhost:3000/api/webhooks/your-webhook-id');

    if (!webhookUrl) {
      console.log('❌ No webhook URL provided');
      return;
    }

    try {
      console.log('🧪 Testing webhook delivery...');

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Webhook test successful:', result);
      } else {
        console.log('❌ Webhook test failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.log('❌ Webhook test error:', error);
    }
  }

  setupTestDataCapture() {
    console.log('🧪 SmartPay Setup Complete!');
    console.log('📋 Next steps:');
    console.log('1. Navigate around SmartPay to trigger API calls');
    console.log('2. Check console for captured data');
    console.log('3. Update extension content.js with correct API patterns');
    console.log('4. Test webhook delivery');
    console.log('5. Install and configure the extension');
  }
}

// Auto-start setup
console.log('🚀 Starting SmartPay setup...');
const setup = new SmartPaySetup();
