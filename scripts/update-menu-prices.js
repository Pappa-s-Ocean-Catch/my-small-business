/**
 * Menu Price Update Script
 * 
 * This script reads price updates from CSV and updates menu items in the database
 * by matching item names and updating both price and description.
 */

// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { readFileSync } = require('fs');
const { join } = require('path');

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

/**
 * Improved CSV parser that handles quoted fields and commas within fields
 */
function parseCSV(content) {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return [];
  
  // Parse header - handle quoted headers
  const headerLine = lines[0];
  const header = [];
  let currentHeader = '';
  let inQuotes = false;
  
  for (let i = 0; i < headerLine.length; i++) {
    const char = headerLine[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      header.push(currentHeader.trim().replace(/^"|"$/g, ''));
      currentHeader = '';
    } else {
      currentHeader += char;
    }
  }
  header.push(currentHeader.trim().replace(/^"|"$/g, ''));
  
  // Parse data rows
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = [];
    let current = '';
    inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      const nextChar = line[j + 1];
      
      if (char === '"') {
        // Handle escaped quotes ("")
        if (nextChar === '"' && inQuotes) {
          current += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    // Create record object
    const record = {};
    header.forEach((key, index) => {
      let value = values[index] || '';
      // Remove surrounding quotes if present
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      record[key] = value;
    });
    
    records.push(record);
  }
  
  return records;
}

/**
 * Parse price string (e.g., "$7.50" or "7.50") to number
 */
function parsePrice(priceStr) {
  if (!priceStr || priceStr.trim() === '') return null;
  // Remove $ sign and any whitespace
  const cleaned = priceStr.toString().replace(/[$,\s]/g, '').trim();
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Normalize name for matching (lowercase, trim, remove extra spaces)
 */
function normalizeName(name) {
  if (!name) return '';
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, ''); // Remove special characters for better matching
}

/**
 * Find best match for a CSV item in the database items
 */
function findBestMatch(csvItem, dbItems) {
  const csvName = normalizeName(csvItem.name);
  
  // Try exact match first
  let match = dbItems.find(item => normalizeName(item.name) === csvName);
  if (match) return match;
  
  // Try partial match (CSV name contains DB name or vice versa)
  match = dbItems.find(item => {
    const dbName = normalizeName(item.name);
    return csvName.includes(dbName) || dbName.includes(csvName);
  });
  if (match) return match;
  
  // Try fuzzy match (check if most words match)
  const csvWords = csvName.split(/\s+/).filter(w => w.length > 2);
  match = dbItems.find(item => {
    const dbName = normalizeName(item.name);
    const dbWords = dbName.split(/\s+/).filter(w => w.length > 2);
    const matchingWords = csvWords.filter(cw => 
      dbWords.some(dw => dw.includes(cw) || cw.includes(dw))
    );
    return matchingWords.length >= Math.min(csvWords.length, dbWords.length) * 0.7;
  });
  
  return match || null;
}

/**
 * Main function
 */
async function main() {
  console.log('📋 Starting menu price update script...\n');
  
  // Read CSV file
  const csvPath = join(__dirname, '../menu/Stocking1 - Food.csv');
  console.log(`📂 Reading CSV file: ${csvPath}`);
  
  let csvContent;
  try {
    csvContent = readFileSync(csvPath, 'utf-8');
  } catch (error) {
    console.error('❌ Error reading CSV file:', error.message);
    process.exit(1);
  }
  
  // Parse CSV
  console.log('🔍 Parsing CSV data...');
  const records = parseCSV(csvContent);
  
  // Extract menu items from CSV
  const csvItems = [];
  for (const record of records) {
    const item = record.Item?.trim();
    const description = record.Description?.trim();
    const updatedPrice = record['Updated Price']?.trim();
    
    // Skip empty rows or rows without item name
    if (!item || item === '' || item === 'Item') continue;
    
    const price = parsePrice(updatedPrice);
    if (price === null && !description) continue; // Skip if no price and no description
    
    csvItems.push({
      name: item,
      description: description || null,
      price: price,
      category: record.Category?.trim() || null,
    });
  }
  
  console.log(`✅ Found ${csvItems.length} items in CSV\n`);
  
  // Fetch all menu items from database
  console.log('🔍 Fetching menu items from database...');
  const { data: dbItems, error: dbError } = await supabase
    .from('sale_products')
    .select('id, name, description, sale_price')
    .order('name');
  
  if (dbError) {
    console.error('❌ Error fetching menu items:', dbError.message);
    process.exit(1);
  }
  
  console.log(`✅ Found ${dbItems.length} items in database\n`);
  
  // Match CSV items with database items
  console.log('🔗 Matching items...\n');
  const updates = [];
  const unmatched = [];
  
  for (const csvItem of csvItems) {
    const match = findBestMatch(csvItem, dbItems);
    
    if (!match) {
      unmatched.push(csvItem);
      continue;
    }
    
    // Check if we need to update
    const needsPriceUpdate = csvItem.price !== null && csvItem.price !== match.sale_price;
    const needsDescUpdate = csvItem.description && csvItem.description !== (match.description || '');
    
    if (needsPriceUpdate || needsDescUpdate) {
      updates.push({
        id: match.id,
        name: match.name,
        csvName: csvItem.name,
        oldPrice: match.sale_price,
        newPrice: csvItem.price !== null ? csvItem.price : match.sale_price,
        oldDescription: match.description || '',
        newDescription: csvItem.description || match.description || '',
        needsPriceUpdate,
        needsDescUpdate,
      });
    }
  }
  
  // Display results
  console.log(`📊 Matching Results:`);
  console.log(`   ✅ Matched: ${updates.length} items to update`);
  console.log(`   ⚠️  Unmatched: ${unmatched.length} items`);
  console.log('');
  
  if (unmatched.length > 0) {
    console.log('⚠️  Unmatched items (not found in database):');
    unmatched.slice(0, 20).forEach(item => {
      console.log(`   - ${item.name}${item.category ? ` (${item.category})` : ''}`);
    });
    if (unmatched.length > 20) {
      console.log(`   ... and ${unmatched.length - 20} more`);
    }
    console.log('');
  }
  
  if (updates.length === 0) {
    console.log('✅ No updates needed. All items are already up to date.');
    process.exit(0);
  }
  
  // Show preview of updates
  console.log('📝 Preview of updates (first 10):');
  updates.slice(0, 10).forEach(update => {
    console.log(`\n   ${update.name}`);
    if (update.needsPriceUpdate) {
      console.log(`     Price: $${update.oldPrice} → $${update.newPrice}`);
    }
    if (update.needsDescUpdate) {
      console.log(`     Description: "${update.oldDescription}" → "${update.newDescription}"`);
    }
  });
  if (updates.length > 10) {
    console.log(`\n   ... and ${updates.length - 10} more updates`);
  }
  console.log('');
  
  // Ask for confirmation (in a real script, you might want to use readline)
  console.log(`⚠️  About to update ${updates.length} menu items.`);
  console.log('   Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
  
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Perform updates
  console.log('💾 Updating database...\n');
  let successCount = 0;
  let errorCount = 0;
  
  for (const update of updates) {
    const updateData = {};
    if (update.needsPriceUpdate) {
      updateData.sale_price = update.newPrice;
    }
    if (update.needsDescUpdate) {
      updateData.description = update.newDescription || null;
    }
    
    const { error } = await supabase
      .from('sale_products')
      .update(updateData)
      .eq('id', update.id);
    
    if (error) {
      console.error(`❌ Error updating "${update.name}":`, error.message);
      errorCount++;
    } else {
      console.log(`✅ Updated: ${update.name}`);
      successCount++;
    }
  }
  
  console.log('\n📊 Update Summary:');
  console.log(`   ✅ Success: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📝 Total: ${updates.length}`);
  
  if (unmatched.length > 0) {
    console.log(`\n⚠️  Note: ${unmatched.length} items from CSV were not matched.`);
    console.log('   You may need to check the names manually or add them to the database.');
  }
  
  console.log('\n✅ Script completed!');
}

// Run the script
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
