// Simple Clear Website Data Script
// Copy and paste this into the browser console on the target website

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
    indexedDB.databases().then(databases => {
        databases.forEach(db => {
            indexedDB.deleteDatabase(db.name);
            console.log(`✅ IndexedDB deleted: ${db.name}`);
        });
    });
}

// Clear cache
if ('caches' in window) {
    caches.keys().then(cacheNames => {
        cacheNames.forEach(cacheName => {
            caches.delete(cacheName);
            console.log(`✅ Cache deleted: ${cacheName}`);
        });
    });
}

// Clear service workers
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
            registration.unregister();
            console.log(`✅ Service worker unregistered: ${registration.scope}`);
        });
    });
}

console.log('🎉 All website data cleared! Refresh the page to see changes.');
