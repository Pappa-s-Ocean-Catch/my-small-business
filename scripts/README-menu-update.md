# Menu Price Update Scripts

These scripts help you update menu item prices and descriptions from a CSV file.

## Scripts

### 1. `list-menu-items.js`
Lists all menu items from the database with their IDs, names, prices, and descriptions. Useful for matching with CSV data.

**Usage:**
```bash
node scripts/list-menu-items.js
```

This will:
- Display all menu items in the console
- Save a JSON file to `menu/database-menu-items.json` for reference

### 2. `update-menu-prices.js`
Reads price updates from CSV and updates menu items in the database by matching item names.

**Usage:**
```bash
node scripts/update-menu-prices.js
```

This script will:
1. Read the CSV file from `menu/Stocking1 - Food.csv`
2. Parse item names, descriptions, and updated prices
3. Fetch all menu items from the database
4. Match items by name (case-insensitive, with fuzzy matching)
5. Show a preview of updates
6. Wait 5 seconds for confirmation
7. Update prices and descriptions in the database

## CSV File Format

The CSV file should have the following columns:
- `Category` - Menu category (optional, for reference)
- `Item` - Item name (required for matching)
- `Description` - Item description (optional)
- `Updated Price` - New price with $ sign (e.g., "$7.50")

## Environment Variables Required

Make sure you have these environment variables set:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for admin access)

You can set these in a `.env.local` file or export them before running the script.

## Matching Logic

The script uses intelligent matching:
1. **Exact match** - Case-insensitive exact name match
2. **Partial match** - One name contains the other
3. **Fuzzy match** - Most words match (70% threshold)

## Output

The script will show:
- Number of items matched and ready to update
- Number of unmatched items (items in CSV not found in database)
- Preview of first 10 updates
- Progress during update
- Final summary with success/error counts

## Safety Features

- Shows preview before updating
- 5-second delay before proceeding (press Ctrl+C to cancel)
- Only updates items that actually need updating
- Reports unmatched items so you can check them manually

## Troubleshooting

If items are not matching:
1. Run `list-menu-items.js` to see all database items
2. Check the item names in the CSV match the database names
3. The script handles common variations (case, spacing, special characters)
4. Unmatched items will be listed in the output
