# Pappas Order Management - Kitchen Tablet App

A React Native app built with Expo for managing orders in the kitchen on tablets.

## Features

- 🔐 **Supabase Authentication** - Sign in with your Supabase account
- 📋 **Live Order Viewing** - View orders in real-time with Supabase Realtime
- 🔔 **Sound Notifications** - Audio alerts when new orders arrive
- ✏️ **Order Management** - Update order status (pending → confirmed → preparing → ready → completed)
- 🖨️ **Print Orders** - Print order receipts directly from the tablet
- 📱 **Tablet Optimized** - Landscape orientation optimized for kitchen tablets

## Setup

### Prerequisites

- Node.js 18+ installed
- pnpm installed (workspace uses pnpm)
- Supabase project with orders table

**Platform tooling (for native builds / dev client):**

- Android emulator/device: Android Studio + SDKs
- iOS simulator/device: Xcode

### Installation

1. Install dependencies from repo root:
```bash
pnpm install
```

3. Create a `.env` file in the app root:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm run app:dev-client
```

### Running (Emulator / Simulator)

This app includes native modules (e.g. ESC/POS printer). Expo Go will not work.

1) Generate native projects:
```bash
npm run app:prebuild
```

2) Build + install Dev Client:
```bash
npm run app:run:android
# or
npm run app:run:ios
```

3) Start Metro for Dev Client:
```bash
npm run app:dev-client
```

Then open the installed app in the emulator/simulator.

### Running on a Real Device

Yes — for real device testing you must install the Dev Client (or a production build) onto the device.

- Local install via USB: `npm run app:run:android` / `npm run app:run:ios`
- Or build with EAS and install via TestFlight/APK

### Building for Production

Use EAS build:

```bash
npm install -g eas-cli
cd apps/pappas-order-management
eas build:configure
eas build --platform ios
eas build --platform android
```

## App Structure

```
apps/pappas-order-management/
├── app/
│   ├── _layout.tsx          # Root layout with auth routing
│   ├── login.tsx            # Login screen
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Tab navigation layout
│   │   └── orders.tsx       # Orders list screen
│   └── order-detail.tsx     # Order detail and edit screen
├── lib/
│   ├── supabase.ts          # Supabase client
│   ├── orders.ts            # Order API functions
│   └── sounds.ts            # Sound notification utilities
├── types/
│   └── order.ts             # TypeScript type definitions
└── package.json
```

## Usage

1. **Login**: Sign in with your Supabase account credentials
2. **View Orders**: See all orders for today, filtered by status
3. **Update Status**: Tap quick action buttons or open order detail to change status
4. **Print**: Open order detail and tap "Print Order" button
5. **Notifications**: New orders automatically trigger sound notifications

## Order Status Flow

- **Pending** → Confirm Order
- **Confirmed** → Start Preparing
- **Preparing** → Mark Ready
- **Ready** → Complete Order
- **Completed** → Order finished
- **Cancelled** → Order cancelled (can be set from any status)

## Environment Variables

Required environment variables:
- `EXPO_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Troubleshooting

### Sound Notifications Not Working
- Ensure device volume is up
- Check app permissions for audio
- On iOS, ensure device is not in silent mode

### Real-time Updates Not Working
- Verify Supabase Realtime is enabled for the `orders` table
- Check network connection
- Ensure Supabase credentials are correct

### Print Not Working
- Ensure device has printing capabilities
- Check printer connection
- On iOS, ensure AirPrint is available

## Future Features

- Order search and filtering
- Customer information display
- Order history
- Multiple location support
- Custom sound settings
- Order statistics dashboard
