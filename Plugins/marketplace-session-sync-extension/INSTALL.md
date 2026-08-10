# Install Marketplace Session Sync

1. Set `MARKETPLACE_EXTENSION_SYNC_SECRET` in the web application's server environment to a long random value.
2. Set `MARKETPLACE_EXTENSION_ALLOWED_ORIGIN` to the exact extension origin, for example `chrome-extension://hhiigboejidhghecamnmfimbljijmikk`. Multiple approved extension origins may be separated by commas.
3. Restart the web application after changing those environment variables.
4. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select this folder.
5. Open extension **Details** then **Extension options**.
6. Set API base URL to `https://pappasfishnchips.com.au` and paste the same sync secret.
7. Open a signed-in Uber Eats Manager or DoorDash Merchant Orders page and refresh the portal once so it makes an API request. Click **Sync marketplace session**, review the read-only captured request cookie header, optionally copy it, then choose **Submit session** to send it.

The server validates the session before replacing the encrypted saved credential. A validation failure does not overwrite the existing session.

Never place the secret in a URL or share it with an untrusted user. If it is exposed, replace the server environment value and update the extension settings on each authorised browser. The server only sends CORS headers to an explicitly configured extension origin.
