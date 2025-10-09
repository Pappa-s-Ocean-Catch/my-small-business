// Background service worker for FoodHub Chrome Extension
chrome.runtime.onInstalled.addListener((details) => {
    console.log('FoodHub Chrome Extension installed');
    
    // Set default settings
    chrome.storage.sync.set({
        itemsPerCategory: 2,
        delayMs: 2000,
        autoStart: false
    });
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    // This will open the popup, but we can also inject content script if needed
    console.log('Extension icon clicked on tab:', tab.url);
});

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message);
    
    switch (message.type) {
        case 'log':
            console.log(`[FoodHub Bot] ${message.message}`);
            break;
            
        case 'automationUpdate':
            // Forward to popup if it's open
            chrome.runtime.sendMessage(message).catch(() => {
                // Popup might not be open, that's okay
            });
            break;
            
        case 'automationComplete':
            console.log('Automation completed:', message.data);
            // Forward to popup
            chrome.runtime.sendMessage(message).catch(() => {});
            break;
            
        case 'automationError':
            console.error('Automation error:', message.error);
            // Forward to popup
            chrome.runtime.sendMessage(message).catch(() => {});
            break;
            
        default:
            console.log('Unknown message type:', message.type);
    }
    
    return true;
});

// Handle tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        // Check if it's a supported site
        const supportedDomains = [
            'foodhub.com',
            'touch2success.com',
            'pappasoceancatch-ea.com.au'
        ];
        
        const isSupported = supportedDomains.some(domain => tab.url.includes(domain));
        
        if (isSupported) {
            console.log('Supported FoodHub site detected:', tab.url);
            // Optionally inject content script or show page action
        }
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('FoodHub Chrome Extension started');
});
