/**
 * Pappa's Ocean Catch Menu Automation Script
 * 
 * This script automates the menu ordering flow:
 * 1. Navigate categories on the left sidebar
 * 2. Click on menu items to open modal
 * 3. Add items to cart via modal
 * 4. Handle cart management
 */

class MenuAutomation {
    constructor() {
        this.baseUrl = 'https://pappasoceancatch-ea.com.au';
        this.cart = [];
        this.currentCategory = null;
        this.isModalOpen = false;
        
        // Configuration
        this.config = {
            waitTime: 2000, // Wait time between actions
            retryAttempts: 3,
            debug: true
        };
        
        this.init();
    }
    
    init() {
        console.log('🍽️ Menu Automation Script Initialized');
        this.setupEventListeners();
        this.waitForPageLoad();
    }
    
    setupEventListeners() {
        // Listen for modal open/close events
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-testid*="modal"]')) {
                this.isModalOpen = true;
                console.log('📱 Modal opened');
            }
        });
        
        // Listen for cart updates
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    this.checkForCartUpdates();
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    waitForPageLoad() {
        const checkInterval = setInterval(() => {
            if (document.readyState === 'complete' && this.isPageLoaded()) {
                clearInterval(checkInterval);
                console.log('✅ Page loaded successfully');
                this.initializeMenu();
            }
        }, 100);
    }
    
    isPageLoaded() {
        // Check if the main app container is loaded
        const appRoot = document.getElementById('app-root');
        const menuContainer = document.querySelector('[data-testid*="menu"]') || 
                             document.querySelector('.menu-container') ||
                             document.querySelector('#detail_view_menu');
        
        return appRoot && menuContainer;
    }
    
    async initializeMenu() {
        try {
            console.log('🔍 Initializing menu automation...');
            
            // Wait for menu to be fully loaded
            await this.waitForElement('[data-testid*="category"]', 5000);
            
            // Get available categories
            const categories = await this.getCategories();
            console.log('📋 Available categories:', categories);
            
            // Start automation process
            await this.startAutomation(categories);
            
        } catch (error) {
            console.error('❌ Error initializing menu:', error);
        }
    }
    
    async getCategories() {
        const categorySelectors = [
            '[data-testid*="category"]',
            '.category-item',
            '.menu-category',
            '[data-class*="category"]',
            'nav ul li a'
        ];
        
        for (const selector of categorySelectors) {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
                return Array.from(elements).map((el, index) => ({
                    index,
                    text: el.textContent?.trim(),
                    element: el,
                    selector: selector
                }));
            }
        }
        
        return [];
    }
    
    async startAutomation(categories) {
        console.log('🚀 Starting menu automation...');
        
        for (const category of categories) {
            try {
                console.log(`📂 Processing category: ${category.text}`);
                await this.selectCategory(category);
                await this.waitForItems();
                await this.processCategoryItems();
                await this.delay(this.config.waitTime);
            } catch (error) {
                console.error(`❌ Error processing category ${category.text}:`, error);
            }
        }
        
        console.log('✅ Automation completed');
        this.displayCartSummary();
    }
    
    async selectCategory(category) {
        try {
            this.currentCategory = category;
            console.log(`🖱️ Clicking category: ${category.text}`);
            
            // Scroll to category if needed
            category.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.delay(500);
            
            // Click the category
            category.element.click();
            
            // Wait for category to be active
            await this.waitForCategoryActive(category);
            
        } catch (error) {
            console.error('❌ Error selecting category:', error);
            throw error;
        }
    }
    
    async waitForCategoryActive(category) {
        const maxWait = 3000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (category.element.classList.contains('active') || 
                category.element.getAttribute('aria-selected') === 'true') {
                console.log(`✅ Category ${category.text} is now active`);
                return;
            }
            await this.delay(100);
        }
        
        console.warn(`⚠️ Category ${category.text} may not be fully active`);
    }
    
    async waitForItems() {
        console.log('⏳ Waiting for menu items to load...');
        
        const itemSelectors = [
            '[data-testid*="item"]',
            '.menu-item',
            '[data-class*="item"]',
            'h4[data-class*="item_name"]'
        ];
        
        for (const selector of itemSelectors) {
            try {
                await this.waitForElement(selector, 3000);
                console.log(`✅ Found items with selector: ${selector}`);
                return;
            } catch (error) {
                console.log(`❌ No items found with selector: ${selector}`);
            }
        }
        
        throw new Error('No menu items found');
    }
    
    async processCategoryItems() {
        const items = await this.getMenuItems();
        console.log(`🍽️ Found ${items.length} items in current category`);
        
        // Process first few items (limit to avoid overwhelming)
        const itemsToProcess = items.slice(0, 3);
        
        for (const item of itemsToProcess) {
            try {
                console.log(`🍴 Processing item: ${item.name}`);
                await this.selectMenuItem(item);
                await this.handleItemModal(item);
                await this.delay(this.config.waitTime);
            } catch (error) {
                console.error(`❌ Error processing item ${item.name}:`, error);
            }
        }
    }
    
    async getMenuItems() {
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
                    element: el,
                    selector: selector
                }));
            }
        }
        
        return [];
    }
    
    async selectMenuItem(item) {
        try {
            console.log(`🖱️ Clicking menu item: ${item.name}`);
            
            // Scroll to item if needed
            item.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            await this.delay(500);
            
            // Click the item
            item.element.click();
            
            // Wait for modal to open
            await this.waitForModal();
            
        } catch (error) {
            console.error('❌ Error selecting menu item:', error);
            throw error;
        }
    }
    
    async waitForModal() {
        const maxWait = 5000;
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (this.isModalOpen || this.checkModalVisible()) {
                console.log('✅ Modal is now open');
                return;
            }
            await this.delay(100);
        }
        
        throw new Error('Modal did not open within expected time');
    }
    
    checkModalVisible() {
        const modalSelectors = [
            '[data-testid*="modal"]',
            '.modal',
            '[role="dialog"]',
            '.overlay'
        ];
        
        for (const selector of modalSelectors) {
            const modal = document.querySelector(selector);
            if (modal && this.isElementVisible(modal)) {
                return true;
            }
        }
        
        return false;
    }
    
    async handleItemModal(item) {
        try {
            console.log(`📱 Handling modal for: ${item.name}`);
            
            // Wait for modal content to load
            await this.delay(1000);
            
            // Look for add to cart button
            const addButton = await this.findAddToCartButton();
            
            if (addButton) {
                console.log(`🛒 Adding ${item.name} to cart`);
                await this.addToCart(addButton, item);
            } else {
                console.log(`⚠️ No add to cart button found for ${item.name}`);
            }
            
            // Close modal
            await this.closeModal();
            
        } catch (error) {
            console.error('❌ Error handling modal:', error);
            // Try to close modal anyway
            await this.closeModal();
        }
    }
    
    async findAddToCartButton() {
        const buttonSelectors = [
            '[data-testid*="add_to_basket"]',
            '[data-class*="add_to_basket"]',
            'button:contains("ADD")',
            'button:contains("Add")',
            '.add-to-cart',
            '[data-testid*="add"]'
        ];
        
        for (const selector of buttonSelectors) {
            const button = document.querySelector(selector);
            if (button && this.isElementVisible(button)) {
                return button;
            }
        }
        
        // Fallback: look for any button with "ADD" text
        const buttons = document.querySelectorAll('button, [role="button"]');
        for (const button of buttons) {
            if (button.textContent?.includes('ADD') || button.textContent?.includes('Add')) {
                return button;
            }
        }
        
        return null;
    }
    
    async addToCart(button, item) {
        try {
            // Get price if available
            const price = this.extractPrice(button);
            
            // Create cart item
            const cartItem = {
                name: item.name,
                price: price,
                category: this.currentCategory?.text,
                timestamp: new Date().toISOString()
            };
            
            // Click the add button
            button.click();
            
            // Wait for cart update
            await this.delay(1000);
            
            // Add to our cart tracking
            this.cart.push(cartItem);
            
            console.log(`✅ Added to cart: ${item.name} - $${price}`);
            
        } catch (error) {
            console.error('❌ Error adding to cart:', error);
            throw error;
        }
    }
    
    extractPrice(button) {
        // Try to extract price from button text or nearby elements
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
    
    async closeModal() {
        try {
            // Look for close button
            const closeSelectors = [
                '[data-testid*="close"]',
                '.close',
                '[aria-label*="close"]',
                '[aria-label*="Close"]',
                'button:contains("×")',
                'button:contains("✕")'
            ];
            
            for (const selector of closeSelectors) {
                const closeButton = document.querySelector(selector);
                if (closeButton && this.isElementVisible(closeButton)) {
                    closeButton.click();
                    break;
                }
            }
            
            // Alternative: press Escape key
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
            
            this.isModalOpen = false;
            console.log('✅ Modal closed');
            
        } catch (error) {
            console.error('❌ Error closing modal:', error);
        }
    }
    
    checkForCartUpdates() {
        // Check if cart count has changed
        const cartCountSelectors = [
            '[data-testid*="cart_count"]',
            '.cart-count',
            '.basket-count',
            '[class*="cart"][class*="count"]'
        ];
        
        for (const selector of cartCountSelectors) {
            const countElement = document.querySelector(selector);
            if (countElement) {
                const count = parseInt(countElement.textContent) || 0;
                if (count !== this.cart.length) {
                    console.log(`🛒 Cart count updated: ${count}`);
                }
            }
        }
    }
    
    displayCartSummary() {
        console.log('\n🛒 CART SUMMARY');
        console.log('================');
        
        if (this.cart.length === 0) {
            console.log('Cart is empty');
            return;
        }
        
        let total = 0;
        this.cart.forEach((item, index) => {
            console.log(`${index + 1}. ${item.name} - $${item.price}`);
            total += item.price;
        });
        
        console.log(`\nTotal: $${total.toFixed(2)}`);
        console.log(`Items: ${this.cart.length}`);
    }
    
    // Utility methods
    async waitForElement(selector, timeout = 5000) {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) {
                return element;
            }
            await this.delay(100);
        }
        
        throw new Error(`Element ${selector} not found within ${timeout}ms`);
    }
    
    isElementVisible(element) {
        if (!element) return false;
        
        const style = window.getComputedStyle(element);
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               element.offsetWidth > 0 && 
               element.offsetHeight > 0;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Public API methods
    getCart() {
        return this.cart;
    }
    
    clearCart() {
        this.cart = [];
        console.log('🗑️ Cart cleared');
    }
    
    getCartTotal() {
        return this.cart.reduce((total, item) => total + item.price, 0);
    }
}

// Auto-initialize when script loads
if (typeof window !== 'undefined') {
    window.MenuAutomation = MenuAutomation;
    
    // Initialize automation
    const automation = new MenuAutomation();
    
    // Make it globally available
    window.menuAutomation = automation;
    
    console.log('🍽️ Menu Automation Script Loaded');
    console.log('Available commands:');
    console.log('- window.menuAutomation.getCart()');
    console.log('- window.menuAutomation.clearCart()');
    console.log('- window.menuAutomation.getCartTotal()');
}

// Export for Node.js if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MenuAutomation;
}
