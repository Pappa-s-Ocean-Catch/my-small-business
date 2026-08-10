# Marketplace Session Sync

Private Chrome extension for refreshing the marketplace sessions used by the POS integration. It adds a manual **Sync marketplace session** button to signed-in Uber Eats Manager and DoorDash Merchant pages.

The extension keeps only the latest `Cookie` header observed from the provider's authenticated portal API request in service-worker memory. The observation is restricted to Uber Eats Manager API and DoorDash Merchant Analytics API request patterns. It opens a review dialog after the button click, shows the read-only captured header, offers a Copy button, and uploads it only after staff explicitly chooses **Submit session**. It does not store cookies, capture orders, or run automatic syncs.

See [INSTALL.md](INSTALL.md) for setup and security requirements.
