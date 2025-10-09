// Clear Website Data Extension Script
// Add this to your Chrome extension to clear website data

// Function to clear all website data
async function clearWebsiteData() {
    const currentDomain = window.location.hostname;
    console.log(`🧹 Clearing all data for domain: ${currentDomain}`);
    
    try {
        // Clear localStorage
        localStorage.clear();
        console.log('✅ localStorage cleared');
        
        // Clear sessionStorage
        sessionStorage.clear();
        console.log('✅ sessionStorage cleared');
        
        // Clear cookies
        document.cookie.split(";").forEach(function(c) { 
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
        });
        console.log('✅ Cookies cleared');
        
        // Clear IndexedDB
        if ('indexedDB' in window) {
            const databases = await indexedDB.databases();
            for (const db of databases) {
                indexedDB.deleteDatabase(db.name);
                console.log(`✅ IndexedDB deleted: ${db.name}`);
            }
        }
        
        // Clear cache
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            for (const cacheName of cacheNames) {
                await caches.delete(cacheName);
                console.log(`✅ Cache deleted: ${cacheName}`);
            }
        }
        
        // Clear service workers
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
                await registration.unregister();
                console.log(`✅ Service worker unregistered: ${registration.scope}`);
            }
        }
        
        console.log('🎉 All website data cleared successfully!');
        return { success: true, message: 'All website data cleared successfully!' };
        
    } catch (error) {
        console.error('❌ Error clearing website data:', error);
        return { success: false, error: error.message };
    }
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

// Expose functions to global scope
window.clearWebsiteData = clearWebsiteData;
window.showWebsiteData = showCurrentData;

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { clearWebsiteData, showCurrentData };
}
