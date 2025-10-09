/**
 * Simple Menu Automation Script for Pappa's Ocean Catch
 * 
 * This script automates the basic menu ordering flow:
 * 1. Click on category items (left sidebar)
 * 2. Click on menu items to open modal
 * 3. Click "ADD" button to add to cart
 */

(function() {
    'use strict';
    
    console.log('🍽️ Simple Menu Automation Script Started');
    
    // Configuration
    const config = {
        waitTime: 1000,
        maxItemsPerCategory: 2,
        debug: true
    };
    
    // Track cart items
    let cart = [];
    let currentCategory = null;
    
    // Utility functions
    function log(message) {
        if (config.debug) {
            console.log(`[MenuBot] ${message}`);
        }
    }
    
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    function isElementVisible(element) {
        if (!element) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }
    
    // Main automation function
    async function startAutomation() {
        try {
            log('🚀 Starting menu automation...');
            
            // Wait for page to load
            await waitForPageLoad();
            
            // Find and process categories
            const categories = findCategories();
            log(`📋 Found ${categories.length} categories`);
            
            for (let i = 0; i < categories.length; i++) {
                const category = categories[i];
                log(`📂 Processing category ${i + 1}/${categories.length}: ${category.text}`);
                
                await processCategory(category);
                await wait(config.waitTime);
            }
            
            log('✅ Automation completed');
            displayCartSummary();
            
        } catch (error) {
            log(`❌ Error: ${error.message}`);
        }
    }
    
    function waitForPageLoad() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (document.readyState === 'complete' && document.querySelector('#app-root')) {
                    clearInterval(checkInterval);
                    log('✅ Page loaded');
                    resolve();
                }
            }, 100);
        });
    }
    
    function findCategories() {
        // Look for category elements in the left sidebar
        const categorySelectors = [
            'nav ul li a',
            '[data-testid*="category"]',
            '.category-item',
            '.menu-category',
            '[data-class*="category"]'
        ];
        
        for (const selector of categorySelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                log(`Found categories with selector: ${selector}`);
                return Array.from(elements).map((el, index) => ({
                    index,
                    text: el.textContent?.trim() || `Category ${index + 1}`,
                    element: el
                }));
            }
        }
        
        log('⚠️ No categories found');
        return [];
    }
    
    async function processCategory(category) {
        try {
            currentCategory = category;
            
            // Click on category
            log(`🖱️ Clicking category: ${category.text}`);
            category.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await wait(500);
            category.element.click();
            
            // Wait for items to load
            await waitForItems();
            
            // Find and process menu items
            const items = findMenuItems();
            log(`🍽️ Found ${items.length} items in category: ${category.text}`);
            
            // Process limited number of items
            const itemsToProcess = items.slice(0, config.maxItemsPerCategory);
            
            for (const item of itemsToProcess) {
                await processMenuItem(item);
                await wait(config.waitTime);
            }
            
        } catch (error) {
            log(`❌ Error processing category ${category.text}: ${error.message}`);
        }
    }
    
    function waitForItems() {
        return new Promise((resolve) => {
            const maxWait = 5000;
            const startTime = Date.now();
            
            const checkItems = () => {
                const items = findMenuItems();
                if (items.length > 0 || Date.now() - startTime > maxWait) {
                    resolve();
                } else {
                    setTimeout(checkItems, 100);
                }
            };
            
            checkItems();
        });
    }
    
    function findMenuItems() {
        // Look for menu item elements
        const itemSelectors = [
            'h4[data-class*="item_name"]',
            '[data-testid*="item"]',
            '.menu-item',
            '[data-class*="item"]'
        ];
        
        for (const selector of itemSelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements).map((el, index) => ({
                    index,
                    name: el.textContent?.trim() || `Item ${index + 1}`,
                    element: el
                }));
            }
        }
        
        return [];
    }
    
    async function processMenuItem(item) {
        try {
            log(`🍴 Processing item: ${item.name}`);
            
            // Click on menu item to open modal
            item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await wait(500);
            item.element.click();
            
            // Wait for modal to open
            await waitForModal();
            
            // Find and click ADD button
            const addButton = findAddButton();
            if (addButton) {
                await addToCart(addButton, item);
            } else {
                log(`⚠️ No ADD button found for ${item.name}`);
            }
            
            // Close modal
            await closeModal();
            
        } catch (error) {
            log(`❌ Error processing item ${item.name}: ${error.message}`);
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
        const modalSelectors = [
            '[data-testid*="modal"]',
            '.modal',
            '[role="dialog"]',
            '.overlay'
        ];
        
        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && isElementVisible(modal)) {
                return true;
            }
        }
        
        return false;
    }
    
    function findAddButton() {
        // Look for ADD button in modal
        const buttonSelectors = [
            '[data-testid*="add_to_basket"]',
            '[data-class*="add_to_basket"]',
            'button[data-testid*="add"]',
            'div[data-testid*="add"]'
        ];
        
        for (const selector of buttonSelectors) {
            const button = document.querySelector(selector);
            if (button && isElementVisible(button)) {
                return button;
            }
        }
        
        // Fallback: look for any element with "ADD" text
        const allButtons = document.querySelectorAll('button, div[role="button"], [data-testid*="button"]');
        for (const button of allButtons) {
            if (button.textContent?.includes('ADD') && isElementVisible(button)) {
                return button;
            }
        }
        
        return null;
    }
    
    async function addToCart(button, item) {
        try {
            // Extract price from button or nearby elements
            const price = extractPrice(button);
            
            // Create cart item
            const cartItem = {
                name: item.name,
                price: price,
                category: currentCategory?.text,
                timestamp: new Date().toISOString()
            };
            
            // Click the ADD button
            log(`🛒 Adding to cart: ${item.name} - $${price}`);
            button.click();
            
            // Wait for cart update
            await wait(500);
            
            // Add to our cart tracking
            cart.push(cartItem);
            
            log(`✅ Successfully added: ${item.name}`);
            
        } catch (error) {
            log(`❌ Error adding to cart: ${error.message}`);
        }
    }
    
    function extractPrice(button) {
        // Try to extract price from button text
        const pricePattern = /\$?(\d+\.?\d*)/;
        const buttonText = button.textContent || '';
        const match = buttonText.match(pricePattern);
        
        if (match) {
            return parseFloat(match[1]);
        }
        
        // Look for price in parent elements
        const parent = button.closest('[data-testid*="price"], .price, [class*="price"]');
        if (parent) {
            const parentMatch = parent.textContent?.match(pricePattern);
            if (parentMatch) {
                return parseFloat(parentMatch[1]);
            }
        }
        
        return 0;
    }
    
    async function closeModal() {
        try {
            // Look for close button
            const closeSelectors = [
                '[data-testid*="close"]',
                '.close',
                '[aria-label*="close"]',
                'button:contains("×")'
            ];
            
            for (const selector of closeSelectors) {
                const closeButton = document.querySelector(selector);
                if (closeButton && isElementVisible(closeButton)) {
                    closeButton.click();
                    break;
                }
            }
            
            // Alternative: press Escape key
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            
            log('✅ Modal closed');
            
        } catch (error) {
            log(`❌ Error closing modal: ${error.message}`);
        }
    }
    
    function displayCartSummary() {
        log('\n🛒 CART SUMMARY');
        log('================');
        
        if (cart.length === 0) {
            log('Cart is empty');
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
        getCart: () => cart,
        clearCart: () => { cart = []; log('🗑️ Cart cleared'); },
        getTotal: () => cart.reduce((total, item) => total + item.price, 0)
    };
    
    // Auto-start after a short delay
    setTimeout(() => {
        log('🚀 Auto-starting menu automation in 3 seconds...');
        setTimeout(startAutomation, 3000);
    }, 1000);
    
})();
