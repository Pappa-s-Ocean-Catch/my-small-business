# Address Autocomplete Setup Guide

## Recommended Services for Australian Addresses

### 1. Google Places API (Recommended)
**Free Tier**: $200/month credit (~40,000 autocomplete requests)

**Setup Steps:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Places API" and "Maps JavaScript API"
4. Create API credentials (API Key)
5. Restrict API key to your domain for security
6. Add to `.env.local`:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

**Pricing**: 
- Autocomplete: $2.83 per 1,000 requests (after free tier)
- Geocoding: $5.00 per 1,000 requests

**Pros:**
- Excellent Australian address coverage
- Includes geocoding (lat/lng)
- Widely used and well-documented
- Good free tier

**Cons:**
- Requires billing account setup
- Can get expensive at scale

---

### 2. Smart Address (Australia-Specific)
**Free Tier**: Unlimited lookups, 50 address details/day

**Setup Steps:**
1. Sign up at [smartaddress.au](https://smartaddress.au)
2. Get API key from dashboard
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_SMART_ADDRESS_API_KEY=your_api_key_here
   ```

**Pricing**: Premium $975/month (unlimited details)

**Pros:**
- Australia-specific, very accurate
- Generous free tier for lookups
- No billing required for free tier

**Cons:**
- Limited address details on free tier
- More expensive premium tier

---

### 3. AusAddress (Australia-Specific)
**Free Tier**: 1,000 searches/month

**Setup Steps:**
1. Sign up at [ausaddress.com](https://www.ausaddress.com)
2. Get API key
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_AUS_ADDRESS_API_KEY=your_api_key_here
   ```

**Pricing**: 
- Pro: $50/month (10,000 searches)
- Enterprise: $100/month (unlimited)

**Pros:**
- Australia-focused
- Simple pricing
- Good for small to medium volume

**Cons:**
- Lower free tier limit

---

### 4. Mapbox Geocoding API
**Free Tier**: 100,000 requests/month

**Setup Steps:**
1. Sign up at [mapbox.com](https://www.mapbox.com)
2. Get access token
3. Add to `.env.local`:
   ```
   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_token_here
   ```

**Pricing**: $0.50 per 1,000 requests after free tier

**Pros:**
- Very generous free tier
- Good global coverage including Australia
- Includes geocoding

**Cons:**
- Less Australia-specific than dedicated services

---

## Implementation

The `AddressAutocomplete` component is already implemented and ready to use. It currently uses Google Places API.

### To Use Google Places API:
1. Add your API key to `.env.local`:
   ```
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
2. The component will automatically load the Google Maps script
3. It's already integrated into `DeliveryAddressForm`

### To Switch to Another Service:
You'll need to modify the `AddressAutocomplete` component to use the alternative API. The component interface remains the same, so it's a drop-in replacement.

---

## Security Best Practices

1. **Restrict API Keys**: Always restrict your API keys to specific domains/IPs
2. **Use Environment Variables**: Never commit API keys to git
3. **Monitor Usage**: Set up billing alerts to avoid unexpected charges
4. **Rate Limiting**: Implement client-side rate limiting for free tiers

---

## Cost Estimation

For a small business with ~1,000 orders/month:
- **Google Places**: ~$0-5/month (well within free tier)
- **Smart Address**: Free (if staying within 50 details/day)
- **AusAddress**: Free (1,000 searches/month)
- **Mapbox**: Free (100k requests/month)

For higher volume (10,000+ orders/month):
- **Google Places**: ~$30-50/month
- **Smart Address**: $975/month (premium)
- **AusAddress**: $50-100/month
- **Mapbox**: ~$5-10/month

---

## Recommendation

**Start with Google Places API** for the best balance of:
- Free tier coverage
- Accuracy for Australian addresses
- Ease of implementation
- Geocoding included

Switch to **Mapbox** if you need more free requests, or **Smart Address/AusAddress** if you need Australia-specific features and don't mind the lower free tier limits.
