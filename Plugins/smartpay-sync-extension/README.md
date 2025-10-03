# SmartPay Data Sync Chrome Extension

This Chrome extension automatically syncs transaction data from SmartPay to your business application via webhooks.

## Features

- **Automatic Data Capture**: Monitors SmartPay API calls and captures transaction data
- **Interval Sync**: Refreshes data every minute (configurable)
- **Webhook Integration**: Sends data to your app's webhook endpoint
- **Secure Authentication**: Supports header-based authentication
- **Real-time Status**: Shows sync status and last sync time

## Installation

1. **Load Extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this folder

2. **Configure Your App**:
   - Create a webhook in your app (see setup instructions below)
   - Get the webhook URL and authentication details

3. **Setup Extension**:
   - Click the extension icon in Chrome toolbar
   - Enter your webhook URL (e.g., `http://localhost:3000/api/webhooks/your-webhook-id`)
   - Configure authentication if needed
   - Set sync interval (default: 60 seconds)

## Setup Instructions

### 1. Create Webhook in Your App

1. Go to your app's webhook configuration page:
   - **Development**: `http://localhost:3000/webhooks`
   - **Production**: `https://business.truongthings.dev/webhooks`

2. Create a new webhook with these settings:
   - **Name**: SmartPay Sync
   - **Type**: Transaction
   - **Authentication**: Configure header-based auth (optional)
   - **Enabled**: Yes

3. Copy the webhook URL (format: `http://localhost:3000/api/webhooks/[webhook-id]` or `https://business.truongthings.dev/api/webhooks/[webhook-id]`)

### 2. Configure Extension

1. Open SmartPay Hub (https://smartpay-hub.com) in a browser tab
2. Click the extension icon
3. Enter the webhook URL from step 1 (e.g., `http://localhost:3000/api/webhooks/your-webhook-id`)
4. If you configured authentication, enter the header (e.g., `X-API-Key: your-key`)
5. Set sync interval (recommended: 60 seconds)
6. Click "Start Sync"

### 3. How It Works

1. **Data Capture**: Extension monitors SmartPay API calls and captures transaction data
2. **Data Processing**: Captured data is transformed to your app's format
3. **Webhook Delivery**: Data is sent to your webhook endpoint
4. **Automatic Sync**: Process repeats every minute

## Data Format

The extension sends data in this format to your webhook:

```json
{
  "type": "transaction",
  "amount": 66.15,
  "description": "SmartPay Transaction",
  "date": "2025-01-02T20:03:00Z",
  "category": "Sales",
  "payment_method": "card",
  "reference": "SmartPay-12345",
  "notes": "SmartPay Terminal: SA036633",
  "smartpay_data": {
    "terminal_id": "SA036633",
    "transaction_type": "Purchase",
    "card_type": "MASTERCARD",
    "last_4": "6395",
    "purchase": 65.30,
    "surcharge": 0.85,
    "cash_out": 0.00,
    "tips": 0.00,
    "payment_status": "APPROVED"
  }
}
```

## Troubleshooting

### Extension Not Capturing Data
- Ensure SmartPay tab is open and active
- Check that SmartPay API calls are being made
- Verify the extension has permission to access the SmartPay domain

### Webhook Not Receiving Data
- Verify webhook URL is correct
- Check authentication headers
- Ensure webhook is enabled in your app
- Check browser console for errors

### Data Not Appearing in App
- Check webhook logs in your app
- Verify data transformation is working
- Ensure webhook processing is enabled

## Security Notes

- Webhook authentication is recommended for production use
- Extension only captures data from SmartPay domains
- No data is stored locally in the extension
- All data transmission is encrypted (HTTPS)

## Customization

To customize the extension for your specific SmartPay setup:

1. **Update API Patterns**: Modify `isSmartPayApiCall()` in `content.js`
2. **Custom Data Extraction**: Update `extractTransactions()` in `content.js`
3. **Data Transformation**: Modify `transformSmartPayData()` in `background.js`
4. **Domain Configuration**: Update `manifest.json` host permissions

## Support

For issues or questions:
1. Check browser console for errors
2. Verify webhook configuration
3. Test with manual webhook calls
4. Contact your app administrator
