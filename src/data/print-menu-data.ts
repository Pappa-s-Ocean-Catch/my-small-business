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

// Store Information
export const storeInfo = {
  name: "PAPPA'S OCEAN CATCH BURGERS, FISH AND CHIPS",
  address: "2/87 UNITT ST, MELTON VIC 3337",
  phone: "PHONE ORDERS 9743 8150",
  website: "https://pappasoceancatch-ea.com.au/",
  hours: "TRADING HOURS: MON-SUN 11AM-8:30PM (FRI-9PM)",
  payment: "EFTPOS AVAILABLE, ONLINE AVAILABLE",
  social: "LIKE US ON FACEBOOK"
};

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
        { name: "PLAIN BEEF", description: "Beef Patty, Lettuce, & Tomato Sauce", price: 6.0 },
        { name: "CHEESE BURGER", description: "Beef Patty, Cheese, Lettuce, & Tomato Sauce", price: 6.9 },
        { name: "MEXICAN", description: "Beef Patty, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 8.5 },
        { name: "TROPICAL", description: "Beef Patty, Pineapple, Bacon, Cheese, Lettuce, Mayo, & Tomato Relish", price: 8.9 },
        { name: "BLT CHEESE", description: "Beef Patty, Bacon, Lettuce, Tomato, Cheese, Mayo, & Tomato Sauce", price: 8.90 },
        { name: "BBQ CHEESE", description: "Beef Patty, Cheese, Bacon, Red Onion, Lettuce, & BBQ Sauce", price: 8.90 },
        { name: "THE AUSSIE", description: "Beef Patty, Egg, Bacon, Cheese, Beetroot, Tomato, Red Onion, Lettuce, BBQ Sauce, & Tomato Sauce", price: 9.9 },
        { name: "ROYALE WITH CHEESE", description: "Beef Patty, Double Cheese, Red Onion, Pickles, Tomato Relish & American Mustard", price: 9.50 },
        { name: "DOUBLE BEEF CHEESE", description: "Two Beef Patties, Double Cheese, Lettuce, & Tomato Sauce", price: 10.9 },
        { name: "THE LOT", description: "Beef Patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tomato Relish | Add Pineapple +1", price: 9.80 }
      ]
    },
    {
      name: "SNACK PACK",
      color: "#16a34a",
      items: [
        { name: "Chicken Snack Pack", description: "", price: 16.0 },
        { name: "Small Chicken Snack Pack", description: "", price: 10.0 },
        { name: "Lamb Snack Pack", description: "", price: 16.0 },
        { name: "Small Lamb Snack Pack", description: "", price: 10.0 },
        { name: "Mix Snack Pack", description: "", price: 17.0 }
      ]
    },
    // 6 items
    {
      name: "CHICKEN BURGERS",
      color: "#f97316",
      items: [
        { name: "PLAIN CHICKEN", description: "Breast Fillet Schnitzel, Lettuce, & Mayo", price: 6.5 },
        { name: "CHICKEN BLT", description: "Breast Fillet Schnitzel, Bacon, Lettuce, Tomato, Cheese, & Mayo", price: 8.9 },
        { name: "PERI PERI CHICKEN", description: "Breast Fillet Schnitzel, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 8.9 },
        { name: "TRADITIONAL CHICKEN SCHNITZEL", description: "Crumbed Breast Fillet Schnitzel, Lettuce & Mayo", price: 8.50 },
        { name: "HAWAIIAN CHICKEN", description: "Breast Fillet Schnitzel, Bacon, Pineapple, Cheese, Lettuce, & Mayo", price: 9.5 },
        { name: "CHICKEN BURGER WITH THE LOT", description: "Breast Fillet Schnitzel, Bacon, Egg, Cheese, Onion Tomato, Lettuce, & Mayo", price: 9.9 },
        { name: "KIDS CHICKEN BURGER", description: "Crumbed chicken patty, lettuce & tomato sauce", price: 6.99 }
      ]
    },
    // 2 items
    {
      name: "FISH BURGERS",
      color: "#0891b2",
      items: [
        { name: "PLAIN FISH", description: "Flake (Grilled Or Fried), Lettuce, & Tartare", price: 11.00 },
        { name: "CLASSIC FISH", description: "Flake (Grilled Or Fried), Cheese, Tomato, Lettuce, & Tartare", price: 11.50 }
      ]
    },
    // 6 items
    {
      name: "SOUVLAKI",
      color: "#16a34a",
      items: [
        { name: "LAMB SOUVLAKI", description: "Lamb Yiros Meat, Lettuce, Tomato, Red Onion, & Tzatziki", price: 12.50 },
        { name: "CHICKEN SOUVLAKI", description: "Breast Fillet Pieces, Lettuce, Tomato, Red Onion, & Tzatziki", price: 12.50 },
        { name: "MIX SOUVLAKI", description: "Lamb Yiros Meat & Breast Fillet Pieces, Lettuce, Tomato, Red Onion, & Tzatziki", price: 13.00 },
        { name: "FISH SOUVLAKI", description: "Flake (Grilled or Fried), Lettuce, Tomato, Red Onion, & Tartare Sauce", price: 13.00 },
        { name: "GRILLED FISH SOUVLAKI", description: "Grilled flake, lettuce, tomato, red onion, & tartare sauce", price: 13.50 },
        { name: "SOUVA WITH THE LOT", description: "Lamb Yiros Meat, Egg, Bacon, Cheese, Lettuce, Tomato Red Onion, & Tzatziki", price: 16.00 },
        { name: "SOUVA LOT CHICKEN", description: "Chicken, egg, bacon, cheese, lettuce, tomato, red onion, & tzatziki", price: 16.00 },
        { name: "SOUVA LOT FRIED FISH", description: "Fried fish, egg, bacon, cheese, lettuce, tomato, red onion, & tartare", price: 16.00 },
        { name: "SOUVA LOT MIX", description: "Mix meat, egg, bacon, cheese, lettuce, tomato, red onion, & tzatziki", price: 17.00 },
        { name: "VEGETABLE SOUVLAKI", description: "Gourmet Vegetable Patty, Lettuce, Tomato, Red Onion, & Mayo", price: 10.00 },
        { name: "EXTRA MEAT", description: "Add extra meat to any souvlaki", price: 4.50 }
      ]
    },
    // 3 items
    {
      name: "STEAK SANDWICHES",
      color: "#7c2d12",
      items: [
        { name: "PLAIN STEAK", description: "Gourmet Steak, Lettuce, & Tomato Sauce", price: 9.50 },
        { name: "CLASSIC STEAK", description: "Gourmet Steak, Lettuce, Tomato Sauce, Cheese, Tomato, & Red Onion", price: 10.00 },
        { name: "CLASSIC STEAK LOT", description: "Gourmet Steak, Lettuce, Tomato Sauce, Cheese, Egg, Bacon Tomato, & Red Onion", price: 13.00 }
      ]
    },
    // 2 items
    {
      name: "VEGETARIAN BURGERS",
      color: "#be185d",
      items: [
        { name: "PLAIN VEGGIE", description: "Gourmet Vegetable Patty, Lettuce, & Tomato Sauce", price: 8.50 },
        { name: "CLASSIC VEGGIE", description: "Gourmet Vegetable Patty, Cheese, Tomato, Red Onion, Lettuce, Mayo, & Tomato Relish", price: 10.00 }
      ]
    },
    // 1 item - shortest category
    {
      name: "MAKE A COMBO",
      color: "#16a34a",
      items: [
        { name: "$5.30", description: "3.00 CHIPS + A CAN", price: 5.3 }
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
        { name: "FLAKE PACK FOR ONE", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips", price: 15.0, highlight: true },
        { name: "FLAKE PACK FOR TWO", description: "2 Flake, 2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 27.0, highlight: true },
        { name: "FAMILY FLAKE PACK", description: "4 Flake, 4 Potato Cakes, 4 Dim Sims, & Medium Chips", price: 54.0, highlight: true },
        { name: "DINNER BOX", description: "2 Flake, 2 Fish Bites, 4 Potato Cakes, 4 Dim Sims, Small chips and 1.25L Drink", price: 46.0, highlight: true },
        { name: "FLATHEAD PACK", description: "6 Flathead fillets, & Medium Chips", price: 22.0, highlight: true },
        { name: "DIM & CAKE PACK", description: "2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 11.5, highlight: true },
        { name: "PARTY PACK", description: "8 Potato Cakes, 8 Dim Sims, & Extra Large Chips", price: 38.0, highlight: true },
        { name: "Calamari Pack", description: "4 Panko Crumbed Calamari, & Small Chips", price: 11.0, highlight: true },
        { name: "Salt & Pepper Squid Pack", description: "8 Salt & Pepper Squid, & Small Chips", price: 12.0, highlight: true },
        { name: "Fisherman's Catch", description: "1 Flake, 1 Scallop, 1 Seafood Stick, 2 Calamari Rings, 3.00 Chips & can", price: 21.5, highlight: true },
        { name: "Kids Snack Pack", description: "2 Flathead Fillets, & Small Chips", price: 11.0, highlight: true },
        { name: "KIDS PACK", description: "1 Fish Bite, 1 Potato Cake, 1 Dim Sim and 3.00 Chips", price: 10.5, highlight: true },
        { name: "NUGGET N CHIP PACK", description: "4 Nuggets + 200g Chips", price: 0, highlight: true, priceRange: "NA" },
        { name: "VEGETABLES PACK", description: "1 Vegetables Dim Sim, 1 Vegie Patty, 3 Falafel, $3 Chips", price: 0, highlight: true, priceRange: "NA" }
      ]
    },
    {
      name: "FISH",
      color: "#0ea5e9",
      items: [
        { name: "Flake", description: "Grilled Or Fried", price: 9.0 },
        { name: "Blue Grenadier", description: "Grilled Or Fried", price: 9.0 },
        { name: "Flathead", description: "3 Fillets Fried Only", price: 9.0 },
        { name: "Barramundi", description: "Grilled Or Fried", price: 9.0 },
        { name: "Whiting", description: "Grilled Or Fried", price: 9.0 },
        { name: "Butter Fish", description: "Grilled Or Fried", price: 9.0 },
        { name: "Barracouta", description: "Fried", price: 11.0 },
        { name: "Any Grilled Fish Add $0.50", description: "", price: 0.5 }
      ]
    },
    {
      name: "SIDES",
      color: "#059669",
      items: [
        { name: "Dim Sim", description: "Steamed or Fried", price: 1.8 },
        { name: "Potato Cake", description: "", price: 1.8 },
        { name: "Spring Roll", description: "", price: 4.0 },
        { name: "Chiko Roll", description: "", price: 4.0 },
        { name: "Corn Jack", description: "", price: 4.0 },
        { name: "Chicken Breast Nugget", description: "", price: 1.2 },
        { name: "Frankfurt In Batter", description: "", price: 4.5 },
        { name: "Burger In Batter", description: "", price: 5.0 },
        { name: "Vegie Dim Sim", description: "", price: 2.0 },
        { name: "Pickled Onion", description: "", price: 2.0 },
        { name: "South Melbourne Dim Sim", description: "", price: 3.0 },
        { name: "Cheese Kransky In Batter", description: "", price: 4.5 },
        { name: "Dim Sim In Batter", description: "", price: 2.5 },
        { name: "Cheese & Bacon Potato Cake", description: "", price: 5.0 }
      ]
    },
    {
      name: "CHIPS",
      color: "#f59e0b",
      items: [
        { name: "Small", description: "Serves 1-2", price: 5.50 },
        { name: "Medium", description: "Serves 2-3", price: 7.70 },
        { name: "Large", description: "Serves 3-4", price: 9.90 },
        { name: "Extra Large", description: "Serves 4-5", price: 12.20 },
        { name: "Custom Amount", description: "Order any amount between $4-$10", price: 4.0, priceRange: "$4.00 - $10.00" }
      ]
    },
    {
      name: "SEAFOOD SIDES",
      color: "#8b5cf6",
      items: [
        { name: "Seafood Stick", description: "", price: 1.8 },
        { name: "Fish Bite", description: "", price: 4.5 },
        { name: "Prawn Cutlet", description: "", price: 2.5 },
        { name: "Fish Cake", description: "", price: 3.5 },
        { name: "Calamari Ring", description: "Panko Crumbed", price: 1.5 },
        { name: "Scallop", description: "", price: 3.2 },
        { name: "Salt & Pepper Squid", description: "Serve of 8", price: 7.2 },
        { name: "Prawn In Batter", description: "", price: 3.0 }
      ]
    },
    {
      name: "CHICKEN BREAST NUGGETS",
      color: "#e11d48",
      items: [
        { name: "4 Nuggets", description: "", price: 4.0 },
        { name: "8 Nuggets", description: "", price: 9.0 },
        { name: "12 Nuggets", description: "", price: 13.0 }
      ]
    },
    {
      name: "SWEET",
      color: "#f97316",
      items: [
        { name: "Pineapple Fritter", description: "", price: 3.5 },
        { name: "Banana Fritter", description: "", price: 3.5 },
        { name: "Mars In Batter", description: "", price: 3.5 },
        { name: "Snickers In Batter", description: "", price: 3.5 },
        { name: "Hot Jam Donut", description: "Single", price: 1.0 },
        { name: "Hot Jam Donuts", description: "6 for $5", price: 5.0 }
      ]
    },
    {
      name: "SPECIAL COMBO",
      color: "#dc2626",
      items: [
        { name: "COMBO FLAKE PACK FOR 1 + CAN", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, Small Chips + Can", price: 17.5, highlight: true }
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
      name: "BEST SELLERS",
      color: "#dc2626",
      items: [
        { name: "FLAKE PACK FOR ONE", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips", price: 15.0, highlight: true },
        { name: "FLAKE PACK FOR TWO", description: "2 Flake, 2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 27.0, highlight: true },
        { name: "FAMILY FLAKE PACK", description: "4 Flake, 4 Potato Cakes, 4 Dim Sims. & Medium Chips", price: 54.0, highlight: true },
        { name: "DINNER BOX", description: "2 Flake, 2 Fish Bites, 4 Potato Cakes, 4 Dim Sims, Small chips and 1.25L Drink", price: 46.0, highlight: true },
        { name: "FLATHEAD PACK", description: "6 Flathead fillets, & Medium Chips", price: 22.0, highlight: true },
        { name: "DIM & CAKE PACK", description: "2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 11.50, highlight: true },
        { name: "PARTY PACK", description: "8 Potato Cakes, 8 Dim Sims, & Extra Large Chips", price: 38.0, highlight: true },
        { name: "4 Nuggets", description: "", price: 4.0 },
        { name: "8 Nuggets", description: "", price: 9.0 },
        { name: "12 Nuggets", description: "", price: 13.0 },
        { name: "Calamari Pack", description: "4 Panko Crumbed Calamari, & Small Chips", price: 11.0, highlight: true },
        { name: "Salt & Pepper Squid Pack", description: "8 Salt & Pepper Squid, & Small Chips", price: 12.0, highlight: true },
        { name: "Fisherman's Catch", description: "1 Flake, 1 Scallop, 1 Seafood Stick, 2 Calamari Rings 3.00 Chips & can", price: 21.50, highlight: true },
        { name: "Kids Snack Pack", description: "2 Flathead Fillets, & Small Chips", price: 11.0, highlight: true },
        { name: "KIDS PACK", description: "1 Fish Bite, 1 Potato Cake, 1 Dim Sim and 3.00 Chips", price: 10.50, highlight: true }
      ]
    },
    {
      name: "NEW ITEMS",
      color: "#f59e0b",
      items: [
        { name: "SNACK PACK (LAMB/CHICKEN)", description: "choice of meat (lamb or chicken), chips, garlic sauce, bbq sauce, and hot chilli.", price: 16.0, highlight: true },
        { name: "KIDS CHICKEN BURGER", description: "Crumbed chicken patty, tomato sauce, cheese, and lettuce.", price: 6.99, highlight: true },
        { name: "SWEET POTATO CHIPS", description: "", price: 6.0, highlight: true },
        { name: "VEGETARIAN SPRING ROLL", description: "", price: 3.50, highlight: true },
        { name: "DINO NUGGETS", description: "", price: 1.10, highlight: true },
        { name: "ONION RINGS", description: "", price: 0.80, highlight: true }
      ]
    },
    {
      name: "CHIPS & GRAVY",
      color: "#8b5cf6",
      items: [
        { name: "(SMALL) CHIPS & GRAVY", description: "", price: 5.0, highlight: true },
        { name: "(LARGE) CHIPS & GRAVY", description: "", price: 7.0, highlight: true }
      ]
    },
    {
      name: "TUBS",
      color: "#ec4899",
      items: [
        { name: "Small TUB", description: "", price: 3.0 },
        { name: "medium TUB", description: "", price: 4.50, highlight: true },
        { name: "Large TUB", description: "", price: 6.50 }
      ]
    },
    {
      name: "MEAL FOR ONE",
      color: "#06b6d4",
      items: [
        { name: "MEAL FOR ONE", description: "1 FRIED FLAKE, 2 POTATO CAKE, 2 DIM SIM, HALF SERVE CHIPS + 1 CAN", price: 19.0, highlight: true }
      ]
    },
    {
      name: "DRINKS",
      color: "#84cc16",
      items: [
        { name: "Any Can", description: "Soft drinks, energy drinks", price: 2.8 },
        { name: "Water Bottle", description: "", price: 3.0 },
        { name: "600ml Bottle", description: "Soft drinks, water, juice", price: 4.0 },
        { name: "1.25L Bottle", description: "Soft drinks, water", price: 5.0 },
        { name: "2L Bottle", description: "Soft drinks, water", price: 6.0 }
      ]
    }
  ]
};

export const allMenuPages = [menuPage1, menuPage2, menuPage3];
