export interface MenuItem {
  name: string;
  description?: string;
  price: number;
  highlight?: boolean;
  priceRange?: string;
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
  color?: string;
}

export interface MenuPage {
  id: string;
  title: string;
  categories: MenuCategory[];
}

export interface TwoColumnCategoryLayout {
  left: string[];
  /** If omitted, right column is computed as "all remaining categories" in page order. */
  right?: string[];
}

/**
 * Optional 3-column layout for in-store print pages.
 *
 * NOTE: property name `middleCollumn` is intentionally kept for backwards compatibility
 * with existing data/config naming.
 */
export interface ThreeColumnCategoryLayout extends TwoColumnCategoryLayout {
  /** Optional middle column category list (intentional spelling). */
  middleCollumn?: string[];
  /** Preferred spelling (supported as an alias). */
  middleColumn?: string[];
}

export type CategoryLayout = TwoColumnCategoryLayout | ThreeColumnCategoryLayout;

function normalizeCategoryName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, ' ');
}

export function splitCategoriesByLayout(page: MenuPage, layout: CategoryLayout): {
  leftCategories: MenuCategory[];
  middleCategories?: MenuCategory[];
  rightCategories: MenuCategory[];
  missing: { left: string[]; middle?: string[]; right: string[] };
} {
  const normalizedToCategory = new Map<string, MenuCategory>();
  for (const category of page.categories) {
    normalizedToCategory.set(normalizeCategoryName(category.name), category);
  }

  const leftNames = layout.left;
  const leftNormalized = new Set(leftNames.map(normalizeCategoryName));

  const middleNames = ('middleCollumn' in layout && Array.isArray(layout.middleCollumn) ? layout.middleCollumn : undefined)
    ?? ('middleColumn' in layout && Array.isArray(layout.middleColumn) ? layout.middleColumn : undefined)
    ?? [];
  const middleNormalized = new Set(middleNames.map(normalizeCategoryName));

  let rightNames: string[];
  if (layout.right && layout.right.length > 0) {
    const explicitRightNormalized = new Set(layout.right.map(normalizeCategoryName));
    const remainingRightNames = page.categories
      .map((c) => c.name)
      .filter((n) => !leftNormalized.has(normalizeCategoryName(n)) && !middleNormalized.has(normalizeCategoryName(n)) && !explicitRightNormalized.has(normalizeCategoryName(n)));
    rightNames = [...layout.right, ...remainingRightNames];
  } else {
    rightNames = page.categories
      .map((c) => c.name)
      .filter((n) => !leftNormalized.has(normalizeCategoryName(n)) && !middleNormalized.has(normalizeCategoryName(n)));
  }

  const missingLeft: string[] = [];
  const missingMiddle: string[] = [];
  const missingRight: string[] = [];

  const leftCategories: MenuCategory[] = leftNames
    .map((name) => {
      const category = normalizedToCategory.get(normalizeCategoryName(name));
      if (!category) missingLeft.push(name);
      return category;
    })
    .filter((category): category is MenuCategory => Boolean(category));

  const middleCategories: MenuCategory[] = middleNames
    .map((name) => {
      const category = normalizedToCategory.get(normalizeCategoryName(name));
      if (!category) missingMiddle.push(name);
      return category;
    })
    .filter((category): category is MenuCategory => Boolean(category));

  const rightCategories: MenuCategory[] = rightNames
    .map((name) => {
      const category = normalizedToCategory.get(normalizeCategoryName(name));
      if (!category) missingRight.push(name);
      return category;
    })
    .filter((category): category is MenuCategory => Boolean(category));

  return {
    leftCategories,
    middleCategories: middleCategories.length > 0 ? middleCategories : undefined,
    rightCategories,
    missing: {
      left: missingLeft,
      middle: missingMiddle.length > 0 ? missingMiddle : undefined,
      right: missingRight
    }
  };
}

// Store Information
export const storeInfo = {
  name: "PAPPA'S OCEAN CATCH BURGERS, FISH AND CHIPS",
  address: "2/87 UNITT ST, MELTON VIC 3337",
  phone: "PHONE ORDERS 97438150 or 0466994085",
  website: "https://www.pappasfishnchips.com.au/",
  hours: "TRADING HOURS: MON-SUN 11AM-8:30PM (FRI-9PM)",
  payment: "EFTPOS AVAILABLE, ONLINE AVAILABLE",
  social: "LIKE US ON FACEBOOK"
};

// In-store menu column layouts (source of truth for v1/v2/v3)
export const inStoreCategoryLayouts = {
  menu1: {
    left: ['BEEF BURGERS', 'CHICKEN BURGERS', 'FISH BURGERS', 'BURGERS ADD-ONS'],
    right: ['FOR VEGETARIANS', 'SNACK PACK', 'SOUVLAKI', 'STEAK SANDWICHES']
  },
  menu2: {
    middleCollumn: ['FISH', 'CHIPS', 'CHIPS & GRAVY'],
    right: ['PACKS', 'SPECIAL COMBO'],
    left: ['SIDES', 'SEAFOOD SIDES', 'SWEET']
  },
  menu3: {
    left: ['PACKS', 'BURGERS'],
    right: ['FOR VEGETARIANS', 'SIDES']
  }
} satisfies Record<string, CategoryLayout>;

// Menu Page 1 - Main Menu (Burgers, Fish, Packs)
// Categories sorted by number of items to balance heights
export const menuPage1: MenuPage = {
  id: "main-menu",
  title: "MAIN MENU",
  categories: [
    // 10 items - longest category
    {
      name: "BEEF BURGERS",
      color: "#dc2626",
      items: [
        { name: "PLAIN BEEF", description: "Beef Patty, Lettuce, & Tomato Sauce", price: 7.5 },
        { name: "THE LOT BEEF", description: "Beef Patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tomato Relish", price: 11.2 },
        { name: "CHEESE BURGER", description: "Beef Patty, Cheese, Lettuce, & Tomato Sauce", price: 8.3 },
        { name: "DOUBLE BEEF CHEESE", description: "Two Beef Patties, Double Cheese, Lettuce, & Tomato Sauce", price: 13.4 },
        { name: "MEXICAN", description: "Beef Patty, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 10.2 },
        { name: "TROPICAL", description: "Beef Patty, Bacon, Pineapple, Cheese, Lettuce, Mayo, & Tomato Relish", price: 10.3 },
        { name: "BLT CHEESE", description: "Beef Patty, Bacon, Cheese, Tomato, Lettuce, Mayo, & Tomato Sauce", price: 9.7 },
        { name: "BBQ CHEESE", description: "Beef Patty, Bacon, Cheese, Red Onion, Lettuce, & BBQ Sauce", price: 9.8 },
        { name: "THE AUSSIE", description: "Beef Patty, Egg, Bacon, Cheese, Beetroot, Tomato, Red Onion, Lettuce, BBQ Sauce, & Tomato Sauce", price: 12.2 },
        { name: "ROYALE WITH CHEESE", description: "Beef Patty, Double Cheese, Red Onion, Pickles, Tomato Relish & Mustard", price: 10.1 }
      ]
    },
    // 6 items
    {
      name: "CHICKEN BURGERS",
      color: "#f97316",
      items: [
        { name: "PLAIN CHICKEN", description: "Chicken Patty, Lettuce, & Mayo", price: 9.2 },
        { name: "CHICKEN BURGER WITH THE LOT", description: "Chicken Patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Mayo", price: 12.9 },
        { name: "CHICKEN BLT", description: "Chicken Patty, Bacon, Cheese, Tomato, Lettuce, & Mayo", price: 11.4 },
        { name: "PERI PERI CHICKEN", description: "Chicken Patty, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 11.9 },
        { name: "HAWAIIAN CHICKEN", description: "Chicken Patty, Bacon, Pineapple, Cheese, Lettuce, & Mayo", price: 12.5 },
        { name: "TRADITIONAL CHICKEN SCHNITZEL", description: "Crumbed Breast Fillet Schnitzel, Lettuce, & Mayo", price: 8.5 },
        { name: "KIDS CHICKEN BURGER", description: "Crumbed Chicken Patty, Cheese, Lettuce, & Tomato Sauce", price: 6.0 }
      ]
    },
    // 3 items
    {
      name: "FISH BURGERS",
      color: "#0891b2",
      items: [
        { name: "PLAIN FISH", description: "Fried Flake, Lettuce, & Tartare Sauce", price: 12.2 },
        { name: "CLASSIC FISH", description: "Fried Flake, Cheese, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 13.4 },
        { name: "THE LOT FISH BURGER", description: "Fried Flake, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 15.4 },
        { name: "Make Grilled Fish", description: "Any Grilled Fish Add $0.50", price: 0.5 }
      ]
    },
    // 7 items
    {
      name: "BURGERS ADD-ONS",
      color: "#e68bbd",
      items: [
        { name: "Make a meal / combo", description: "Half Serve Chip & a Can", price: 5.3, highlight: true },
        { name: "Add Egg / Bacon / Pineapple / Jalapenos", description: "", price: 1.0 },
        { name: "Add Cheese / Beetroot", description: "", price: 0.8 },
        { name: "Add Lettuce / Tomato", description: "", price: 0.4 },
        { name: "Add Pickle / Red Onion", description: "", price: 0.5 },
        { name: "Grilled Onion", description: "", price: 0.5 },
        { name: "Add Meat Patty", description: "", price: 3.5 }
      ]
    },
    {
      name: "FOR VEGETARIANS",
      color: "#10b981",
      items: [
        { name: "VEGGIE PACK", description: "1 Veggie Patty, 1 Potato Cake, 1 Veggie Dim Sim, & Half chips", price: 9.6 },
        { name: "VEGGIE SOUVLAKI", description: "Gourmet Vegetable Patty, Beetroot, Tomato, Red Onion, Lettuce, & Mayo", price: 7.1 },
        { name: "PLAIN VEGGIE BURGER", description: "Gourmet Vegetable Patty, Lettuce, & Tomato Sauce", price: 6.9 },
        { name: "CLASSIC VEGGIE BURGER", description: "Gourmet Vegetable Patty, Cheese, Tomato, Red Onion, Lettuce, Mayo, & Tomato Relish", price: 8.6 },
        { name: "SWEET POTATO CHIPS", description: "", price: 6.0 },
        { name: "VEGGIE SPRING ROLL", description: "", price: 2.0 },
        { name: "VEGGIE DIM SIM", description: "", price: 2.2 },
      ]
    },
    // 3 items
    {
      name: "SNACK PACK",
      color: "#16a34a",
      items: [
        { name: "Chicken Snack Pack", description: "Delicious chicken yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.", price: 15.3 },
        { name: "Lamb Snack Pack", description: "Delicious lamb yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.", price: 20.4 },
        { name: "Mix Snack Pack", description: "Delicious chicken and lamb yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.", price: 17.0 }
      ]
    },
    // 3 items
    {
      name: "STEAK SANDWICHES",
      color: "#7c2d12",
      items: [
        { name: "PLAIN STEAK", description: "Gourmet Steak, Lettuce, & Butter, Tomato Sauce", price: 10.1 },
        { name: "CLASSIC STEAK", description: "Gourmet Steak, Cheese, Tomato, Red Onion, Lettuce, & Butter, Tomato Sauce", price: 11.8 },
        { name: "CLASSIC STEAK LOT", description: "Gourmet Steak, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Butter, Tomato Sauce", price: 13.8 }
      ]
    },
    // 6 items
    {
      name: "SOUVLAKI",
      color: "#e5e68b",
      items: [
        { name: "LAMB SOUVLAKI", description: "Lamb Yiros Meat, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 12.8 },
        { name: "LAMB SOUVA WITH THE LOT", description: "Lamb Yiros Meat, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 15.6 },
        { name: "CHICKEN SOUVLAKI", description: "Chicken Yiros Meat, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 11.5 },
        { name: "CHICKEN SOUVA WITH THE LOT", description: "Chicken Yiros Meat, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 14.3 },
        { name: "MIX SOUVLAKI", description: "Lamb & Chicken Yiros Meat, Tomato, Red Onion, Lettuce, & Garlic sauce", price: 12.2 },
        { name: "MIX SOUVA WITH THE LOT", description: "Lamb & Chicken Yiros Meat, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 15.0 },
        { name: "FISH SOUVLAKI", description: "Fried Flake, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 12.2 },
        { name: "SOUVA LOT FISH", description: "Fried Flake, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 15.0 },
        { name: "GRILLED FISH SOUVLAKI", description: "Grilled Flake, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 12.7 },
        { name: "SOUVA LOT GRILLED FISH", description: "Grilled Flake, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 15.5 },
        { name: "VEGGIE SOUVLAKI", description: "Gourmet Vegetable Patty, Beetroot, Tomato, Red Onion, Lettuce, & Mayo", price: 7.1 },
        { name: "EXTRA LAMB MEAT", description: "Add extra lamb meat to any souvlaki", price: 4.0 },
        { name: "EXTRA CHICKEN MEAT", description: "Add extra chicken meat to any souvlaki", price: 3.0 }
      ]
    }
  ]
};

// Menu Page 2 - Packs and Fish Menu (Right Panel Content)
export const menuPage2: MenuPage = {
  id: "packs-menu",
  title: "PACKS",
  categories: [
    {
      name: "PACKS",
      color: "#dc2626",
      items: [
        { name: "FLAKE PACK FOR ONE", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips", price: 16.0 },
        { name: "FLAKE PACK FOR TWO", description: "2 Flakes, 2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 28.5 },
        { name: "FLAKE PACK FOR THREE", description: "3 Flakes, 3 Potato Cakes, 3 Dim Sims, & Medium Chips", price: 42.0 },
        { name: "FAMILY FLAKE PACK", description: "4 Flakes, 4 Potato Cakes, 4 Dim Sims, & Medium Chips", price: 54.0 },
        { name: "FLATHEAD PACK", description: "6 Flathead Fillets, & Small Chips", price: 22.0 },
        { name: "DIM & CAKE PACK", description: "2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 11.5 },
        { name: "PARTY PACK", description: "8 Potato Cakes, 8 Dim Sims, & Extra Large Chips", price: 35.0 },
        { name: "CALAMARI PACK", description: "4 Calamari Rings, & Small Chips", price: 11.6 },
        { name: "SALT & PEPPER SQUID PACK", description: "8 Salt & Pepper Squids, & Small Chips", price: 13.2 },
        { name: "KIDS PACK", description: "1 Fish Bite, 1 Potato Cake, 1 Dim Sim, & Half Chips", price: 10.5 },
        { name: "VALUE PACK", description: "Basa Fish Fillet, 1 Potato Cake, 1 Dim Sim, & Half Chips", price: 9.0 },
        { name: "VEGGIE PACK", description: "1 Veggie Patty, 1 Potato Cakes, 1 Veggie Dim Sim, & Half chips", price: 9.6 },
        { name: "NUGGET N CHIP PACK", description: "4 Chicken Nuggets, & Chips", price: 6.9 },
        { name: "8 CHICKEN NUGGETS", description: "Serve of 8", price: 7.5 },
        { name: "12 CHICKEN NUGGETS", description: "Serve of 12", price: 11.3 } 
      ]
    },
      {
      name: "SPECIAL COMBO",
      color: "#8b91e6",
      items: [
        { name: "FLAKE PACK FOR ONE WITH A CAN", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips with a 375ml Can", price: 19.0 },
        { name: "MEAL FOR ONE", description: "1 Flake, 2 Potato Cakes, 2 Dim Sims, & Half Chips with a 375ml Can", price: 19.0 },
        { name: "FLAKE PACK FOR TWO WITH 2 CANS", description: "2 Flakes, 2 Potato Cakes, 2 Dim Sims, & Small Chips with 2 x 375ml Cans", price: 33.2 },
        { name: "FAMILY FLAKE PACK WITH 1.25L DRINK", description: "4 Flakes, 4 Potato Cakes, 4 Dim Sims, & Medium Chips with 1.25l Drink", price: 60.0 },
        { name: "FISHERMAN'S CATCH", description: "1 Flake, 1 Scallop, 1 Seafood Stick, 2 Calamari Rings, & Half Chips with 375ml Can", price: 22.8 },
        { name: "DINNER BOX", description: "2 Flakes, 2 Fish Bites, 4 Potato Cakes, 4 Dim Sims, & Small Chips with 1.25L Drink", price: 46.0 }
      ]
    },
    {
      name: "FISH",
      color: "#0ea5e9",
      items: [
        { name: "Flake (Australian)", description: "Grilled Or Fried", price: 10.0 },
        { name: "Blue Grenadier", description: "Grilled Or Fried", price: 9.0 },
        { name: "Flathead", description: "3 Fillets Fried Only", price: 9.0 },
        { name: "Barramundi", description: "Grilled Or Fried", price: 9.0 },
        { name: "Whiting", description: "Grilled Or Fried", price: 9.0 },
        { name: "Butter Fish", description: "Grilled Or Fried", price: 9.0 },
        { name: "Basa", description: "Grilled Or Fried", price: 7.0 },
        { name: "Barracouta", description: "Fried", price: 9.0 },
        { name: "Make Grilled Fish", description: "Any Grilled Fish Add $0.50", price: 0.5 },
        { name: "Add Panko", description: "", price: 1.0 }

      ]
    },
    {
      name: "CHIPS",
      color: "#f59e0b",
      items: [
        { name: "Half Serve chip", description: "", price: 3.0 },
        { name: "Small", description: "Serves 1-2", price: 6.0 },
        { name: "Medium", description: "Serves 2-3", price: 8.5 },
        { name: "Large", description: "Serves 3-4", price: 11.5 },
        { name: "Extra Large", description: "Serves 4-5", price: 15.3 },
        { name: "Custom Amount", description: "Order any amount between $4-$20", price: 4.0, priceRange: "$4.00 - $20.00" },
        { name: "Sweet Potato Chip", description: "", price: 6.0 }
      ]
    },
    {
      name: "CHIPS & GRAVY",
      color: "#8b5cf6",
      items: [
        { name: "Small Chips & Gravy", description: "", price: 5.4 },
        { name: "Small Chips & Gravy With Cheese", description: "", price: 6.2 },
        { name: "Large Chips & Gravy", description: "", price: 7.9 },
        { name: "Large Chips & Gravy With Cheese", description: "", price: 8.7 },
        { name: "Small Tub of Gravy", description: "", price: 3.0 },
        { name: "Medium Tub of Gravy", description: "", price: 4.5 },
        { name: "Large Tub of Gravy", description: "", price: 6.5 }
      ]
    },
    {
      name: "SIDES",
      color: "#059669",
      items: [
        { name: "Dim Sim", description: "Steamed Or Fried", price: 1.8 },
        { name: "Dim Sim In Batter", description: "", price: 2.0 },
        { name: "South Melbourne Dim Sim", description: "", price: 3.0 },
        { name: "Vegie Dim Sim", description: "", price: 2.2 },
        { name: "Potato Cake", description: "", price: 1.8 },
        { name: "Cheese & Bacon Potato Cake", description: "", price: 5.0 },
        { name: "Spring Roll", description: "", price: 4.0 },
        { name: "Chiko Roll", description: "", price: 4.0 },
        { name: "Corn Jack", description: "", price: 4.0 },
        { name: "Chicken Breast Nugget", description: "", price: 1.0 },
        { name: "Dino Nugget", description: "", price: 1.0 },
        { name: "Frankfurt / Hotdog In Batter", description: "", price: 4.0 },
        { name: "Burger In Batter", description: "", price: 5.0 },
        { name: "Pickled Onion", description: "", price: 2.0 },
        { name: "Cheese Kransky In Batter", description: "", price: 5.0 },
        { name: "Onion Ring", description: "", price: 0.8 },
        { name: "Garlic Chicken Ball", description: "", price: 2.0 },
        { name: "Sweet Potato Chip", description: "", price: 6.0 },
        { name: "Hash Brown", description: "", price: 1.2 }
      ]
    },
    {
      name: "SEAFOOD SIDES",
      color: "#16a34a",
      items: [
        { name: "Seafood / Crab Stick", description: "", price: 1.5 },
        { name: "Fish Bite", description: "", price: 5.0 },
        { name: "Fish Cake", description: "", price: 3.5 },
        { name: "Calamari Ring", description: "", price: 1.5 },
        { name: "Scallop", description: "", price: 4.5 },
        { name: "Mussel In Batter", description: "", price: 1.0 },
        { name: "Salt & Pepper Squid", description: "Serve of 8", price: 7.5 },
        { name: "Prawn Cutlet", description: "", price: 2.5 },
        { name: "Prawn In Batter", description: "", price: 3.0 }
      ]
    },
    {
      name: "SWEET",
      color: "#f97316",
      items: [
        { name: "Pineapple Fritter", description: "", price: 3.5 },
        { name: "Banana Fritter", description: "", price: 3.5 },
        { name: "Mars Bar In Batter", description: "", price: 3.3 },
        { name: "Snicker In Batter", description: "", price: 3.3 },
        { name: "Hot Jam Donut", description: "Single", price: 1.2 },
        { name: "Hot Jam Donuts", description: "Serve of 6", price: 7.0 }
      ]
    }
  ]
};

// Menu Page 3 - Best Sellers and Special Items
export const menuPage3: MenuPage = {
  id: "bestsellers-special",
  title: "BEST SELLERS & SPECIALS",
  categories: [
    {
      name: "PACKS",
      color: "#dc2626",
      items: [
        { name: "FLAKE PACK FOR ONE", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips", price: 16.0 },
        { name: "FLAKE PACK FOR TWO", description: "2 Flakes, 2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 28.5 },
        { name: "FAMILY FLAKE PACK", description: "4 Flakes, 4 Potato Cakes, 4 Dim Sims, & Medium Chips", price: 54.0 },
        { name: "DINNER BOX", description: "2 Flakes, 2 Fish Bites, 4 Potato Cakes, 4 Dim Sims, & Small Chips with 1.25L Drink", price: 46.0 },
        { name: "FLATHEAD PACK", description: "6 Flathead Fillets, & Small Chips", price: 22.0 },
        { name: "DIM & CAKE PACK", description: "2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 11.5 },
        { name: "PARTY PACK", description: "8 Potato Cakes, 8 Dim Sims, & Extra Large Chips", price: 35.0 },
        { name: "8 Nuggets", description: "", price: 7.5 },
        { name: "12 Nuggets", description: "", price: 11.3 },
        { name: "CALAMARI PACK", description: "4 Calamari Rings, & Small Chips", price: 11.6 },
        { name: "SALT & PEPPER SQUID PACK", description: "8 Salt & Pepper Squids, & Small Chips", price: 13.2 },
        { name: "KIDS PACK", description: "1 Fish Bite, 1 Potato Cake, 1 Dim Sim, & Half Chips", price: 10.5 },
        { name: "NUGGET N CHIP PACK", description: "4 Chicken Nuggets, & Chips", price: 6.9 },
        { name: "FISHERMAN'S CATCH", description: "1 Flake, 1 Scallop, 1 Seafood Stick, 2 Calamari Rings, & Half Chips with 375ml Can", price: 22.8 }
      ]
    },
    {
      name: "BURGERS",
      color: "#dc2626",
      items: [
        { name: "THE LOT BEEF", description: "Beef Patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tomato Relish", price: 11.2 },
        { name: "CHEESE BURGER", description: "Beef Patty, Cheese, Lettuce, & Tomato Sauce", price: 8.3 },
        { name: "TROPICAL", description: "Beef Patty, Bacon, Pineapple, Cheese, Lettuce, Mayo, & Tomato Relish", price: 10.3 },
        { name: "BLT CHEESE", description: "Beef Patty, Bacon, Cheese, Tomato, Lettuce, Mayo, & Tomato Sauce", price: 9.7 },
        { name: "THE AUSSIE", description: "Beef Patty, Egg, Bacon, Cheese, Beetroot, Tomato, Red Onion, Lettuce, BBQ Sauce, & Tomato Sauce", price: 12.2 },
        { name: "CHICKEN BURGER WITH THE LOT", description: "Chicken Patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Mayo", price: 12.9 },
        { name: "CHICKEN BLT", description: "Chicken Patty, Bacon, Cheese, Tomato, Lettuce, & Mayo", price: 11.4 },
        { name: "PERI PERI CHICKEN", description: "Chicken Patty, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 11.9 },
        { name: "HAWAIIAN CHICKEN", description: "Chicken Patty, Bacon, Pineapple, Cheese, Lettuce, & Mayo", price: 12.5 },
        { name: "TRADITIONAL CHICKEN SCHNITZEL", description: "Crumbed Breast Fillet Schnitzel, Lettuce, & Mayo", price: 8.5 }
      ]
    },
    {
      name: "FOR VEGETARIANS",
      color: "#10b981",
      items: [
        { name: "VEGGIE PACK", description: "1 Veggie Patty, 2 Potato Cakes, 1 Veggie Dim Sim, & Half chips", price: 11.1 },
        { name: "VEGETABLE SOUVLAKI", description: "Gourmet Vegetable Patty, Beetroot, Tomato, Red Onion, Lettuce, & Mayo", price: 7.1 },
        { name: "PLAIN VEGGIE BURGER", description: "Gourmet Vegetable Patty, Lettuce, & Tomato Sauce", price: 6.9 },
        { name: "CLASSIC VEGGIE BURGER", description: "Gourmet Vegetable Patty, Cheese, Tomato, Red Onion, Lettuce, Mayo, & Tomato Relish", price: 8.6 },
        { name: "SWEET POTATO CHIPS", description: "", price: 6.0 },
        { name: "VEGGIE SPRING ROLL", description: "", price: 2.0 },
        { name: "VEGGIE DIM SIM", description: "", price: 2.2 },
      ]
    },
     {
      name: "FISH",
      color: "#0ea5e9",
      items: [
        { name: "Flake (Australian)", description: "Grilled Or Fried", price: 10.0 },
        { name: "Blue Grenadier", description: "Grilled Or Fried", price: 9.0 },
        { name: "Flathead", description: "3 Fillets Fried Only", price: 9.0 },
        { name: "Barramundi", description: "Grilled Or Fried", price: 9.0 },
        { name: "Whiting", description: "Grilled Or Fried", price: 9.0 },
        { name: "Butter Fish", description: "Grilled Or Fried", price: 9.0 },
        { name: "Basa", description: "Grilled Or Fried", price: 7.0 },
        { name: "Barracouta", description: "Fried", price: 9.0 },

      ]
    },
    {
      name: "SIDES",
      color: "#059669",
      items: [
        { name: "Dim Sim", description: "Steamed Or Fried", price: 1.8 },
        { name: "Dim Sim In Batter", description: "", price: 2.0 },
        { name: "South Melbourne Dim Sim", description: "", price: 3.0 },
        { name: "Potato Cake", description: "", price: 1.8 },
        { name: "Cheese & Bacon Potato Cake", description: "", price: 5.0 },
        { name: "Spring Roll", description: "", price: 4.0 },
        { name: "Chiko Roll", description: "", price: 4.0 },
        { name: "Corn Jack", description: "", price: 4.0 },
        { name: "Chicken Breast Nugget", description: "", price: 1.0 },
        { name: "Dino Nugget", description: "", price: 1.0 },
        { name: "Frankfurt / Hotdog In Batter", description: "", price: 4.0 },
        { name: "Burger In Batter", description: "", price: 5.0 },
        { name: "Cheese Kransky In Batter", description: "", price: 5.0 }
      ]
    }
  ]
};

export const allMenuPages = [menuPage1, menuPage2, menuPage3];
