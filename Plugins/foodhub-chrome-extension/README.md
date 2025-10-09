# FoodHub Order Automation Chrome Extension

A Chrome extension that automates the ordering process on FoodHub websites by automatically clicking through menu categories and adding items to the cart.

## Features

- 🤖 **Automated Ordering**: Automatically clicks through menu categories and items
- 🛒 **Smart Cart Management**: Adds items to cart and tracks total value
- ⚙️ **Configurable Settings**: Adjust items per category and delay timing
- 📊 **Real-time Progress**: Live updates on automation progress
- 🎯 **Multi-site Support**: Works with various FoodHub implementations
- 🛑 **Stop Control**: Ability to stop automation at any time

## Installation

### Method 1: Load as Unpacked Extension (Development)

1. **Download the extension files** to your local machine
2. **Open Chrome** and navigate to `chrome://extensions/`
3. **Enable Developer mode** by toggling the switch in the top-right corner
4. **Click "Load unpacked"** and select the extension folder
5. **Pin the extension** to your toolbar for easy access

### Method 2: Manual Installation

1. **Clone or download** this repository
2. **Navigate to** `Plugins/foodhub-chrome-extension/`
3. **Follow Method 1** steps above

## Usage

### Basic Usage

1. **Navigate to a supported FoodHub website**:
   - `pappasoceancatch-ea.com.au`
   - Any `*.foodhub.com` site
   - Any `*.touch2success.com` site

2. **Click the extension icon** in your Chrome toolbar

3. **Configure settings** (optional):
   - Items per category: Number of items to process per category (default: 2)
   - Delay (ms): Time between actions in milliseconds (default: 2000)

4. **Click "🚀 Order All"** to start automation

5. **Monitor progress** in the extension popup

6. **Click "🛑 Stop"** to stop automation at any time

### Supported Websites

- Pappa's Ocean Catch (pappasoceancatch-ea.com.au)
- FoodHub.com websites
- Touch2Success powered sites

## Configuration

### Settings

- **Items per category**: 1-10 items (default: 2)
- **Delay (ms)**: 500-10000ms (default: 2000)

### How It Works

1. **Category Detection**: Automatically finds menu categories in the left sidebar
2. **Item Processing**: Clicks on each category to load menu items
3. **Modal Handling**: Opens item modals and finds "ADD" buttons
4. **Cart Management**: Adds items to cart and tracks progress
5. **Error Handling**: Gracefully handles errors and continues processing

## Technical Details

### File Structure

```
foodhub-chrome-extension/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup interface
├── popup.js              # Popup functionality
├── content.js            # Content script for automation
├── background.js         # Background service worker
├── icons/                # Extension icons
│   ├── icon.svg         # SVG icon source
│   ├── icon16.png       # 16x16 icon
│   ├── icon48.png       # 48x48 icon
│   └── icon128.png      # 128x128 icon
└── README.md            # This file
```

### Permissions

- `activeTab`: Access to current tab for automation
- `storage`: Save user settings
- `scripting`: Inject content scripts
- `host_permissions`: Access to FoodHub websites

### Selectors

The extension uses multiple selector strategies to work with different FoodHub implementations:

- **Categories**: `nav ul li a`, `[data-testid*="category"]`, `.category-item`
- **Menu Items**: `h4[data-class*="item_name"]`, `[data-testid*="item"]`
- **Add Buttons**: `[data-testid*="add_to_basket"]`, `[data-class*="add_to_basket"]`
- **Modals**: `[data-testid*="modal"]`, `.modal`, `[role="dialog"]`

## Troubleshooting

### Common Issues

1. **Extension not working on website**
   - Ensure you're on a supported FoodHub website
   - Check that the extension is enabled
   - Refresh the page and try again

2. **Automation stops unexpectedly**
   - Check browser console for errors
   - Verify website structure hasn't changed
   - Try reducing the delay setting

3. **Items not being added to cart**
   - Check if the website requires login
   - Verify the "ADD" button is clickable
   - Try increasing the delay setting

### Debug Mode

1. **Open Chrome DevTools** (F12)
2. **Go to Console tab**
3. **Look for `[FoodHub Bot]` messages**
4. **Check for error messages**

## Development

### Building Icons

To generate PNG icons from the SVG:

```bash
# Install ImageMagick or use online converter
convert icon.svg -resize 16x16 icons/icon16.png
convert icon.svg -resize 48x48 icons/icon48.png
convert icon.svg -resize 128x128 icons/icon128.png
```

### Testing

1. **Load extension** in developer mode
2. **Navigate to test website**
3. **Open extension popup**
4. **Start automation**
5. **Monitor console** for debug messages

## Safety & Ethics

⚠️ **Important Notes**:

- This extension is for **testing and automation purposes only**
- **Respect website terms of service**
- **Use responsibly** and don't overwhelm servers
- **Monitor your orders** to ensure accuracy
- **Not recommended for production use** without proper testing

## License

This project is for educational and testing purposes. Please respect the terms of service of any websites you use this extension with.

## Support

For issues or questions:

1. **Check the troubleshooting section** above
2. **Review browser console** for error messages
3. **Ensure you're on a supported website**
4. **Try adjusting the delay settings**

---

**Happy Ordering! 🍽️🤖**
