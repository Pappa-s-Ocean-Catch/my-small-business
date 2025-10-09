// Popup script for FoodHub Chrome Extension
document.addEventListener('DOMContentLoaded', function() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const debugBtn = document.getElementById('debugBtn');
        const copyLogsBtn = document.getElementById('copyLogsBtn');
        const statusText = document.getElementById('statusText');
        const itemsCount = document.getElementById('itemsCount');
        const totalValue = document.getElementById('totalValue');
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const scrollProgress = document.getElementById('scrollProgress');
        const apiStatus = document.getElementById('apiStatus');
        const downloadBtn = document.getElementById('downloadBtn');
        const logContainer = document.getElementById('logContainer');
        const scrollStepInput = document.getElementById('scrollStep');
        const maxScrollsInput = document.getElementById('maxScrolls');
        const delayMsInput = document.getElementById('delayMs');
    
    let isRunning = false;
    let currentTab = null;
    let cartData = null;
    
    // Initialize popup
    init();
    
    async function init() {
        try {
            // Get current tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            currentTab = tabs[0];
            
            // Check if we're on a supported site
            if (!isSupportedSite(currentTab.url)) {
                showError('This extension only works on FoodHub websites');
                return;
            }
            
            // Load saved settings
            await loadSettings();
            
            // Check if automation is already running
            await checkAutomationStatus();
            
            // Test if content script is loaded
            await testContentScript();
            
            // Check if we already have cart data
            await checkExistingCartData();
            
        } catch (error) {
            log('Error initializing: ' + error.message, 'error');
        }
    }
    
    function isSupportedSite(url) {
        const supportedDomains = [
            'foodhub.com',
            'touch2success.com',
            'pappasoceancatch-ea.com.au'
        ];
        
        return supportedDomains.some(domain => url.includes(domain));
    }
    
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['scrollStep', 'maxScrolls', 'delayMs']);
            scrollStepInput.value = result.scrollStep || 100;
            maxScrollsInput.value = result.maxScrolls || 50;
            delayMsInput.value = result.delayMs || 2000;
        } catch (error) {
            log('Error loading settings: ' + error.message, 'error');
        }
    }
    
    async function saveSettings() {
        try {
            await chrome.storage.sync.set({
                scrollStep: parseInt(scrollStepInput.value),
                maxScrolls: parseInt(maxScrollsInput.value),
                delayMs: parseInt(delayMsInput.value)
            });
        } catch (error) {
            log('Error saving settings: ' + error.message, 'error');
        }
    }
    
    async function checkAutomationStatus() {
        try {
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' });
            if (response && response.isRunning) {
                setRunning(true);
                updateStatus(response);
            }
        } catch (error) {
            // Extension not injected yet, that's okay
        }
    }
    
    async function testContentScript() {
        try {
            // Test if content script is loaded by sending a simple message
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getStatus' });
            if (response) {
                log('✅ Content script is loaded and ready', 'success');
            } else {
                log('⚠️ Content script may not be loaded properly', 'warning');
            }
        } catch (error) {
            log('⚠️ Content script not responding: ' + error.message, 'warning');
            log('💡 Try refreshing the page and reloading the extension', 'info');
        }
    }
    
        // Event listeners
        startBtn.addEventListener('click', startAutomation);
        stopBtn.addEventListener('click', stopAutomation);
        debugBtn.addEventListener('click', debugModal);
        copyLogsBtn.addEventListener('click', copyLogs);
        downloadBtn.addEventListener('click', downloadCartData);
    
    scrollStepInput.addEventListener('change', saveSettings);
    maxScrollsInput.addEventListener('change', saveSettings);
    delayMsInput.addEventListener('change', saveSettings);
    
        // Listen for messages from content script
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            try {
                if (message.type === 'automationUpdate') {
                    updateStatus(message.data);
                } else if (message.type === 'automationComplete') {
                    setRunning(false);
                    updateStatus(message.data);
                    if (message.data?.debugMode) {
                        log('🔧 DEBUG: Automation completed - Please copy logs for debugging!', 'info');
                    } else {
                        log('Automation completed successfully!', 'success');
                    }
                } else if (message.type === 'automationError') {
                    setRunning(false);
                    if (message.debugMode) {
                        log('🔧 DEBUG: Automation error - Please copy logs for debugging!', 'error');
                    } else {
                        log('Automation error: ' + (message.error || 'Unknown error'), 'error');
                    }
                } else if (message.type === 'log') {
                    log(message.message, message.level);
                } else if (message.type === 'scrollProgress') {
                    scrollProgress.textContent = `${message.currentScroll}/${message.maxScrolls}`;
                } else if (message.type === 'cartUpdate') {
                    handleCartUpdate(message.data);
                } else if (message.type === 'urlChange') {
                    const newUrl = message.data?.newUrl || message.newUrl || 'Unknown URL';
                    log(`🔄 Page navigated to: ${newUrl}`, 'info');
                    // Test if content script is still working on new page
                    testContentScript();
                } else if (message.type === 'modalHTML') {
                    const htmlLength = message.data?.html?.length || 0;
                    log(`🔍 Modal HTML captured for debugging (${htmlLength} chars)`, 'info');
                    // Store modal HTML for debugging
                    if (message.data?.html) {
                        window.lastModalHTML = message.data.html;
                    }
                }
            } catch (error) {
                log(`❌ Error handling message: ${error.message}`, 'error');
                console.error('Message handling error:', error, message);
            }
        });
    
    async function startAutomation() {
        if (isRunning) return;
        
        try {
            setRunning(true);
            log('Starting automation...', 'info');
            
            // Save settings
            await saveSettings();
            
            // Send start command to content script
            log('Sending start command to content script...', 'info');
            
            // Add timeout to prevent hanging
            const response = await Promise.race([
                chrome.tabs.sendMessage(currentTab.id, {
                    action: 'startAutomation',
                    config: {
                        scrollStep: parseInt(scrollStepInput.value),
                        maxScrolls: parseInt(maxScrollsInput.value),
                        delayMs: parseInt(delayMsInput.value)
                    }
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Content script not responding')), 5000)
                )
            ]);
            
            log('Received response from content script: ' + JSON.stringify(response), 'info');
            
            if (response && response.success) {
                log('Automation started successfully', 'success');
            } else {
                throw new Error(response?.error || 'Failed to start automation');
            }
            
        } catch (error) {
            setRunning(false);
            log('Error starting automation: ' + error.message, 'error');
        }
    }
    
    async function stopAutomation() {
        try {
            await chrome.tabs.sendMessage(currentTab.id, { action: 'stopAutomation' });
            setRunning(false);
            log('Automation stopped', 'warning');
        } catch (error) {
            log('Error stopping automation: ' + error.message, 'error');
        }
    }
    
    function setRunning(running) {
        isRunning = running;
        startBtn.disabled = running;
        stopBtn.disabled = !running;
        
        if (running) {
            statusText.textContent = 'Running...';
            startBtn.innerHTML = '<span class="spinner"></span> Running...';
        } else {
            statusText.textContent = 'Ready';
            startBtn.innerHTML = '🚀 Order All';
        }
    }
    
    function updateStatus(data) {
        if (!data) {
            log('⚠️ No data provided to updateStatus', 'warning');
            return;
        }
        
        if (data.status) {
            statusText.textContent = data.status;
        }
        
        if (data.itemsCount !== undefined) {
            itemsCount.textContent = data.itemsCount;
        }
        
        if (data.totalValue !== undefined) {
            totalValue.textContent = '$' + data.totalValue.toFixed(2);
        }
        
        if (data.progress !== undefined) {
            const progress = data.progress;
            progressBar.style.width = (progress.percentage || 0) + '%';
            progressText.textContent = (progress.current || 0) + '/' + (progress.total || 0);
        }
    }
    
    function log(message, level = 'info') {
        const logItem = document.createElement('div');
        logItem.className = 'log-item log-' + level;
        logItem.textContent = new Date().toLocaleTimeString() + ' - ' + message;
        
        logContainer.appendChild(logItem);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // Keep only last 50 log items
        while (logContainer.children.length > 50) {
            logContainer.removeChild(logContainer.firstChild);
        }
    }
    
    function handleCartUpdate(data) {
        cartData = data.cartData;
        
        // Update status display
        itemsCount.textContent = data.itemsCount;
        totalValue.textContent = '$' + data.totalValue.toFixed(2);
        apiStatus.textContent = '✅ API Connected';
        
        // Enable download button whenever we have cart data
        downloadBtn.disabled = false;
        downloadBtn.style.background = '#4CAF50'; // Green when enabled
        
        log('🛒 Cart updated: ' + data.itemsCount + ' items, $' + data.totalValue.toFixed(2), 'success');
    }
    
    async function checkExistingCartData() {
        try {
            // Try to get existing cart data from content script
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'getCartData' });
            if (response && response.cartData) {
                cartData = response.cartData;
                downloadBtn.disabled = false;
                downloadBtn.style.background = '#4CAF50';
                log('📥 Existing cart data found, download button enabled', 'info');
            }
        } catch (error) {
            // No existing cart data, that's fine
        }
    }
    
    function downloadCartData() {
        if (!cartData) {
            log('No cart data available to download', 'warning');
            return;
        }
        
        try {
            const dataStr = JSON.stringify(cartData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = 'cart-data-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
            link.click();
            
            URL.revokeObjectURL(url);
            log('📥 Cart data downloaded successfully', 'success');
        } catch (error) {
            log('Error downloading cart data: ' + error.message, 'error');
        }
    }
    
    async function debugModal() {
        if (isRunning) {
            log('Cannot debug while automation is running', 'warning');
            return;
        }
        
        try {
            log('🔧 Starting modal debug test...', 'info');
            
            // Send debug command to content script
            const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'debugModal' });
            
            if (response && response.success) {
                log('✅ Debug test completed successfully', 'success');
                log(`📊 Debug results: ${response.message}`, 'info');
            } else {
                log('❌ Debug test failed: ' + (response?.error || 'Unknown error'), 'error');
            }
            
        } catch (error) {
            log('Error running debug test: ' + error.message, 'error');
        }
    }
    
        function copyLogs() {
            try {
                const logContainer = document.getElementById('logContainer');
                const logText = Array.from(logContainer.children)
                    .map(item => item.textContent)
                    .join('\n');
                
                // Add additional debugging info
                const debugInfo = `
=== DEBUG INFO ===
Current URL: ${window.location.href}
Timestamp: ${new Date().toISOString()}
Extension Version: 1.0.0
User Agent: ${navigator.userAgent}
=== END DEBUG INFO ===

${logText}

=== MODAL HTML (if available) ===
${window.lastModalHTML ? window.lastModalHTML.substring(0, 5000) + '...' : 'No modal HTML captured'}
=== END MODAL HTML ===`;
                
                // Copy to clipboard
                navigator.clipboard.writeText(debugInfo).then(() => {
                    log('📋 Enhanced logs copied to clipboard!', 'success');
                }).catch(err => {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = debugInfo;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    log('📋 Enhanced logs copied to clipboard (fallback method)!', 'success');
                });
            } catch (error) {
                log('Error copying logs: ' + error.message, 'error');
            }
        }
    
    function showError(message) {
        statusText.textContent = 'Error';
        log(message, 'error');
        startBtn.disabled = true;
    }
});
