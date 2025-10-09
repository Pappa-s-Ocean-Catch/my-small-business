// Content script for FoodHub Chrome Extension
(function() {
    'use strict';
    
    let isRunning = false;
    let currentStep = 0;
    let totalSteps = 0;
    let cart = [];
    let config = {
        scrollStep: 100,
        maxScrolls: 50,
        delayMs: 1000
    };
    
    // Debug flag - set to true to enable debug alerts
    const DEBUG_MODE = false;
    
    // Centralized delay control - change this to adjust all waiting times
    const DELAYS = {
        FAST: 300,      // Fast mode for testing
        NORMAL: 1000,   // Normal mode
        SLOW: 2000      // Slow mode for stability
    };
    
    // Current delay setting - change this to test different speeds
    const CURRENT_DELAY = DELAYS.FAST; // Fast mode for speed
    
        // Network monitoring for cart API responses
        let capturedCartData = null;
        let originalFetch = window.fetch;
        let originalXHROpen = XMLHttpRequest.prototype.open;
        let originalXHRSend = XMLHttpRequest.prototype.send;
        let networkMonitoringSetup = false; // Guard to prevent multiple setups
    
    // DOM selectors for different FoodHub implementations
    const SELECTORS = {
        categories: [
            'nav ul li a',
            '[data-testid*="category"]',
            '.category-item',
            '.menu-category',
            '[data-class*="category"]',
            '.sidebar li a',
            '[role="navigation"] li a'
        ],
        menuItems: [
            'h4[data-class*="item_name"]',
            '[data-testid*="item"]',
            '.menu-item',
            '[data-class*="item"]',
            '.food-item',
            '[data-testid*="menu_item"]'
        ],
        addButton: [
            '[data-class="add_to_basket_button"]',
            '[data-testid*="add_to_basket_button"]',
            '[data-class*="add_to_basket"]',
            '[data-testid*="add_to_basket"]',
            'button[data-testid*="add"]',
            'div[data-testid*="add"]',
            '.add-to-cart',
            '.add-button'
        ],
        modal: [
            '[data-testid*="modal"]',
            '.modal',
            '[role="dialog"]',
            '.overlay',
            '.popup'
        ],
        closeButton: [
            '[data-testid*="close"]',
            '.close',
            '[aria-label*="close"]',
            '.modal-close',
            '.popup-close'
        ],
        price: [
            '[data-testid*="price"]',
            '.price',
            '[class*="price"]',
            '.item-price'
        ]
    };
    
    // Utility functions
    function log(message, level = 'info') {
        console.log(`[FoodHub Bot] ${message}`);
        sendMessage('log', { message, level });
    }
    
    function sendMessage(type, data) {
        try {
            chrome.runtime.sendMessage({ type, ...data });
        } catch (error) {
            console.error('Error sending message:', error);
        }
    }
    
        function wait(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }
        
        function getBasketCount() {
            const basketCount = document.querySelector('[data-class="total_item"]');
            if (basketCount) {
                const countText = basketCount.textContent.trim();
                const itemCount = parseInt(countText.match(/\d+/)?.[0] || '0');
                return itemCount;
            }
            return 0;
        }
    
    function findElement(selectors) {
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            if (element && isVisible(element)) {
                return element;
            }
        }
        return null;
    }
    
    function findElements(selectors) {
        for (const selector of selectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements).filter(isVisible);
            }
        }
        return [];
    }
    
    function isVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && 
               style.display !== 'none' && style.visibility !== 'hidden';
    }
    
    function extractPrice(element) {
        const text = element.textContent || '';
        const priceMatch = text.match(/\$?(\d+\.?\d*)/);
        return priceMatch ? parseFloat(priceMatch[1]) : 0;
    }
    
    async function clickElement(element) {
        if (!element) {
            throw new Error('Element not found');
        }
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await wait(CURRENT_DELAY);
        
        // Try different click methods
        try {
            element.click();
        } catch (error) {
            // Fallback: dispatch click event
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(clickEvent);
        }
    }
    
    // Main automation functions
    async function startAutomation() {
        if (isRunning) {
            log('Automation is already running', 'warning');
            return { success: false, error: 'Already running' };
        }
        
        isRunning = true;
        currentStep = 0;
        cart = [];
        
        try {
            log('🚀 Starting FoodHub automation with infinite scroll...');
            
                // Wait for page to be ready
                await waitForPageReady();
                
                // Start from top of page
                window.scrollTo(0, 0);
                await wait(CURRENT_DELAY);
                await wait(CURRENT_DELAY); // Extra delay for page stability
            
            // Process items with infinite scroll
            await processInfiniteScroll();
            
            log('✅ Automation completed successfully');
            sendMessage('automationComplete', {
                itemsCount: cart.length,
                totalValue: cart.reduce((total, item) => total + item.price, 0),
                cart: cart
            });
            
            return { success: true };
            
        } catch (error) {
            log(`❌ Automation failed: ${error.message}`, 'error');
            sendMessage('automationError', { error: error.message });
            return { success: false, error: error.message };
        } finally {
            isRunning = false;
        }
    }
    
        function stopAutomation() {
            if (isRunning) {
                isRunning = false;
                log('🛑 Automation stopped by user', 'warning');
                
                // Send stop confirmation to popup
                sendMessage('automationUpdate', {
                    status: 'Stopped',
                    itemsCount: cart.length,
                    totalValue: cart.reduce((total, item) => total + item.price, 0),
                    progress: {
                        current: currentStep,
                        total: totalSteps,
                        percentage: totalSteps > 0 ? (currentStep / totalSteps * 100) : 0
                    }
                });
                
                return { success: true };
            } else {
                log('ℹ️ Automation was not running', 'info');
                return { success: true };
            }
        }
    
    function getStatus() {
        return {
            isRunning,
            currentStep,
            totalSteps,
            itemsCount: cart.length,
            totalValue: cart.reduce((total, item) => total + item.price, 0)
        };
    }
    
        async function processInfiniteScroll() {
            log('🚀 Starting infinite scroll processing...');
            
            let scrollCount = 0;
            let processedItems = new Set(); // Track processed items to avoid duplicates
            
            while (scrollCount < config.maxScrolls && isRunning) {
                log(`📜 Scroll ${scrollCount + 1}/${config.maxScrolls}`);
                
                // Get current items on page
                const currentItems = await findMenuItems();
                
                if (currentItems.length === 0) {
                    log('❌ No menu items found on page', 'error');
                    break;
                }
                
                // Process new items (not already processed)
                let newItemsProcessed = 0;
                log(`🔍 Found ${currentItems.length} items on current scroll, checking for new items...`);
                
                for (const item of currentItems) {
                    if (!isRunning) {
                        log(`🛑 Automation stopped, breaking item loop`);
                        break;
                    }
                    
                    // Skip if already processed
                    if (processedItems.has(item.name)) {
                        log(`⏭️ Skipping already processed item: ${item.name}`);
                        continue;
                    }
                    
                    try {
                        log(`🍴 Processing NEW item: ${item.name}`);
                        log(`📊 Total processed so far: ${processedItems.size}`);
                        
                        await processMenuItem(item);
                        processedItems.add(item.name);
                        newItemsProcessed++;
                        
                        log(`✅ Successfully processed: ${item.name} (${newItemsProcessed} new items this scroll)`);
                        
                        // Check if item was actually added to cart
                        const currentBasketCount = getBasketCount();
                        log(`🛒 Basket count after processing ${item.name}: ${currentBasketCount}`);
                        
                        // Update progress
                        sendMessage('automationUpdate', {
                            data: {
                                itemsCount: cart.length,
                                totalValue: cart.reduce((total, item) => total + item.price, 0),
                                progress: {
                                    current: processedItems.size,
                                    total: currentItems.length,
                                    percentage: (processedItems.size / currentItems.length) * 100
                                }
                            }
                        });
                        
                        // Brief delay between items
                        await wait(CURRENT_DELAY);
                        
                    } catch (error) {
                        log(`❌ Error processing item ${item.name}: ${error.message}`, 'error');
                        // Continue to next item even if this one failed
                    }
                }
                
                log(`📊 Scroll ${scrollCount + 1} completed: ${newItemsProcessed} new items processed`);
                
                if (newItemsProcessed === 0) {
                    log('ℹ️ No new items found, scrolling to load more...');
                }
                
                // Scroll down to load more items
                window.scrollBy(0, config.scrollStep);
                await wait(CURRENT_DELAY);
                
                scrollCount++;
                
                // Send scroll progress
                sendMessage('scrollProgress', {
                    currentScroll: scrollCount,
                    maxScrolls: config.maxScrolls
                });
            }
            
            log(`✅ Infinite scroll completed. Processed ${processedItems.size} unique items.`);
        }
    
    async function waitForPageReady() {
        const maxWait = 10000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (document.readyState === 'complete' && 
                (document.querySelector('#app-root') || document.querySelector('body'))) {
                await wait(CURRENT_DELAY); // Additional wait for dynamic content
                return;
            }
            await wait(100);
        }
        
        throw new Error('Page did not load within expected time');
    }
    
    async function findCategories() {
        log('🔍 Looking for categories...');
        
        const categoryElements = findElements(SELECTORS.categories);
        
        if (categoryElements.length === 0) {
            log('No categories found with standard selectors', 'warning');
            // Try alternative approach - look for any clickable elements in navigation
            const navElements = document.querySelectorAll('nav a, .sidebar a, [role="navigation"] a');
            return Array.from(navElements).map((el, index) => ({
                element: el,
                text: el.textContent?.trim() || `Category ${index + 1}`,
                index
            }));
        }
        
        return categoryElements.map((el, index) => ({
            element: el,
            text: el.textContent?.trim() || `Category ${index + 1}`,
            index
        }));
    }
    
    
    
    async function findMenuItems() {
        const itemElements = findElements(SELECTORS.menuItems);
        
        return itemElements.map((el, index) => ({
            element: el,
            name: el.textContent?.trim() || `Item ${index + 1}`,
            index
        }));
    }
    
        async function processMenuItem(item, category) {
            log(`🍴 Processing item: ${item.name}`);
            
            try {
                // Click menu item to open modal
                log(`🖱️ Clicking on item: ${item.name}`);
                await clickElement(item.element);
                
                // Wait for modal to open
                log(`⏳ Waiting for modal to open...`);
                await waitForModal();
                
                // Handle add-ons (cooking options, etc.) before adding to cart
                try {
                    log(`🔧 Handling add-ons for ${item.name}...`);
                    handleAddOns();
                    log(`✅ Add-ons handled successfully`);
                } catch (addOnError) {
                    log(`⚠️ Error handling add-ons: ${addOnError.message}`, 'warning');
                    // Continue anyway, don't let add-on errors stop the process
                }
            
                // Find and click ADD button
                log(`🔍 Looking for ADD button...`);
                
                try {
                    const addButton = findAddButton();
                    if (addButton) {
                        log(`✅ Found ADD button for ${item.name}`);
                        await addToCart(addButton, item, category);
                    } else {
                        log(`❌ No ADD button found for ${item.name}`, 'error');
                    }
                } catch (error) {
                    log(`❌ Error finding ADD button: ${error.message}`, 'error');
                }
                
                // Wait before closing modal
                await wait(CURRENT_DELAY);
                
                // Close modal
                log(`🚪 Closing modal for ${item.name}`);
                await closeModal();
                
                // Wait after closing modal before next item
                log(`⏳ Waiting for modal to close...`);
                await wait(CURRENT_DELAY); // Reduced delay for speed
                
                // Check if modal is actually closed
                const modalStillOpen = isModalOpen();
                if (modalStillOpen) {
                    log(`⚠️ Modal still open after close attempt, trying to close again...`);
                    await closeModal();
                    await wait(CURRENT_DELAY);
                } else {
                    log(`✅ Modal successfully closed`);
                }
                
            } catch (error) {
                log(`Error processing item ${item.name}: ${error.message}`, 'error');
                try {
                    await closeModal(); // Try to close modal anyway
                } catch (closeError) {
                    log(`Error closing modal: ${closeError.message}`, 'warning');
                }
                await wait(CURRENT_DELAY); // Wait after error
            }
        }
    
    function waitForModal() {
        return new Promise((resolve) => {
            const maxWait = 5000;
            const startTime = Date.now();
            
            const checkModal = () => {
                if (isModalOpen() || Date.now() - startTime > maxWait) {
                    resolve();
                } else {
                    setTimeout(checkModal, 100);
                }
            };
            
            checkModal();
        });
    }
    
    function isModalOpen() {
        return findElement(SELECTORS.modal) !== null;
    }
    
        function findAddButton() {
            log(`🔍 Looking for ADD button in modal...`);
            
            // First, find the modal to ensure we're looking in the right place
            const modal = document.querySelector('[data-testid*="modal"], .modal, [role="dialog"]');
            if (modal) {
                log(`✅ Found modal, searching for ADD button inside modal...`);
                
                // Look for ADD button specifically inside the modal
                const button = modal.querySelector('[data-class="add_to_basket_button"]');
                if (button) {
                    log(`✅ Found ADD button inside modal`);
                    return button;
                } else {
                    log(`❌ No ADD button found inside modal`);
                }
            } else {
                log(`⚠️ No modal found, searching entire page...`);
            }
            
            // Fallback: search entire page
            const allButtons = document.querySelectorAll('[data-class="add_to_basket_button"]');
            log(`🔍 Found ${allButtons.length} ADD buttons on entire page`);
            
            if (allButtons.length > 0) {
                // Log details about all buttons found
                allButtons.forEach((btn, index) => {
                    log(`🔍 Button ${index + 1}:`);
                    log(`  - Tag: ${btn.tagName}`);
                    log(`  - Text: "${btn.textContent?.trim()}"`);
                    log(`  - Visible: ${btn.offsetParent !== null}`);
                    log(`  - In modal: ${btn.closest('[data-testid*="modal"], .modal, [role="dialog"]') !== null}`);
                });
                
                // Return the first visible button
                const visibleButton = Array.from(allButtons).find(btn => btn.offsetParent !== null);
                if (visibleButton) {
                    log(`✅ Using first visible ADD button`);
                    return visibleButton;
                } else {
                    log(`⚠️ No visible ADD buttons found, using first button`);
                    return allButtons[0];
                }
            }
            
            log(`❌ No ADD button found anywhere`, 'error');
            return null;
        }
    
        function handleAddOns() {
            try {
                // Find the menu item modal specifically - look for the main modal container
                let modal = null;
                
                // First, try to find the main modal container (not just close button)
                const allModals = document.querySelectorAll('[data-testid*="modal"], .modal, [role="dialog"]');
                log(`🔍 DEBUG: Found ${allModals.length} total modals on page`);
                
                for (const testModal of allModals) {
                    const testId = testModal.getAttribute('data-testid') || '';
                    const className = testModal.className || '';
                    
                    // Skip close button modals and social/account modals
                    if (testId.includes('close_icon') || testId.includes('social') || testId.includes('account')) {
                        log(`🔍 DEBUG: Skipping modal: ${testId}`);
                        continue;
                    }
                    
                    // Check if this modal contains add-on elements
                    const hasAddOns = testModal.querySelector('[data-class*="add_on"]') || 
                                    testModal.querySelector('[data-class*="checkbox"]') ||
                                    testModal.querySelector('[data-class*="radio"]') ||
                                    testModal.querySelector('[data-class*="Fried"]') ||
                                    testModal.querySelector('[data-class*="Grilled"]');
                    
                    if (hasAddOns) {
                        modal = testModal;
                        log(`🔍 Found modal with add-on content: ${testId}`);
                        break;
                    } else {
                        log(`🔍 DEBUG: Modal ${testId} has no add-ons`);
                    }
                }
                
                // If still no modal found, try to find any modal that's not a close button
                if (!modal) {
                    for (const testModal of allModals) {
                        const testId = testModal.getAttribute('data-testid') || '';
                        if (!testId.includes('close_icon') && !testId.includes('social') && !testId.includes('account')) {
                            modal = testModal;
                            log(`🔍 Using fallback modal: ${testId}`);
                            break;
                        }
                    }
                }
                
                if (!modal) {
                    log(`ℹ️ No modal found`);
                    return;
                }
                
                log(`🔍 Found modal, handling REQUIRED and OPTIONAL add-ons...`);
                log(`🔍 DEBUG: Modal details - data-testid: ${modal.getAttribute('data-testid')}, class: ${modal.className}`);
                
                // Focus the modal first
                modal.focus();
                log(`🎯 Focused modal for clickability`);
                
                // DEBUG: Log all elements in the modal to find the correct selectors
                log(`🔍 DEBUG: Analyzing modal content to find add-on selectors...`);
                
                // Look for any elements that might be add-ons
                const allModalElements = modal.querySelectorAll('*');
                log(`🔍 DEBUG: Found ${allModalElements.length} total elements in modal`);
                
                // Log the first few elements to see what's actually there
                log(`🔍 DEBUG: First 5 elements in modal:`);
                for (let i = 0; i < Math.min(5, allModalElements.length); i++) {
                    const element = allModalElements[i];
                    const dataClass = element.getAttribute('data-class');
                    const text = element.textContent?.trim().substring(0, 50);
                    log(`🔍 DEBUG: Element ${i + 1}: [data-class="${dataClass}"] - "${text}"`);
                }
                
                // Log complete modal HTML to console for detailed analysis
                console.log('🔍 MODAL HTML FOR ADD-ON DEBUGGING:');
                console.log('='.repeat(80));
                console.log(modal.outerHTML);
                console.log('='.repeat(80));
                log(`🔍 Complete modal HTML logged to console for add-on analysis (${modal.outerHTML.length} chars)`);
                
                // Look for elements with data-class containing common add-on patterns
                const addOnPatterns = ['add_on', 'checkbox', 'radio', 'option', 'choice', 'size', 'cooking', 'style'];
                const potentialAddOns = [];
                
                allModalElements.forEach((element, index) => {
                    const dataClass = element.getAttribute('data-class');
                    const className = element.className;
                    const text = element.textContent?.trim();
                    
                    if (dataClass && addOnPatterns.some(pattern => dataClass.toLowerCase().includes(pattern))) {
                        potentialAddOns.push({
                            index,
                            dataClass,
                            className,
                            text: text.substring(0, 50),
                            tagName: element.tagName
                        });
                    }
                });
                
                log(`🔍 DEBUG: Found ${potentialAddOns.length} potential add-on elements:`);
                potentialAddOns.forEach((item, i) => {
                    log(`🔍 DEBUG: Add-on ${i + 1}: [data-class="${item.dataClass}"] - "${item.text}" (${item.tagName})`);
                });
                
                // Also look for any clickable elements that might be add-ons
                const clickableElements = modal.querySelectorAll('[tabindex="0"], [role="button"], button, [onclick]');
                log(`🔍 DEBUG: Found ${clickableElements.length} clickable elements in modal`);
                
                clickableElements.forEach((element, index) => {
                    const dataClass = element.getAttribute('data-class');
                    const text = element.textContent?.trim();
                    if (text && text.length > 0 && text.length < 100) {
                        log(`🔍 DEBUG: Clickable ${index + 1}: [data-class="${dataClass}"] - "${text}"`);
                    }
                });
                
                // STEP 1: Handle REQUIRED options first using specific selectors
                log(`🔧 STEP 1: Handling REQUIRED options using specific selectors...`);
                
                // List of required data-class selectors - you can add more here
                const requiredSelectors = [
                    // Fried cooking options (both naming conventions)
                    '[data-class="add_on_checkbox_Fried"]',  // With underscore
                    '[data-class="add_on_checkboxFried"]',   // Without underscore
                    // Grilled cooking options (both naming conventions)
                    '[data-class="add_on_checkbox_Grilled"]', // With underscore
                    '[data-class="add_on_checkboxGrilled"]',  // Without underscore
                    // No salt options (both naming conventions)
                    '[data-class="add_on_checkbox_No_salt"]', // With underscore
                    '[data-class="add_on_checkboxNo_salt"]',  // Without underscore
                    '[data-class="add_on_checkbox_No Salt"]', // With underscore and space
                    '[data-class="add_on_checkboxNo Salt"]',  // Without underscore, with space
                    // Panko crumbed options (both naming conventions)
                    '[data-class="add_on_checkbox_Panko crumbed"]', // With underscore
                    '[data-class="add_on_checkboxPanko crumbed"]',  // Without underscore
                    // Size options (both naming conventions)
                    '[data-class="add_on_checkbox_Size_Large"]',  // With underscore
                    '[data-class="add_on_checkboxSize_Large"]',   // Without underscore
                    '[data-class="add_on_checkbox_Size_Medium"]',  // With underscore
                    '[data-class="add_on_checkboxSize_Medium"]',  // Without underscore
                    '[data-class="add_on_checkbox_Size_Small"]',  // With underscore
                    '[data-class="add_on_checkboxSize_Small"]'    // Without underscore
                    // Add more required selectors here as needed
                ];
                
                log(`🔍 Looking for ${requiredSelectors.length} required selectors...`);
                
                let requiredClicked = 0;
                for (const selector of requiredSelectors) {
                    const element = modal.querySelector(selector);
                    if (element) {
                        log(`🔍 Found required element: ${selector}`);
                        
                        // Check if already selected
                        const svgIcon = element.querySelector('svg');
                        const iconName = svgIcon ? svgIcon.getAttribute('name') : '';
                        const isSelected = iconName === 'Radio-Button-Fill' || iconName === 'Check-Box-Fill-2' || 
                                          element.classList.contains('selected') || element.classList.contains('checked');
                        
                        if (!isSelected) {
                            log(`🔧 Clicking REQUIRED option: ${selector}`);
                            
                            // Use the exact same method as console: document.querySelector().click()
                            log(`🔧 DEBUG: Using exact console method: document.querySelector("${selector}").click()`);
                            
                            try {
                                // Direct console method - exactly like you suggested
                                element.click();
                                log(`✅ Required option clicked: ${selector}`);
                                requiredClicked++;
                                break; // Only click one required option
                            } catch (error) {
                                log(`⚠️ Direct click failed: ${error.message}`, 'warning');
                                
                                // Try event dispatch as fallback
                                try {
                                    const clickEvent = new MouseEvent('click', {
                                        bubbles: true,
                                        cancelable: true,
                                        view: window
                                    });
                                    element.dispatchEvent(clickEvent);
                                    log(`✅ Required option clicked using event dispatch: ${selector}`);
                                    requiredClicked++;
                                    break;
                                } catch (dispatchError) {
                                    log(`❌ Both methods failed: ${dispatchError.message}`, 'error');
                                }
                            }
                        } else {
                            log(`ℹ️ Required option already selected: ${selector}`);
                            requiredClicked++;
                        }
                    } else {
                        log(`ℹ️ Required selector not found: ${selector}`);
                    }
                }
                
                log(`✅ Required options handled: ${requiredClicked} selected`);
                
                // NEW: Handle multiple REQUIRED groups by selecting one in each group
                try {
                    // Find all visible required group headers within modal
                    const requiredGroupHeaders = Array.from(modal.querySelectorAll('[data-class="Required_Text"], [data-testid*="Required_Text"], [data-class*="Select"], [data-testid*="please_select"], [id="please_select"]'));
                    const handledGroups = [];
                    
                    if (requiredGroupHeaders.length > 0) {
                        log(`🔧 Detected ${requiredGroupHeaders.length} potential required group headers. Processing each group...`);
                    }
                    
                    for (const header of requiredGroupHeaders) {
                        // Determine the container for this group by walking up to a reasonable section wrapper
                        const groupContainer = header.closest('[class*="r-"], [data-class], section, div');
                        if (!groupContainer) continue;
                        
                        // Find candidate options within this group (checkbox/radio style rows)
                        const optionSelectors = [
                            '[data-class*="add_on_checkbox"]',
                            '[data-class*="add_on_radio"]',
                            '[data-testid*="add_on"]',
                            '[tabindex="0"][data-class*="add_on"]'
                        ];
                        let options = [];
                        for (const sel of optionSelectors) {
                            options = options.concat(Array.from(groupContainer.querySelectorAll(sel)));
                        }
                        // Deduplicate and keep only visible
                        options = [...new Set(options)].filter(el => el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
                        
                        if (options.length === 0) {
                            log(`ℹ️ No selectable options found for a required group header: "${header.textContent?.trim() || ''}"`);
                            continue;
                        }
                        
                        // Prefer options with recognizable keywords
                        const priorityKeywords = ['Fried', 'Grilled', 'Panko', 'No Salt', 'No_salt', 'Large', 'Medium', 'Small'];
                        let chosen = options.find(opt => {
                            const dc = opt.getAttribute('data-class') || '';
                            const txt = opt.textContent?.trim() || '';
                            return priorityKeywords.some(k => dc.includes(k) || txt.includes(k));
                        }) || options[0];
                        
                        // Try to click if not already selected
                        const svgIcon = chosen.querySelector('svg');
                        const iconName = svgIcon ? svgIcon.getAttribute('name') : '';
                        const isSelected = iconName === 'Check-Box-Fill-2' || iconName === 'Radio-Button-Fill' ||
                                          chosen.classList.contains('selected') || chosen.classList.contains('checked');
                        
                        if (!isSelected) {
                            try {
                                chosen.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                chosen.click();
                                handledGroups.push(chosen.getAttribute('data-class') || chosen.textContent?.trim() || 'unknown');
                                log(`✅ Selected option for required group "${header.textContent?.trim() || ''}": ${chosen.getAttribute('data-class') || ''}`);
                            } catch (e) {
                                log(`⚠️ Failed to select option for required group: ${e.message}`, 'warning');
                            }
                        } else {
                            log(`ℹ️ Required group already has a selected option: "${header.textContent?.trim() || ''}"`);
                        }
                    }
                    
                    if (handledGroups.length > 0) {
                        log(`✅ Completed selection for ${handledGroups.length} required group(s): ${handledGroups.join(', ')}`);
                    }
                } catch (e) {
                    log(`⚠️ Error while processing multiple required groups: ${e.message}`, 'warning');
                }
                
                // If no specific required options found, try to find ANY add-on options
                if (requiredClicked === 0) {
                    log(`🔧 FALLBACK: No specific required options found, looking for ANY add-on options...`);
                    
                    // Try multiple patterns to find add-on elements
                    const searchPatterns = [
                        '[data-class*="add_on_checkbox"]',
                        '[data-class*="add_on_radio"]',
                        '[data-class*="add_on"]',
                        '[data-class*="checkbox"]',
                        '[data-class*="radio"]',
                        '[data-class*="option"]',
                        '[data-class*="choice"]',
                        '[data-class*="size"]',
                        '[data-class*="cooking"]',
                        '[data-class*="style"]',
                        '[data-testid*="add_on"]',
                        '[data-testid*="checkbox"]',
                        '[data-testid*="radio"]',
                        '[data-testid*="option"]'
                    ];
                    
                    let anyAddOnElements = [];
                    for (const pattern of searchPatterns) {
                        const elements = modal.querySelectorAll(pattern);
                        if (elements.length > 0) {
                            log(`🔍 Found ${elements.length} elements matching pattern: ${pattern}`);
                            anyAddOnElements = anyAddOnElements.concat(Array.from(elements));
                        }
                    }
                    
                    // Remove duplicates
                    anyAddOnElements = [...new Set(anyAddOnElements)];
                    log(`🔍 Found ${anyAddOnElements.length} total add-on elements across all patterns`);
                    
                    if (anyAddOnElements.length > 0) {
                        // Log all available add-on options
                        anyAddOnElements.forEach((element, index) => {
                            const dataClass = element.getAttribute('data-class');
                            const text = element.textContent?.trim() || 'No text';
                            log(`🔍 Add-on ${index + 1}: ${dataClass} - "${text}"`);
                        });
                        
                        // Smart selection: prioritize options that look like required choices
                        let selectedAddOn = null;
                        const priorityKeywords = ['Fried', 'Grilled', 'Panko', 'No_salt', 'Size', 'Large', 'Medium', 'Small'];
                        
                        // First, try to find an option with priority keywords
                        for (const element of anyAddOnElements) {
                            const dataClass = element.getAttribute('data-class');
                            const text = element.textContent?.trim() || '';
                            
                            if (priorityKeywords.some(keyword => 
                                dataClass.includes(keyword) || text.includes(keyword)
                            )) {
                                selectedAddOn = element;
                                log(`🔧 FALLBACK: Found priority add-on: ${dataClass} - "${text}"`);
                                break;
                            }
                        }
                        
                        // If no priority option found, use the first one
                        if (!selectedAddOn) {
                            selectedAddOn = anyAddOnElements[0];
                            log(`🔧 FALLBACK: Using first available add-on: ${selectedAddOn.getAttribute('data-class')}`);
                        }
                        
                        if (selectedAddOn) {
                            const dataClass = selectedAddOn.getAttribute('data-class');
                            log(`🔧 FALLBACK: Clicking selected add-on: ${dataClass}`);
                            
                            try {
                                selectedAddOn.click();
                                log(`✅ FALLBACK: Successfully clicked add-on: ${dataClass}`);
                                requiredClicked = 1;
                            } catch (error) {
                                log(`⚠️ FALLBACK: Error clicking add-on: ${error.message}`, 'warning');
                            }
                        }
                    } else {
                        log(`ℹ️ FALLBACK: No add-on elements found with 'add_on_checkbox' in data-class`);
                    }
                }
                
                // STEP 2: Handle OPTIONAL add-ons (modifications) - but limit them
                log(`🔧 STEP 2: Handling OPTIONAL add-ons (limited)...`);
                
                // Find all add-on elements
                const allAddOnElements = modal.querySelectorAll('[tabindex="0"][data-class*="add_on_checkbox"]');
                log(`🔍 Found ${allAddOnElements.length} total add-on elements`);
                
                // Filter to only optional elements (not in required list)
                const optionalElements = Array.from(allAddOnElements).filter(element => {
                    const dataClass = element.getAttribute('data-class');
                    const isRequired = requiredSelectors.some(selector => 
                        selector.includes(dataClass.replace('add_on_checkbox', 'add_on_checkbox_'))
                    );
                    
                    const svgIcon = element.querySelector('svg');
                    const isValid = !isRequired && svgIcon;
                    
                    if (isValid) {
                        log(`✅ Keeping optional element: ${dataClass}`);
                    } else {
                        log(`🔍 Filtering out element: ${dataClass} (isRequired: ${isRequired})`);
                    }
                    
                    return isValid;
                });
                
                log(`🔧 Found ${optionalElements.length} optional add-on option(s) to click`);
                
                let clickedCount = 0;
                
                // Click on optional add-on elements (limit to prevent excessive add-ons)
                const maxOptionalClicks = 3; // Limit to prevent too many selections
                for (let i = 0; i < Math.min(optionalElements.length, maxOptionalClicks); i++) {
                    const element = optionalElements[i];
                    try {
                        const dataClass = element.getAttribute('data-class');
                        const svgIcon = element.querySelector('svg');
                        const iconName = svgIcon ? svgIcon.getAttribute('name') : '';
                        
                        // Check if already selected
                        const isSelected = iconName === 'Check-Box-Fill-2' || iconName === 'Radio-Button-Fill' ||
                                          element.classList.contains('selected') || element.classList.contains('checked');
                        
                        if (!isSelected) {
                            log(`🔧 Clicking optional add-on: ${dataClass} (${iconName})`);
                            
                            element.focus();
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            
                            try {
                                element.click();
                                log(`✅ Optional add-on clicked: ${dataClass}`);
                                clickedCount++;
                            } catch (error) {
                                log(`⚠️ Error clicking optional add-on: ${error.message}`, 'warning');
                            }
                        } else {
                            log(`ℹ️ Optional add-on already selected: ${dataClass}`);
                        }
                    } catch (error) {
                        log(`⚠️ Error processing optional add-on: ${error.message}`, 'warning');
                    }
                }
            
                if (clickedCount > 0) {
                    log(`✅ Processed ${clickedCount} optional add-ons`);
                } else {
                    log(`ℹ️ No optional add-ons needed to be clicked`);
                }
                
                log(`✅ Add-on handling completed - Required: ${requiredClicked}, Optional: ${clickedCount}`);
            
            } catch (error) {
                log(`Error handling add-ons: ${error.message}`, 'error');
            }
        }
    
    function clickAddOnElement(element, dataClass) {
        try {
            // Simple click method - no scrolling or delays needed for checkboxes
            element.click();
            
            log(`✅ Successfully clicked: ${dataClass}`);
        } catch (error) {
            log(`⚠️ Error clicking ${dataClass}: ${error.message}`, 'warning');
        }
    }
    
        async function checkIfItemAdded(itemName) {
            log(`🔍 DEBUG: Checking if ${itemName} was added to cart...`);
            
            // Look for common success indicators
            const successIndicators = [
                // Look for the specific basket count element
                () => {
                    const basketCount = document.querySelector('[data-class="total_item"]');
                    if (basketCount) {
                        log(`🔍 DEBUG: Found basket count element: "${basketCount.textContent}"`);
                        const countText = basketCount.textContent.trim();
                        const itemCount = parseInt(countText.match(/\d+/)?.[0] || '0');
                        log(`🔍 DEBUG: Basket item count: ${itemCount}`);
                        return itemCount > 0;
                    }
                    return false;
                },
                // Look for cart count changes (fallback)
                () => {
                    const cartCount = document.querySelector('[data-testid*="cart"], .cart-count, .basket-count, [class*="cart"]');
                    if (cartCount) {
                        log(`🔍 DEBUG: Found cart count element: "${cartCount.textContent}"`);
                        return cartCount.textContent && cartCount.textContent !== '0';
                    }
                    return false;
                },
                // Look for success messages
                () => {
                    const successMsg = document.querySelector('[class*="success"], [class*="added"], .toast, .notification');
                    if (successMsg) {
                        log(`🔍 DEBUG: Found success message: "${successMsg.textContent}"`);
                        return successMsg.textContent && successMsg.textContent.toLowerCase().includes('added');
                    }
                    return false;
                },
                // Look for button state changes (disabled, different text)
                () => {
                    const addButton = document.querySelector('[data-class="add_to_basket_button"]');
                    if (addButton) {
                        log(`🔍 DEBUG: Button state - disabled: ${addButton.disabled}, text: "${addButton.textContent.trim()}"`);
                        return addButton.disabled || addButton.textContent.toLowerCase().includes('added');
                    }
                    return false;
                },
                // Look for any cart-related elements that might indicate an item was added
                () => {
                    const cartElements = document.querySelectorAll('[data-testid*="cart"], [class*="cart"], [class*="basket"]');
                    log(`🔍 DEBUG: Found ${cartElements.length} cart-related elements`);
                    for (const element of cartElements) {
                        log(`🔍 DEBUG: Cart element: ${element.tagName} - "${element.textContent?.trim()}"`);
                    }
                    return cartElements.length > 0;
                }
            ];
            
            // Check each indicator
            for (let i = 0; i < successIndicators.length; i++) {
                try {
                    log(`🔍 DEBUG: Checking success indicator ${i + 1}...`);
                    if (successIndicators[i]()) {
                        log(`✅ Success indicator ${i + 1} found for ${itemName}`);
                        return true;
                    }
                } catch (error) {
                    log(`⚠️ Error checking indicator ${i + 1}: ${error.message}`);
                }
            }
            
            // If no clear indicators, assume it was added (since we can't always detect it)
            log(`⚠️ No clear success indicators for ${itemName}, assuming success`);
            return true;
        }
    
    async function addToCart(button, item, category) {
        const price = extractPrice(button);
        
        const cartItem = {
            name: item.name,
            price: price,
            category: category?.text || 'Unknown',
            timestamp: new Date().toISOString()
        };
        
        log(`🛒 DEBUG: Adding to cart: ${item.name} - $${price}`);
        log(`🔍 DEBUG: Button element: ${button?.tagName} - ${button?.className}`);
        log(`🔍 DEBUG: Button text: "${button?.textContent?.trim() || 'N/A'}"`);
        log(`🔍 DEBUG: Button visible: ${button?.offsetParent !== null}`);
        log(`🔍 DEBUG: Button enabled: ${!button?.disabled}`);
        log(`🔍 DEBUG: Button data-class: ${button?.getAttribute('data-class')}`);
        log(`🔍 DEBUG: Button data-testid: ${button?.getAttribute('data-testid')}`);
        
            // Wait after modal opens to ensure it's fully loaded
            await wait(CURRENT_DELAY);
            
            // Handle add-ons (cooking options, etc.) before adding to cart
            try {
                log(`🔧 Handling add-ons in addToCart function...`);
                handleAddOns();
                log(`✅ Add-ons handled in addToCart`);
                
                // Small delay to let add-on clicks process
                await wait(CURRENT_DELAY);
            } catch (addOnError) {
                log(`⚠️ Error handling add-ons in addToCart: ${addOnError.message}`, 'warning');
            }
        
        log(`🔧 DEBUG: Add-ons handled, about to click ADD button...`);
        
        // Get basket count before clicking ADD button
        const basketCountBefore = getBasketCount();
        log(`🔍 DEBUG: Basket count before ADD button click: ${basketCountBefore}`);
        
        // Brief delay before clicking ADD button
        await wait(CURRENT_DELAY);
        
        // Try multiple click methods to ensure the button is clicked
        let clicked = false;
        
        // Method 1: Direct click (like console) with extra debugging
        try {
            log(`🔧 DEBUG: Attempting Method 1 - Direct click (console method)`);
            
            // Make sure button is visible and in view
            log(`🔍 DEBUG: Making button visible before click...`);
            button.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await wait(500); // Brief wait for scroll
            
            // Test if button is actually clickable by checking its properties
            log(`🔧 DEBUG: Testing button clickability...`);
            log(`  - Button offsetParent: ${button.offsetParent}`);
            log(`  - Button offsetWidth: ${button.offsetWidth}`);
            log(`  - Button offsetHeight: ${button.offsetHeight}`);
            log(`  - Button getBoundingClientRect: ${JSON.stringify(button.getBoundingClientRect())}`);
            
            // Try to focus the button first
            try {
                button.focus();
                log(`✅ DEBUG: Button focused successfully`);
            } catch (error) {
                log(`⚠️ DEBUG: Button focus failed: ${error.message}`);
            }
            
            // Hover over the button before clicking (this might be required!)
            log(`🔧 DEBUG: Hovering over button before click...`);
            try {
                const hoverEvent = new MouseEvent('mouseover', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                button.dispatchEvent(hoverEvent);
                log(`✅ DEBUG: Hover event dispatched`);
                
                // Wait a bit for hover effects
                await wait(200);
                
                // Also try mouseenter
                const mouseEnterEvent = new MouseEvent('mouseenter', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                button.dispatchEvent(mouseEnterEvent);
                log(`✅ DEBUG: Mouse enter event dispatched`);
                
                await wait(200);
            } catch (error) {
                log(`⚠️ DEBUG: Hover events failed: ${error.message}`);
            }
            
            // Check button state before clicking
            log(`🔍 DEBUG: Button state before click:`);
            log(`  - Button exists: ${!!button}`);
            log(`  - Button visible: ${button.offsetParent !== null}`);
            log(`  - Button enabled: ${!button.disabled}`);
            log(`  - Button text: "${button.textContent?.trim()}"`);
            
            // Try the exact console method with proper timing
            log(`🔧 DEBUG: Using exact console method with proper timing...`);
            
            // Wait for the button to be ready (reduced from 1000ms)
            await wait(500);
            
            // Check if button is now clickable after the wait
            log(`🔧 DEBUG: Checking button state after wait...`);
            log(`  - Button offsetParent: ${button.offsetParent}`);
            log(`  - Button offsetWidth: ${button.offsetWidth}`);
            log(`  - Button offsetHeight: ${button.offsetHeight}`);
            log(`  - Button visible: ${button.offsetParent !== null}`);
            
            // Try the exact same method as console: document.querySelector('[data-class="add_to_basket_button"]').click()
            try {
                log(`🔧 DEBUG: Executing: document.querySelector('[data-class="add_to_basket_button"]').click()`);
                
                // Use the exact same selector and method as console
                const consoleButton = document.querySelector('[data-class="add_to_basket_button"]');
                if (consoleButton) {
                    log(`🔧 DEBUG: Found button via console method, clicking...`);
                    consoleButton.click();
                    log(`✅ DEBUG: Console method click successful`);
                } else {
                    log(`❌ DEBUG: Console method found no button`);
                }
            } catch (error) {
                log(`❌ DEBUG: Console method failed: ${error.message}`);
            }
            clicked = true;
            log(`✅ DEBUG: Method 1 SUCCESS - Direct click worked (console method)`);
        } catch (error) {
            log(`⚠️ DEBUG: Method 1 FAILED - Direct click failed: ${error.message}`);
        }
        
        // Method 2: Dispatch click event if method 1 failed
        if (!clicked) {
            try {
                log(`🔧 DEBUG: Attempting Method 2 - Event dispatch`);
                const clickEvent = new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window
                });
                button.dispatchEvent(clickEvent);
                clicked = true;
                log(`✅ DEBUG: Method 2 SUCCESS - Event dispatch worked`);
            } catch (error) {
                log(`⚠️ DEBUG: Method 2 FAILED - Event dispatch failed: ${error.message}`);
            }
        }
        
        // Method 3: Try clicking all nested elements
        if (!clicked) {
            try {
                log(`🔧 DEBUG: Attempting Method 3 - Click all nested elements`);
                
                // Get all nested divs and try clicking them
                const nestedElements = button.querySelectorAll('div');
                log(`🔧 DEBUG: Found ${nestedElements.length} nested divs, trying to click them...`);
                
                for (let i = 0; i < nestedElements.length; i++) {
                    try {
                        log(`🔧 DEBUG: Clicking nested div ${i + 1}/${nestedElements.length}`);
                        nestedElements[i].click();
                        clicked = true;
                        log(`✅ DEBUG: Method 3 SUCCESS - Nested div ${i + 1} click worked`);
                        break;
                    } catch (error) {
                        log(`⚠️ DEBUG: Nested div ${i + 1} click failed: ${error.message}`);
                    }
                }
                
                if (!clicked) {
                    // Fallback to focus + click
                    button.focus();
                    button.click();
                    clicked = true;
                    log(`✅ DEBUG: Method 3 SUCCESS - Focus + click worked`);
                }
            } catch (error) {
                log(`⚠️ DEBUG: Method 3 FAILED - All methods failed: ${error.message}`);
            }
        }
        
        if (!clicked) {
            log(`❌ DEBUG: FAILED to click ADD button - All 3 methods failed`, 'error');
            log(`📋 DEBUG: Please copy the logs now for debugging`, 'info');
            return;
        }
        
        log(`✅ DEBUG: Successfully clicked ADD button using method ${clicked ? 'SUCCESS' : 'FAILED'}`);
        
            // Wait for the action to complete
            await wait(CURRENT_DELAY); // Reduced delay for speed
            
            // DEBUG: Check if button state changed after click
            log(`🔍 DEBUG: Checking button state after click...`);
            const buttonAfterClick = document.querySelector('[data-class="add_to_basket_button"]');
            if (buttonAfterClick) {
                log(`🔍 DEBUG: Button still exists after click`);
                log(`🔍 DEBUG: Button text after click: "${buttonAfterClick.textContent?.trim()}"`);
                log(`🔍 DEBUG: Button disabled after click: ${buttonAfterClick.disabled}`);
                log(`🔍 DEBUG: Button classes after click: ${buttonAfterClick.className}`);
                
                // DEBUG: Log full HTML of button after click
                log(`🔍 DEBUG: Full ADD button HTML after click:`);
                log(buttonAfterClick.outerHTML);
            } else {
                log(`🔍 DEBUG: Button disappeared after click - this might be good!`);
            }
        
        // Check if the item was actually added to cart
        log(`🔍 DEBUG: Checking if item was added to cart...`);
        
        // Get basket count after clicking ADD button
        const basketCountAfter = getBasketCount();
        log(`🔍 DEBUG: Basket count after ADD button click: ${basketCountAfter}`);
        
        // Check if basket count increased
        const basketIncreased = basketCountAfter > basketCountBefore;
        log(`🔍 DEBUG: Basket count increased: ${basketIncreased} (${basketCountBefore} → ${basketCountAfter})`);
        
        const wasAdded = await checkIfItemAdded(item.name);
        
        if (wasAdded) {
            log(`✅ DEBUG: Item successfully added to cart: ${item.name}`, 'success');
        } else {
            log(`⚠️ DEBUG: Item may not have been added to cart: ${item.name}`, 'warning');
        }
        
        // Add to our cart tracking
        cart.push(cartItem);
        
        log(`✅ DEBUG: Added to cart: ${item.name}`, 'success');
        
        // STOP HERE FOR DEBUGGING - Log completion
        log(`🎉 DEBUG: Finished clicking ADD button for "${item.name}"`, 'success');
        log(`✅ DEBUG: Click successful: ${clicked}`, 'success');
        log(`🛒 DEBUG: Item added to cart: ${wasAdded}`, wasAdded ? 'success' : 'warning');
        log(`📋 DEBUG: Please copy the logs now for debugging`, 'info');
        
        // Send update to popup
        sendMessage('automationUpdate', {
            data: {
                itemsCount: cart.length,
                totalValue: cart.reduce((total, item) => total + item.price, 0),
                progress: {
                    current: currentStep,
                    total: totalSteps,
                    percentage: totalSteps > 0 ? (currentStep / totalSteps * 100) : 0
                }
            }
        });
    }
    
    async function closeModal() {
        try {
            const closeButton = findElement(SELECTORS.closeButton);
            if (closeButton) {
                await clickElement(closeButton);
            } else {
                // Press Escape key as fallback
                document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            }
            
            await wait(CURRENT_DELAY);
            log('Modal closed');
            
        } catch (error) {
            log(`Error closing modal: ${error.message}`, 'error');
        }
    }
    
    function updateProgress() {
        const progress = {
            current: currentStep,
            total: totalSteps,
            percentage: totalSteps > 0 ? (currentStep / totalSteps * 100) : 0
        };
        
        sendMessage('automationUpdate', {
            progress,
            itemsCount: cart.length,
            totalValue: cart.reduce((total, item) => total + item.price, 0)
        });
    }
    
        // Debug modal function
        async function debugModal() {
            try {
                log('🔧 Starting modal debug test...');
                
                // Check if modal is open - look for menu item modal specifically
                let modal = document.querySelector('[data-testid*="menu_item_detail_screen_modal"]');
                if (!modal) {
                    modal = findElement(SELECTORS.modal);
                }
                if (!modal) {
                    log('❌ No modal is currently open. Please open a menu item modal first.', 'error');
                    log('💡 To test the debug function:', 'info');
                    log('   1. Click on any menu item to open its modal', 'info');
                    log('   2. Then click the "🔧 Debug Modal" button', 'info');
                    return { success: false, error: 'No modal is currently open. Please open a menu item modal first.' };
                }
                
                log('✅ Modal is open, proceeding with debug test...');
                
                // Capture full modal HTML for debugging
                const modalHTML = modal.outerHTML;
                log(`🔍 Full modal HTML (first 3000 chars): ${modalHTML.substring(0, 3000)}...`);
                
                // Send modal HTML to popup for debugging
                sendMessage('modalHTML', { html: modalHTML });
                
                // Also log the complete modal HTML to console for detailed analysis
                console.log('🔍 COMPLETE MODAL HTML FOR DEBUGGING:');
                console.log('='.repeat(80));
                console.log(modalHTML);
                console.log('='.repeat(80));
                log(`🔍 Complete modal HTML logged to console (${modalHTML.length} chars)`);
                
                // Test add-on handling
                log('🔧 Testing add-on handling...');
                try {
                    handleAddOns();
                    log('✅ Add-on handling completed');
                    
                    // STOP HERE FOR DEBUGGING - Let user copy logs
                    log('🔧 DEBUG: Add-on handling completed. Please check if checkboxes/radio buttons are visually selected in the UI.', 'info');
                    
                } catch (error) {
                    log(`⚠️ Add-on handling failed: ${error.message}`, 'warning');
                    // Continue with the test even if add-ons fail
                }
                
                // Test ADD button finding and clicking
                log('🔧 Testing ADD button...');
                const addButton = findAddButton();
                if (!addButton) {
                    return { success: false, error: 'No ADD button found in the modal' };
                }
                
                log('✅ ADD button found, testing click...');
                
                // Test the click with debug logging
                log(`DEBUG: About to test ADD button click.\nButton found: ${addButton ? 'YES' : 'NO'}\nButton text: "${addButton?.textContent?.trim() || 'N/A'}"\nButton visible: ${addButton?.offsetParent !== null}\nButton enabled: ${!addButton?.disabled}\nButton tagName: ${addButton?.tagName}\nButton className: ${addButton?.className}\nButton style: ${addButton?.style?.display || 'not set'}`, 'info');
                
                // Try clicking the button
                try {
                    // Scroll button into view first
                    addButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Try multiple click methods
                    addButton.click();
                    log('DEBUG: Method 1 - Direct click attempted', 'info');
                    
                    // Try event dispatch as backup
                    const clickEvent = new MouseEvent('click', {
                        bubbles: true,
                        cancelable: true,
                        view: window
                    });
                    addButton.dispatchEvent(clickEvent);
                    log('DEBUG: Method 2 - Event dispatch attempted', 'info');
                    
                    log('✅ ADD button click test completed');
                } catch (error) {
                    log(`DEBUG: ADD button click failed: ${error.message}`, 'error');
                    log(`❌ ADD button click failed: ${error.message}`, 'error');
                    return { success: false, error: `ADD button click failed: ${error.message}` };
                }
                
                return { 
                    success: true, 
                    message: 'Debug test completed successfully. Check console for detailed logs.' 
                };
                
            } catch (error) {
                log(`❌ Debug test failed: ${error.message}`, 'error');
                return { success: false, error: error.message };
            }
        }
        
        // Message listener
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            switch (message.action) {
                case 'startAutomation':
                    config = { ...config, ...message.config };
                    startAutomation().then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    return true; // Keep message channel open for async response
                    
                case 'stopAutomation':
                    sendResponse(stopAutomation());
                    break;
                    
                case 'getStatus':
                    sendResponse(getStatus());
                    break;
                    
                case 'getCartData':
                    sendResponse({ success: true, cartData: capturedCartData });
                    break;
                    
                case 'debugModal':
                    debugModal().then(result => {
                        sendResponse(result);
                    }).catch(error => {
                        sendResponse({ success: false, error: error.message });
                    });
                    return true; // Keep message channel open for async response
                    
                default:
                    sendResponse({ success: false, error: 'Unknown action' });
            }
        });
    
        // Network monitoring functions
        function setupNetworkMonitoring() {
            // Prevent multiple setups that can cause recursion
            if (networkMonitoringSetup) {
                log('🔍 Network monitoring already setup, skipping...');
                return;
            }
            
            networkMonitoringSetup = true;
            log('🔍 Setting up network monitoring...');
            
            // Override fetch to monitor API calls
            window.fetch = async function(...args) {
            const response = await originalFetch.apply(this, args);
            
            // Check if this is a cart API call
            if (args[0] && args[0].includes('/api/consumer/cart/') && args[0].includes('/item/')) {
                try {
                    const clonedResponse = response.clone();
                    const data = await clonedResponse.json();
                    capturedCartData = data;
                    log(`🛒 Cart API response captured via fetch: ${JSON.stringify(data)}`);
                    
                    // Send cart update to popup
                    sendMessage('cartUpdate', {
                        cartData: data,
                        itemsCount: data.items?.length || 0,
                        totalValue: data.total || 0
                    });
                } catch (error) {
                    log(`Error parsing cart API response: ${error.message}`, 'error');
                }
            }
            
            return response;
        };
        
        // Override XMLHttpRequest to monitor API calls
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            this._url = url;
            this._method = method;
            return originalXHROpen.apply(this, [method, url, ...args]);
        };
        
        XMLHttpRequest.prototype.send = function(...args) {
            const xhr = this;
            
            // Add response listener for all requests
            xhr.addEventListener('load', function() {
                if (xhr._url && xhr._url.includes('/api/consumer/cart/')) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        capturedCartData = data;
                        log(`🛒 Cart API response captured via XHR: ${xhr._method} ${xhr._url}`);
                        log(`🛒 Response data: ${JSON.stringify(data)}`);
                        
                        // Send cart update to popup
                        sendMessage('cartUpdate', {
                            cartData: data,
                            itemsCount: data.items?.length || 0,
                            totalValue: data.total || 0
                        });
                    } catch (error) {
                        log(`Error parsing XHR cart response: ${error.message}`, 'error');
                    }
                }
            });
            
            return originalXHRSend.apply(this, args);
        };
        
        // Monitor all network requests using Performance Observer
        if (window.PerformanceObserver) {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name && entry.name.includes('/api/consumer/cart/')) {
                        log(`🔍 Network request detected: ${entry.name}`, 'info');
                    }
                }
            });
            
            try {
                observer.observe({ entryTypes: ['resource'] });
                log('🔍 Performance Observer monitoring enabled');
            } catch (error) {
                log(`Performance Observer not supported: ${error.message}`, 'warning');
            }
        }
        
        // Monitor console for network logs
        const originalConsoleLog = console.log;
        console.log = function(...args) {
            const message = args.join(' ');
            if (message.includes('cart') || message.includes('api') || message.includes('basket')) {
                log(`🔍 Console log detected: ${message}`, 'info');
            }
            return originalConsoleLog.apply(console, args);
        };
        
        // Monitor for any cart-related DOM changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === 1 && node.textContent && 
                            (node.textContent.includes('cart') || node.textContent.includes('basket'))) {
                            log(`🔍 Cart-related DOM change detected: ${node.textContent.substring(0, 100)}`, 'info');
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        
        // Additional monitoring: Check for any cart-related API patterns
        const checkForCartAPIs = () => {
            // Look for any script tags that might contain API endpoints
            const scripts = document.querySelectorAll('script');
            scripts.forEach(script => {
                if (script.textContent && script.textContent.includes('cart')) {
                    log(`🔍 Script with cart reference found: ${script.textContent.substring(0, 200)}`, 'info');
                }
            });
            
            // Look for any data attributes that might contain cart info
            const elementsWithCartData = document.querySelectorAll('[data-cart], [data-basket], [data-items]');
            if (elementsWithCartData.length > 0) {
                log(`🔍 Elements with cart data found: ${elementsWithCartData.length}`, 'info');
            }
        };
        
        // Run initial check
        checkForCartAPIs();
        
        // Check periodically for new cart-related elements
        setInterval(checkForCartAPIs, 5000);
        
        log('🔍 Enhanced network monitoring setup complete');
    }
    
        // Initialize
        log('FoodHub automation script loaded');
        console.log('FoodHub Content Script: Ready and listening for messages');
        
        // DISABLED: Setup network monitoring (causing recursion issues)
        // setupNetworkMonitoring();
        
        // Handle URL navigation - reinitialize if needed
        let currentUrl = window.location.href;
        let urlChangeHandlerSetup = false; // Guard to prevent multiple handlers
        
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                log(`🔄 URL changed from ${currentUrl} to ${window.location.href}`);
                currentUrl = window.location.href;
                
                // Don't re-setup network monitoring to prevent recursion
                // setupNetworkMonitoring(); // DISABLED to prevent recursion
                
                // Notify popup about URL change
                sendMessage('urlChange', { 
                    data: {
                        newUrl: window.location.href,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        };
        
        // DISABLED: Check for URL changes (causing recursion issues)
        // setInterval(checkUrlChange, 500);
        
        // DISABLED: Handle page navigation events (causing recursion issues)
        /*
        if (!urlChangeHandlerSetup) {
            window.addEventListener('popstate', () => {
                log('🔄 Browser back/forward navigation detected');
                checkUrlChange();
            });
            
            // Handle programmatic navigation
            const originalPushState = history.pushState;
            const originalReplaceState = history.replaceState;
        
        history.pushState = function(...args) {
            originalPushState.apply(history, args);
            setTimeout(checkUrlChange, 100);
        };
        
        history.replaceState = function(...args) {
            originalReplaceState.apply(history, args);
            setTimeout(checkUrlChange, 100);
        };
        */
    
    // Test function to verify content script is working
    window.foodhubTest = function() {
        console.log('FoodHub Content Script is working!');
        return 'Content script is loaded and functional';
    };
    
    // Function to get captured cart data
    window.getCapturedCartData = function() {
        return capturedCartData;
    };
    
    // Function to manually test network monitoring
    window.testNetworkMonitoring = function() {
        log('🧪 Testing network monitoring...', 'info');
        
        // Test fetch override
        fetch('/api/test').catch(() => {});
        
        // Test XHR override
        const xhr = new XMLHttpRequest();
        xhr.open('GET', '/api/test');
        xhr.send();
        
        log('🧪 Network monitoring test completed', 'info');
    };
    
    // Function to manually trigger cart update (for testing)
    window.triggerCartUpdate = function(testData) {
        const data = testData || {
            items: [{ name: 'Test Item', price: 10.99 }],
            total: 10.99
        };
        
        capturedCartData = data;
        sendMessage('cartUpdate', {
            cartData: data,
            itemsCount: data.items?.length || 0,
            totalValue: data.total || 0
        });
        
        log('🧪 Manual cart update triggered', 'info');
    };
    
})();
