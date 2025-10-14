# Google Business Profile API Setup

This document explains how to set up Google Business Profile API integration for syncing your menu products and categories to your Google Business Profile.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Google Business Profile API Configuration
GOOGLE_BUSINESS_CLIENT_ID=your_google_business_client_id_here
GOOGLE_BUSINESS_CLIENT_SECRET=your_google_business_client_secret_here
GOOGLE_BUSINESS_REDIRECT_URI=http://localhost:3000/api/google-business/callback
GOOGLE_BUSINESS_REFRESH_TOKEN=your_refresh_token_here
```

## Getting Your Google Business Profile API Credentials

### Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown and select "New Project"
3. Provide a name for your project (e.g., "My Business Profile Sync")
4. Click "Create"

### Step 2: Enable the Google Business Profile API

1. In your Google Cloud project, go to "APIs & Services" > "Library"
2. Search for "Google Business Profile API" and click "Enable"
3. Also enable "Google My Business API" for additional functionality

### Step 3: Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "External" user type (unless you have a Google Workspace account)
3. Fill in the required information:
   - **App name**: Your business name
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
4. Add your domain to "Authorized domains"
5. Save and continue through the scopes and test users sections

### Step 4: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Choose "Web application" as the application type
4. Add authorized redirect URIs:
   - `http://localhost:3000/api/google-business/callback` (for development)
   - `https://yourdomain.com/api/google-business/callback` (for production)
5. Click "Create"
6. Copy the Client ID and Client Secret

### Step 5: Configure Your Environment

1. Add the credentials to your `.env.local` file:
   ```bash
   GOOGLE_BUSINESS_CLIENT_ID=your_actual_client_id_here
   GOOGLE_BUSINESS_CLIENT_SECRET=your_actual_client_secret_here
   GOOGLE_BUSINESS_REDIRECT_URI=http://localhost:3000/api/google-business/callback
   ```

2. For production deployment (Vercel), add the environment variables:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add each variable for Production, Preview, and Development environments

## Features Implemented

### ✅ OAuth 2.0 Authentication
- Secure authentication with Google Business Profile API
- Refresh token management for long-term access
- Proper scope permissions for business management

### ✅ Product Sync Service
- Sync products from your menu system to Google Business Profile
- Automatic category mapping
- Price and currency formatting
- Image URL handling

### ✅ Category Mapping
- Maps your local categories to Google Business categories
- Configurable category mappings
- Support for hierarchical categories

### ✅ Sync Status Tracking
- Real-time sync status monitoring
- Error handling and reporting
- Last sync timestamp tracking

## API Endpoints

### Authentication
- `GET /api/google-business/auth` - Get OAuth authorization URL
- `GET /api/google-business/callback` - Handle OAuth callback
- `POST /api/google-business/refresh-token` - Refresh access token

### Sync Operations
- `POST /api/google-business/sync-products` - Sync all products
- `POST /api/google-business/sync-categories` - Sync all categories
- `GET /api/google-business/status` - Get sync status
- `POST /api/google-business/sync-single-product` - Sync single product

### Configuration
- `GET /api/google-business/mapping` - Get category mappings
- `POST /api/google-business/mapping` - Update category mappings
- `GET /api/google-business/locations` - Get business locations

## Usage

### Initial Setup
1. Configure your Google Cloud project and OAuth credentials
2. Add environment variables to your `.env.local` file
3. Start your development server
4. Navigate to the Google Business Profile sync settings in your admin panel

### First-Time Authentication
1. Click "Connect to Google Business Profile"
2. You'll be redirected to Google's OAuth consent screen
3. Grant the necessary permissions
4. You'll be redirected back to your application
5. The refresh token will be automatically saved

### Syncing Products and Categories
1. Go to Shop → Menu → Google Business Profile Sync
2. Click "Sync All Products" to sync your entire menu
3. Click "Sync All Categories" to sync your category structure
4. Monitor the sync status in real-time

### Managing Category Mappings
1. Go to the category mapping section
2. Map your local categories to Google Business categories
3. Save your mappings
4. Re-sync to apply the new mappings

## Troubleshooting

### Common Issues

1. **"GOOGLE_BUSINESS_CLIENT_ID environment variable is not set"**
   - Ensure all environment variables are properly set
   - Restart your development server after adding variables

2. **"OAuth consent screen not configured"**
   - Complete the OAuth consent screen configuration in Google Cloud Console
   - Add your domain to authorized domains

3. **"Invalid redirect URI"**
   - Ensure the redirect URI in your OAuth client matches exactly
   - Check that the URI is added to authorized redirect URIs

4. **"Sync failed"**
   - Check your Google Business Profile API quotas
   - Ensure your business account has the necessary permissions
   - Verify that your products meet Google's content policies

### API Quotas and Limits

- Google Business Profile API has usage quotas and rate limits
- Monitor your usage in Google Cloud Console
- Consider implementing rate limiting for bulk operations
- Set up billing alerts for API usage

## Security Notes

- OAuth credentials are server-side only
- Refresh tokens are stored securely
- All API calls require proper authentication
- User data is handled according to Google's privacy policies

## Cost Considerations

- Google Business Profile API may have usage costs
- Monitor usage in Google Cloud Console
- Consider implementing sync limits for large catalogs
- Cache frequently accessed data to reduce API calls

## Future Enhancements

- Automatic sync on product/category changes
- Bulk sync operations with progress tracking
- Advanced category mapping with AI suggestions
- Integration with Google My Business Insights
- Real-time sync status notifications
- Conflict resolution for simultaneous edits

