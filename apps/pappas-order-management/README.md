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
- Expo CLI installed globally: `npm install -g expo-cli`
- Supabase project with orders table

### Installation

1. Navigate to the app directory:
```bash
cd apps/pappas-order-management
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the app root:
```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. Start the development server:
```bash
npm start
```

### Running on Device

- **iOS**: Scan the QR code with Camera app (iOS) or Expo Go app
- **Android**: Scan the QR code with Expo Go app
- **Web**: Press `w` in the terminal to open in browser

### Building for Production

For iOS:
```bash
expo build:ios
```

For Android:
```bash
expo build:android
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
