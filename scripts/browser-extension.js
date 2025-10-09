/**
 * Browser Extension Script for Menu Automation
 * 
 * This script can be injected into the Pappa's Ocean Catch website
 * to automate the menu ordering process.
 */

(function() {
    'use strict';
    
    // Configuration
    const CONFIG = {
        AUTO_START: true,
        DELAY_BETWEEN_ACTIONS: 2000,
        MAX_ITEMS_PER_CATEGORY: 2,
        DEBUG: true
    };
    
    // State management
    let isRunning = false;
    let cart = [];
    let currentStep = 0;
    let totalSteps = 0;
    
    // DOM selectors
    const SELECTORS = {
        categories: [
            'nav ul li a',
            '[data-testid*="category"]',
            '.category-item',
            '.menu-category'
        ],
        menuItems: [
            'h4[data-class*="item_name"]',
            '[data-testid*="item"]',
            '.menu-item'
        ],
        addButton: [
            '[data-testid*="add_to_basket"]',
            '[data-class*="add_to_basket"]',
            'button:contains("ADD")',
            'div:contains("ADD")'
        ],
        modal: [
            '[data-testid*="modal"]',
            '.modal',
            '[role="dialog"]'
        ],
        closeButton: [
            '[data-testid*="close"]',
            '.close',
            '[aria-label*="close"]'
        ]
    };
    
    // Utility functions
    function log(message, type = 'info') {
        if (!CONFIG.DEBUG) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[MenuBot ${timestamp}]`;
        
        switch (type) {
            case 'error':
                console.error(`${prefix} ❌ ${message}`);
                break;
            case 'success':
                console.log(`${prefix} ✅ ${message}`);
                break;
            case 'warning':
                console.warn(`${prefix} ⚠️ ${message}`);
                break;
            default:
                console.log(`${prefix} ${message}`);
        }
    }
    
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
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
        return rect.width > 0 && rect.height > 0 && 
               getComputedStyle(element).display !== 'none';
    }
    
    function extractPrice(element) {
        const text = element.textContent || '';
        const priceMatch = text.match(/\$?(\d+\.?\d*)/);
        return priceMatch ? parseFloat(priceMatch[1]) : 0;
    }
    
    // Main automation functions
    async function startAutomation() {
        if (isRunning) {
            log('Automation is already running', 'warning');
            return;
        }
        
        isRunning = true;
        log('🚀 Starting menu automation...');
        
        try {
            await waitForPageLoad();
            const categories = await findCategories();
            
            if (categories.length === 0) {
                throw new Error('No categories found');
            }
            
            totalSteps = categories.length * CONFIG.MAX_ITEMS_PER_CATEGORY;
            currentStep = 0;
            
            for (const category of categories) {
                await processCategory(category);
            }
            
            log('✅ Automation completed successfully');
            displayResults();
            
        } catch (error) {
            log(`Automation failed: ${error.message}`, 'error');
        } finally {
            isRunning = false;
        }
    }
    
    function waitForPageLoad() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (document.readyState === 'complete' && 
                    document.querySelector('#app-root')) {
                    clearInterval(checkInterval);
                    log('Page loaded successfully');
                    resolve();
                }
            }, 100);
        });
    }
    
    async function findCategories() {
        log('🔍 Looking for categories...');
        
        const categoryElements = findElements(SELECTORS.categories);
        
        if (categoryElements.length === 0) {
            log('No categories found with standard selectors', 'warning');
            // Try alternative approach
            const navItems = document.querySelectorAll('nav ul li, .sidebar li, [role="navigation"] li');
            return Array.from(navItems).map((el, index) => ({
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
    
    async function processCategory(category) {
        log(`📂 Processing category: ${category.text}`);
        
        try {
            // Click category
            await clickElement(category.element);
            await wait(CONFIG.DELAY_BETWEEN_ACTIONS);
            
            // Wait for items to load
            await waitForItems();
            
            // Find and process menu items
            const items = await findMenuItems();
            log(`Found ${items.length} items in ${category.text}`);
            
            const itemsToProcess = items.slice(0, CONFIG.MAX_ITEMS_PER_CATEGORY);
            
            for (const item of itemsToProcess) {
                await processMenuItem(item, category);
                currentStep++;
                updateProgress();
            }
            
        } catch (error) {
            log(`Error processing category ${category.text}: ${error.message}`, 'error');
        }
    }
    
    function waitForItems() {
        return new Promise((resolve) => {
            const maxWait = 5000;
            const startTime = Date.now();
            
            const checkItems = () => {
                const items = findElements(SELECTORS.menuItems);
                if (items.length > 0 || Date.now() - startTime > maxWait) {
                    resolve();
                } else {
                    setTimeout(checkItems, 100);
                }
            };
            
            checkItems();
        });
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
            await clickElement(item.element);
            await waitForModal();
            
            // Find and click ADD button
            const addButton = findAddButton();
            if (addButton) {
                await addToCart(addButton, item, category);
            } else {
                log(`No ADD button found for ${item.name}`, 'warning');
            }
            
            // Close modal
            await closeModal();
            
        } catch (error) {
            log(`Error processing item ${item.name}: ${error.message}`, 'error');
            await closeModal(); // Try to close modal anyway
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
        return findElement(SELECTORS.addButton);
    }
    
    async function addToCart(button, item, category) {
        const price = extractPrice(button);
        
        const cartItem = {
            name: item.name,
            price: price,
            category: category.text,
            timestamp: new Date().toISOString()
        };
        
        log(`🛒 Adding to cart: ${item.name} - $${price}`);
        
        // Click the ADD button
        await clickElement(button);
        await wait(1000);
        
        // Add to our cart tracking
        cart.push(cartItem);
        
        log(`✅ Added to cart: ${item.name}`, 'success');
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
            
            await wait(500);
            log('Modal closed');
            
        } catch (error) {
            log(`Error closing modal: ${error.message}`, 'error');
        }
    }
    
    async function clickElement(element) {
        if (!element) {
            throw new Error('Element not found');
        }
        
        // Scroll element into view
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await wait(500);
        
        // Click the element
        element.click();
    }
    
    function updateProgress() {
        const progress = totalSteps > 0 ? (currentStep / totalSteps * 100).toFixed(1) : 0;
        log(`Progress: ${currentStep}/${totalSteps} (${progress}%)`);
    }
    
    function displayResults() {
        log('\n🛒 AUTOMATION RESULTS');
        log('====================');
        
        if (cart.length === 0) {
            log('No items were added to cart');
            return;
        }
        
        let total = 0;
        cart.forEach((item, index) => {
            log(`${index + 1}. ${item.name} - $${item.price}`);
            total += item.price;
        });
        
        log(`\nTotal: $${total.toFixed(2)}`);
        log(`Items: ${cart.length}`);
    }
    
    // Public API
    window.MenuBot = {
        start: startAutomation,
        stop: () => { isRunning = false; log('Automation stopped'); },
        getCart: () => cart,
        clearCart: () => { cart = []; log('Cart cleared'); },
        getTotal: () => cart.reduce((total, item) => total + item.price, 0),
        isRunning: () => isRunning
    };
    
    // Auto-start if configured
    if (CONFIG.AUTO_START) {
        log('🚀 Auto-starting in 3 seconds...');
        setTimeout(startAutomation, 3000);
    }
    
    log('Menu automation script loaded');
    log('Available commands:');
    log('- MenuBot.start()');
    log('- MenuBot.stop()');
    log('- MenuBot.getCart()');
    log('- MenuBot.clearCart()');
    
})();
