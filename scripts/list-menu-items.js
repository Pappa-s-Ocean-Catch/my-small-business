/**
 * List Menu Items Script
 * 
 * This script lists all menu items from the database with their IDs, names, and prices.
 * Useful for matching with CSV data.
 */

// Load environment variables from .env.local
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const { writeFileSync } = require('fs');
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

async function main() {
  console.log('📋 Fetching all menu items from database...\n');
  
  const { data: items, error } = await supabase
    .from('sale_products')
    .select(`
      id,
      name,
      description,
      sale_price,
      sale_categories!sale_category_id(name)
    `)
    .order('name');
  
  if (error) {
    console.error('❌ Error fetching menu items:', error.message);
    process.exit(1);
  }
  
  if (!items || items.length === 0) {
    console.log('⚠️  No menu items found in database.');
    process.exit(0);
  }
  
  console.log(`✅ Found ${items.length} menu items\n`);
  
  // Display items
  console.log('📝 Menu Items:');
  console.log('─'.repeat(80));
  items.forEach((item, index) => {
    const category = Array.isArray(item.sale_categories) 
      ? item.sale_categories[0]?.name 
      : item.sale_categories?.name;
    console.log(`${index + 1}. ${item.name}`);
    console.log(`   ID: ${item.id}`);
    console.log(`   Price: $${item.sale_price}`);
    if (item.description) {
      console.log(`   Description: ${item.description}`);
    }
    if (category) {
      console.log(`   Category: ${category}`);
    }
    console.log('');
  });
  
  // Also save to JSON file for reference
  const outputPath = join(__dirname, '../menu/database-menu-items.json');
  const jsonData = items.map(item => ({
    id: item.id,
    name: item.name,
    description: item.description,
    sale_price: item.sale_price,
    category: Array.isArray(item.sale_categories) 
      ? item.sale_categories[0]?.name 
      : item.sale_categories?.name,
  }));
  
  writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), 'utf-8');
  console.log(`\n💾 Also saved to: ${outputPath}`);
  console.log('✅ Done!');
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
