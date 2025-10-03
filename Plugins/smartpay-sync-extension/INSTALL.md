# SmartPay Sync Extension - Installation Guide

## Quick Setup

### 1. Install Extension

1. **Open Chrome Extensions**:
   - Go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)

2. **Load Extension**:
   - Click "Load unpacked"
   - Select the `plugins/smartpay-sync-extension` folder
   - Extension should appear in your extensions list

3. **Pin Extension**:
   - Click the puzzle piece icon in Chrome toolbar
   - Find "SmartPay Data Sync" and click the pin icon

### 2. Create Webhook in Your App

#### Development (localhost:3000)
1. Go to `http://localhost:3000/webhooks`
2. Click "Add Webhook"
3. Fill in:
   - **Name**: SmartPay Sync
   - **Type**: Transaction
   - **Enabled**: Yes
4. Copy the webhook URL (e.g., `http://localhost:3000/api/webhooks/abc123`)

#### Production (business.truongthings.dev)
1. Go to `https://business.truongthings.dev/webhooks`
2. Click "Add Webhook"
3. Fill in:
   - **Name**: SmartPay Sync
   - **Type**: Transaction
   - **Enabled**: Yes
4. Copy the webhook URL (e.g., `https://business.truongthings.dev/api/webhooks/abc123`)

### 3. Configure Extension

1. **Open SmartPay Hub**:
   - Go to `https://smartpay-hub.com`
   - Log in to your SmartPay account

2. **Setup Extension**:
   - Click the SmartPay Sync extension icon
   - Enter your webhook URL from step 2
   - Set sync interval to 60 seconds
   - Click "Start Sync"

### 4. Test the Setup

1. **Check Extension Status**:
   - Extension should show "Status: Running"
   - Should show "Last sync: [timestamp]"

2. **Trigger Data**:
   - Navigate around SmartPay Hub to trigger API calls
   - Check browser console for captured data

3. **Verify Webhook**:
   - Check your app's webhook logs
   - Verify transactions are being received

## Troubleshooting

### Extension Not Working
- Ensure SmartPay Hub tab is open and active
- Check that extension has permission to access the site
- Verify webhook URL is correct

### No Data Captured
- Open browser console (F12)
- Look for "Captured SmartPay API response" messages
- Check if SmartPay Hub is making API calls

### Webhook Not Receiving Data
- Verify webhook URL is accessible
- Check authentication headers if configured
- Ensure webhook is enabled in your app

## Development Notes

- Extension monitors API calls to SmartPay Hub
- Captures transaction data automatically
- Sends data to your webhook every minute
- Works with both localhost and production domains
