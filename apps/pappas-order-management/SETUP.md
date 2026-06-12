# Setup Guide for Pappas Order Management App

## Quick Start

1. **Install dependencies (from repo root):**
   ```bash
   pnpm install
   ```

3. **Set up environment variables:**
   Create a `.env` file in the app root with:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
   ```
   
   You can find these values in your Supabase project settings under API.

4. **Create a Dev Client build (required):**

   This app uses native modules (ESC/POS printer), so **Expo Go will not work**.

   ```bash
   # Generate native projects
   npm run app:prebuild

   # Build + install dev client
   npm run app:run:android   # or: npm run app:run:ios

   # Start Metro for dev client
   npm run app:dev-client
   ```

## Prerequisites

- Node.js 18 or higher
- pnpm (workspace uses pnpm)
- Android Studio (Android emulator/device)
- Xcode (iOS simulator/device)
- Supabase account with orders table set up

## Supabase Setup

Ensure your Supabase project has:

1. **Orders table** with the following structure (or compatible):
   - `id` (UUID)
   - `order_number` (TEXT)
   - `order_status` (TEXT)
   - `payment_status` (TEXT)
   - `customer_email` (TEXT)
   - `customer_phone` (TEXT)
   - `customer_name` (TEXT, nullable)
   - `order_type` (TEXT: 'pickup' | 'delivery')
   - `order_channel` (TEXT: 'online' | 'phone_pickup' | 'instore')
   - `order_options` (TEXT, nullable, comma-separated)
   - `total` (NUMERIC)
   - `created_at` (TIMESTAMPTZ)
   - And other order fields

2. **Realtime enabled** for the orders table:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE orders;
   ```

3. **RLS Policies** that allow authenticated users to read/update orders:
   - Staff/admin users should be able to view and update orders
   - Check your existing RLS policies in Supabase

## Building for Production

### iOS

1. Install EAS CLI:
   ```bash
   npm install -g eas-cli
   ```

2. Configure EAS:
   ```bash
   eas build:configure
   ```

3. Build for iOS:
   ```bash
   eas build --platform ios
   ```

### Android

1. Build for Android:
   ```bash
   eas build --platform android
   ```

## Troubleshooting

### "Missing Supabase environment variables" error
- Ensure `.env` file exists in the app root
- Check that variable names start with `EXPO_PUBLIC_`
- Restart the Expo development server after adding env vars

### Real-time updates not working
- Verify Realtime is enabled in Supabase dashboard
- Check network connection
- Ensure you're authenticated

### Sound notifications not working
- Check device volume
- On iOS, ensure device is not in silent mode
- For production, add a `notification.mp3` file in `assets/sounds/`

### Print functionality not working
- For ESC/POS printing, you must use a Dev Client or production build (not Expo Go)
- Ensure Bluetooth/Wi-Fi permissions are granted on the device

## Next Steps

1. Add app icons and splash screens to `assets/` folder
2. Configure app.json with your app details
3. Test on actual tablet device
4. Set up production builds when ready
