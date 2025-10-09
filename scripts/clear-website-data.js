// Clear Website Data Script
// This script clears all website data for the current domain
// Run this in the browser console on the target website

(function() {
    'use strict';
    
    const currentDomain = window.location.hostname;
    console.log(`🧹 Clearing all data for domain: ${currentDomain}`);
    
    // Function to clear localStorage
    function clearLocalStorage() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.includes(currentDomain) || localStorage.getItem(key)) {
                    localStorage.removeItem(key);
                }
            });
            console.log('✅ localStorage cleared');
        } catch (error) {
            console.log('⚠️ Error clearing localStorage:', error.message);
        }
    }
    
    // Function to clear sessionStorage
    function clearSessionStorage() {
        try {
            const keys = Object.keys(sessionStorage);
            keys.forEach(key => {
                if (key.includes(currentDomain) || sessionStorage.getItem(key)) {
                    sessionStorage.removeItem(key);
                }
            });
            console.log('✅ sessionStorage cleared');
        } catch (error) {
            console.log('⚠️ Error clearing sessionStorage:', error.message);
        }
    }
    
    // Function to clear IndexedDB
    async function clearIndexedDB() {
        try {
            if ('indexedDB' in window) {
                const databases = await indexedDB.databases();
                for (const db of databases) {
                    if (db.name.includes(currentDomain) || db.name.includes('foodhub') || db.name.includes('touch2success')) {
                        indexedDB.deleteDatabase(db.name);
                        console.log(`✅ IndexedDB database deleted: ${db.name}`);
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Error clearing IndexedDB:', error.message);
        }
    }
    
    // Function to clear cookies
    function clearCookies() {
        try {
            const cookies = document.cookie.split(';');
            cookies.forEach(cookie => {
                const eqPos = cookie.indexOf('=');
                const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
                if (name) {
                    // Clear cookie for current domain
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${currentDomain}`;
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=.${currentDomain}`;
                }
            });
            console.log('✅ Cookies cleared');
        } catch (error) {
            console.log('⚠️ Error clearing cookies:', error.message);
        }
    }
    
    // Function to clear cache
    async function clearCache() {
        try {
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (const cacheName of cacheNames) {
                    if (cacheName.includes(currentDomain) || cacheName.includes('foodhub') || cacheName.includes('touch2success')) {
                        await caches.delete(cacheName);
                        console.log(`✅ Cache cleared: ${cacheName}`);
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Error clearing cache:', error.message);
        }
    }
    
    // Function to clear service workers
    async function clearServiceWorkers() {
        try {
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    if (registration.scope.includes(currentDomain)) {
                        await registration.unregister();
                        console.log(`✅ Service worker unregistered: ${registration.scope}`);
                    }
                }
            }
        } catch (error) {
            console.log('⚠️ Error clearing service workers:', error.message);
        }
    }
    
    // Function to clear all data
    async function clearAllData() {
        console.log('🚀 Starting data clearing process...');
        
        // Clear synchronous data
        clearLocalStorage();
        clearSessionStorage();
        clearCookies();
        
        // Clear asynchronous data
        await clearIndexedDB();
        await clearCache();
        await clearServiceWorkers();
        
        console.log('🎉 All website data cleared successfully!');
        console.log('💡 You may need to refresh the page for changes to take effect.');
    }
    
    // Function to show current data
    function showCurrentData() {
        console.log('📊 Current website data:');
        console.log('🍪 Cookies:', document.cookie);
        console.log('💾 localStorage keys:', Object.keys(localStorage));
        console.log('🗂️ sessionStorage keys:', Object.keys(sessionStorage));
        
        if ('indexedDB' in window) {
            indexedDB.databases().then(databases => {
                console.log('🗄️ IndexedDB databases:', databases.map(db => db.name));
            });
        }
        
        if ('caches' in window) {
            caches.keys().then(cacheNames => {
                console.log('📦 Cache names:', cacheNames);
            });
        }
    }
    
    // Expose functions to global scope for easy access
    window.clearWebsiteData = clearAllData;
    window.showWebsiteData = showCurrentData;
    
    // Auto-run the clearing process
    clearAllData();
    
    console.log('🔧 Available functions:');
    console.log('  - clearWebsiteData() - Clear all data');
    console.log('  - showWebsiteData() - Show current data');
    
})();
