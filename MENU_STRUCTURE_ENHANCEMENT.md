# Menu Structure Enhancement - Sub-Categories Support

## Overview

The sales menu system has been enhanced to support hierarchical categories with sub-categories. This allows for better organization of menu items, particularly useful for categories like "DRINKS" which can have sub-categories like "Can", "600ml Bottle", "1.25l Bottle", etc.

## Database Schema Changes

### Enhanced Tables

#### 1. `sale_categories` Table
- **Added**: `parent_category_id` - References another category to create sub-categories
- **Structure**: Supports unlimited nesting levels (though typically 2 levels: main category → sub-category)

#### 2. `sale_products` Table  
- **Added**: `sub_category_id` - References a sub-category within a main category
- **Constraint**: Sub-categories must have a parent category

### New Functions

#### 1. `get_category_hierarchy(category_uuid)`
Returns the complete hierarchy of categories with parent-child relationships.

#### 2. `get_products_with_hierarchy()`
Returns all products with their main category and sub-category information.

#### 3. `validate_sub_category()`
Trigger function that ensures sub-categories have a parent category when products are inserted or updated.

### New View

#### `menu_with_hierarchy`
A convenient view that joins products with their category hierarchy for easy menu browsing.

## Migration Files Created

### 1. Structure Migration: `20250922120727_add_sub_categories_support.sql`
- Adds sub-category support to existing tables
- Creates helper functions for hierarchy management
- Adds constraints to prevent circular references
- Creates trigger function for sub-category validation
- Includes sample sub-categories for DRINKS

### 2. Data Migration: `20250922120752_import_full_menu_data.sql`
- Imports all menu data from `full-menu.json`
- Creates 17 main categories
- Creates 6 sub-categories under DRINKS
- Imports 200+ menu items with proper categorization
- Creates the `menu_with_hierarchy` view

## Menu Structure Example

```
DRINKS (Main Category)
├── Can (Sub-category)
│   ├── Coke - $3.30
│   ├── Coke Zero - $3.30
│   ├── Sprite - $3.30
│   └── ...
├── 600ml Bottle (Sub-category)
│   ├── Coke - $4.40
│   ├── Coke Zero - $4.40
│   └── ...
├── 1.25l Bottle (Sub-category)
│   ├── Coke - $5.50
│   ├── Coke Zero - $5.50
│   └── ...
├── 2l Bottle (Sub-category)
│   ├── Coke - $6.50
│   ├── Coke Zero - $6.50
│   └── ...
├── Water (Sub-category)
│   └── 600ml - $2.20
└── Powerade Ion4 (Sub-category)
    ├── Powerade Red - $4.95
    └── Powerade Blue - $4.95
```

## Usage Examples

### Query Products with Hierarchy
```sql
-- Get all products with their category hierarchy
SELECT * FROM public.menu_with_hierarchy 
WHERE main_category_name = 'DRINKS' 
ORDER BY sub_category_sort, product_name;

-- Get products from a specific sub-category
SELECT * FROM public.menu_with_hierarchy 
WHERE sub_category_name = 'Can' 
ORDER BY product_name;
```

### Query Category Hierarchy
```sql
-- Get the complete category tree
SELECT * FROM public.get_category_hierarchy();

-- Get hierarchy for a specific category
SELECT * FROM public.get_category_hierarchy('category-uuid-here');
```

### Add New Sub-Category
```sql
-- First, get the main category ID
SELECT id FROM public.sale_categories WHERE name = 'DRINKS';

-- Then insert the sub-category
INSERT INTO public.sale_categories (name, description, parent_category_id, sort_order)
VALUES ('New Sub-Category', 'Description', 'main-category-uuid', 10);
```

### Add Product to Sub-Category
```sql
-- Insert product with both main category and sub-category
INSERT INTO public.sale_products (name, description, sale_price, sale_category_id, sub_category_id)
VALUES ('New Product', 'Description', 5.99, 'main-category-uuid', 'sub-category-uuid');
```

## Frontend Integration

The enhanced structure supports:

1. **Hierarchical Menu Display**: Show main categories with expandable sub-categories
2. **Filtered Views**: Filter products by main category or sub-category
3. **Breadcrumb Navigation**: Show category path (e.g., "DRINKS > Can > Coke")
4. **Organized Product Lists**: Group products under their respective sub-categories

## Benefits

1. **Better Organization**: Logical grouping of related items
2. **Improved User Experience**: Easier navigation for customers
3. **Scalability**: Easy to add new categories and sub-categories
4. **Flexibility**: Supports both simple categories and complex hierarchies
5. **Data Integrity**: Constraints prevent invalid category relationships

## Data Import Summary

The migration successfully imported:
- **17 Main Categories**: From BEEF BURGERS to ALL DAY BREAKFAST
- **6 Sub-Categories**: Under DRINKS (Can, 600ml Bottle, 1.25l Bottle, 2l Bottle, Water, Powerade Ion4)
- **200+ Menu Items**: All products from the full-menu.json file
- **Proper Relationships**: All products correctly linked to their categories and sub-categories

## Next Steps

1. **Update Frontend Components**: Modify menu display components to show hierarchy
2. **Add Category Management**: Create admin interface for managing categories and sub-categories
3. **Enhance Search**: Add category-based filtering and search
4. **Menu Analytics**: Track sales by category and sub-category
5. **Mobile Optimization**: Ensure hierarchical menu works well on mobile devices
