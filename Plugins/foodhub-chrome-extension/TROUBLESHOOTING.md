# FoodHub Extension Troubleshooting Guide

## Common Issues and Solutions

### 1. "A listener indicated an asynchronous response by returning true, but the message channel closed before a response was received"

This error means the content script isn't responding to the popup. Here's how to fix it:

#### **Solution 1: Reload the Extension**
1. Go to `chrome://extensions/`
2. Find "FoodHub Order Automation"
3. Click the **reload** button (🔄)
4. Refresh the FoodHub website page
5. Try the extension again

#### **Solution 2: Check Content Script Loading**
1. Open the FoodHub website
2. Press `F12` to open Developer Tools
3. Go to the **Console** tab
4. Look for: `"FoodHub Content Script: Ready and listening for messages"`
5. If you don't see this message, the content script isn't loading

#### **Solution 3: Verify Website URL**
Make sure you're on a supported website:
- `https://pappasoceancatch-ea.com.au/`
- `https://*.foodhub.com/*`
- `https://*.touch2success.com/*`

#### **Solution 4: Check Extension Permissions**
1. Go to `chrome://extensions/`
2. Click **Details** on the FoodHub extension
3. Make sure **"Allow access to file URLs"** is enabled
4. Check that the extension has permission for the current website

### 2. Extension Button Not Working

#### **Check Extension Status**
1. Click the extension icon in the toolbar
2. Look for status messages in the popup
3. If you see "Content script not responding", follow Solution 1 above

#### **Verify Page Load**
1. Make sure the FoodHub page is fully loaded
2. Wait for all content to appear
3. Try scrolling down to see if items load properly

### 3. Automation Not Starting

#### **Check Console for Errors**
1. Open Developer Tools (`F12`)
2. Go to **Console** tab
3. Look for any red error messages
4. Common errors:
   - `"No categories found"` - Wrong page or page not loaded
   - `"No items found"` - Menu items not visible
   - `"Element not found"` - Website structure changed

#### **Test Settings**
1. Try reducing the delay (e.g., 1000ms)
2. Increase scroll step (e.g., 200px)
3. Reduce max scrolls (e.g., 20)

### 4. Items Not Being Added to Cart

#### **Check Modal Detection**
1. Manually click on a menu item
2. See if a modal opens with an "ADD" button
3. If no modal appears, the website structure may have changed

#### **Verify Button Selectors**
The extension looks for buttons with:
- `data-class="add_to_basket_button"`
- `data-testid*="add_to_basket_button"`

If these have changed, the extension needs to be updated.

### 5. Extension Not Loading on Website

#### **Check Manifest Permissions**
1. Go to `chrome://extensions/`
2. Click **Details** on the extension
3. Scroll down to **Site access**
4. Make sure it's set to **"On all sites"** or includes your website

#### **Manual Injection (If Needed)**
If the content script still doesn't load:
1. Go to `chrome://extensions/`
2. Click **Details** on the extension
3. Enable **"Allow access to file URLs"**
4. Refresh the website

### 6. Performance Issues

#### **Reduce Load**
1. Lower the scroll step (e.g., 50px)
2. Increase the delay between actions (e.g., 3000ms)
3. Reduce max scrolls (e.g., 20)

#### **Monitor Progress**
1. Watch the popup for progress updates
2. Check the console for any error messages
3. Use the "Stop" button if needed

## Debug Information

### **Check Extension Logs**
1. Open Developer Tools (`F12`)
2. Go to **Console** tab
3. Look for messages starting with `"FoodHub"`

### **Check Popup Logs**
1. Open the extension popup
2. Look at the log section at the bottom
3. Check for any error messages

### **Test Content Script**
1. Open Developer Tools (`F12`)
2. Go to **Console** tab
3. Type: `window.foodhubTest()`
4. Should return: `"Content script is loaded and functional"`

## Still Having Issues?

1. **Refresh everything**: Extension + Website
2. **Check browser console** for error messages
3. **Try on a different FoodHub website** to test
4. **Reduce settings** to minimum values
5. **Check if the website has changed** its structure

## Quick Fix Checklist

- [ ] Extension reloaded in `chrome://extensions/`
- [ ] Website page refreshed
- [ ] Developer Tools console checked for errors
- [ ] Extension popup shows "Content script is loaded and ready"
- [ ] Website URL is supported
- [ ] Page is fully loaded before starting automation
