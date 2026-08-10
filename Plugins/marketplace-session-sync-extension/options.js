const apiBaseUrl = document.querySelector('#apiBaseUrl');
const syncSecret = document.querySelector('#syncSecret');
const status = document.querySelector('#status');

const saved = await chrome.storage.local.get(['apiBaseUrl', 'syncSecret']);
apiBaseUrl.value = saved.apiBaseUrl || '';
syncSecret.value = saved.syncSecret || '';

document.querySelector('#save').addEventListener('click', async () => {
  await chrome.storage.local.set({
    apiBaseUrl: apiBaseUrl.value.trim().replace(/\/$/, ''),
    syncSecret: syncSecret.value,
  });
  status.textContent = 'Saved';
});
