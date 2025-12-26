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
        { name: "PLAIN BEEF", description: "Beef Patty, Lettuce, & Tomato Sauce", price: 8.0 },
        { name: "CHEESE BURGER", description: "Beef Patty, Cheese, Lettuce, & Tomato Sauce", price: 8.7 },
        { name: "MEXICAN", description: "Beef Patty, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 10.6 },
        { name: "TROPICAL", description: "Beef Patty, Bacon, Pineapple, Cheese, Lettuce, Mayo, & Tomato Relish", price: 10.7 },
        { name: "BLT CHEESE", description: "Beef Patty, Bacon, Cheese, Tomato, Lettuce, Mayo, & Tomato Sauce", price: 10.1 },
        { name: "BBQ CHEESE", description: "Beef Patty, Bacon, Cheese, Red Onion, Lettuce, & BBQ Sauce", price: 10.2 },
        { name: "THE AUSSIE", description: "Beef Patty, Egg, Bacon, Cheese, Beetroot, Tomato, Red Onion, Lettuce, BBQ Sauce, & Tomato Sauce", price: 12.6 },
        { name: "ROYALE WITH CHEESE", description: "Beef Patty, Double Cheese, Red Onion, Pickles, Tomato Relish & American Mustard", price: 11.0 },
        { name: "DOUBLE BEEF CHEESE", description: "Two Beef Patties, Double Cheese, Lettuce, & Tomato Sauce", price: 14.2 },
        { name: "THE LOT", description: "Beef Patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tomato Relish | Add Pineapple +1", price: 11.6 }
      ]
    },
    {
      name: "SNACK PACK",
      color: "#16a34a",
      items: [
        { name: "Chicken Snack Pack", description: "Delicious chicken yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.", price: 12.5 },
        { name: "Small Chicken Snack Pack", description: "", price: 10.0 },
        { name: "Lamb Snack Pack", description: "Delicious lamb yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.", price: 15.5 },
        { name: "Small Lamb Snack Pack", description: "", price: 10.0 },
        { name: "Mix Snack Pack", description: "Delicious chicken and lamb yiros meat with chips and cheese, topped with chilli, barbecue and homemade garlic sauce.", price: 14.0 }
      ]
    },
    // 6 items
    {
      name: "CHICKEN BURGERS",
      color: "#f97316",
      items: [
        { name: "PLAIN CHICKEN", description: "Chicken patty, Lettuce, & Mayo", price: 11.0 },
        { name: "CHICKEN BLT", description: "Chicken Patty, Bacon, Cheese, Tomato, Lettuce, & Mayo", price: 13.1 },
        { name: "PERI PERI CHICKEN", description: "Chicken Patty, Jalapenos, Cheese, Tomato, Red Onion, Lettuce, & Peri Peri Mayo", price: 13.6 },
        { name: "TRADITIONAL CHICKEN SCHNITZEL", description: "Crumbed Breast Fillet Schnitzel, Lettuce, & Mayo", price: 9.1 },
        { name: "HAWAIIAN CHICKEN", description: "Chicken Patty, Bacon, Pineapple, Cheese, Lettuce, & Mayo", price: 14.2 },
        { name: "CHICKEN BURGER WITH THE LOT", description: "Chicken patty, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Mayo", price: 14.6 },
        { name: "KIDS CHICKEN BURGER", description: "Crumbed Chicken Patty, Cheese, Lettuce, & Tomato Sauce", price: 7.0 }
      ]
    },
    // 2 items
    {
      name: "FISH BURGERS",
      color: "#0891b2",
      items: [
        { name: "PLAIN FISH", description: "Fried Flake, Lettuce, & Tartare Sauce", price: 13.0 },
        { name: "CLASSIC FISH", description: "Fried Flake, Cheese, Tomato, Lettuce, & Tartare Sauce", price: 14.15 }
      ]
    },
    // 6 items
    {
      name: "SOUVLAKI",
      color: "#16a34a",
      items: [
        { name: "LAMB SOUVLAKI", description: "Lamb Yiros Meat, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 15.2 },
        { name: "CHICKEN SOUVLAKI", description: "Chicken Yiros Meat, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 11.0 },
        { name: "MIX SOUVLAKI", description: "Lamb & Chicken Yiros Meat, Tomato, Red Onion, Lettuce, & Garlic sauce", price: 12.5 },
        { name: "FISH SOUVLAKI", description: "Fried Flake, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 12.2 },
        { name: "GRILLED FISH SOUVLAKI", description: "Grilled flake, lettuce, tomato, red onion, & tartare sauce", price: 0.5 },
        { name: "SOUVA WITH THE LOT", description: "Lamb Yiros Meat, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 17.9 },
        { name: "SOUVA LOT CHICKEN", description: "Chicken Yiros Meat, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 13.7 },
        { name: "SOUVA LOT FRIED FISH", description: "Fried Fish, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tartare Sauce", price: 14.9 },
        { name: "SOUVA LOT MIX", description: "Lamb & Chicken Yiros Meat, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Garlic Sauce", price: 15.2 },
        { name: "EXTRA MEAT", description: "Add extra lamb meat to any souvlaki", price: 4.50 }
      ]
    },
    // 3 items
    {
      name: "STEAK SANDWICHES",
      color: "#7c2d12",
      items: [
        { name: "PLAIN STEAK", description: "Gourmet Steak, Lettuce, & Tomato Sauce", price: 10.0 },
        { name: "CLASSIC STEAK", description: "Gourmet Steak, Cheese, Tomato, Red Onion, Lettuce, & Tomato Sauce", price: 11.5 },
        { name: "CLASSIC STEAK LOT", description: "Gourmet Steak, Egg, Bacon, Cheese, Tomato, Red Onion, Lettuce, & Tomato Sauce", price: 13.5 }
      ]
    },
    // 1 item - shortest category
    {
      name: "MAKE A COMBO",
      color: "#16a34a",
      items: [
        { name: "Chips & Can", description: "$3.00 CHIPS + A CAN", price: 5.3 }
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
        { name: "FLAKE PACK FOR ONE", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips", price: 18.0, highlight: true },
        { name: "FLAKE PACK FOR TWO", description: "2 Flakes, 2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 30.0, highlight: true },
        { name: "PACK FOR 3", description: "3 Butter Fish, 3 Potato Cakes, 3 Dim Sims, & Medium Chips", price: 42.0, highlight: true },
        { name: "FAMILY FLAKE PACK", description: "4 Flakes, 4 Potato Cakes, 4 Dim Sims, & Medium Chips", price: 57.0, highlight: true },
        { name: "DINNER BOX", description: "2 Flake, 2 Fish Bites, 4 Potato Cakes, 4 Dim Sims, Small chips and 1.25L Drink", price: 46.0, highlight: true },
        { name: "FLATHEAD PACK", description: "6 Flathead Fillets, & Small Chips", price: 30.0, highlight: true },
        { name: "DIM & CAKE PACK", description: "2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 12.0, highlight: true },
        { name: "PARTY PACK", description: "8 Potato Cakes, 8 Dim Sims, & Extra Large Chips", price: 39.0, highlight: true },
        { name: "Calamari Pack", description: "4 Calamari, & Small Chips", price: 14.0, highlight: true },
        { name: "Salt & Pepper Squid Pack", description: "8 Salt & Pepper Squids, & Small Chips", price: 15.5, highlight: true },
        { name: "Fisherman's Catch", description: "1 Flake, 1 Scallop, 1 Seafood Stick, 2 Calamari Rings, 3.00 Chips & can", price: 21.5, highlight: true },
        { name: "Kids Snack Pack", description: "2 Flathead Fillets, & Small Chips", price: 15.0, highlight: true },
        { name: "KIDS PACK", description: "1 Fish Bite, 1 Potato Cake, 1 Dim Sim, & Half Chips", price: 11.0, highlight: true },
        { name: "NUGGET N CHIP PACK", description: "4 Chicken Nuggets, & Chips", price: 6.0, highlight: true, priceRange: "NA" },
        { name: "Add Panko", description: "", price: 1.0, highlight: true, priceRange: "NA" }
      ]
    },
    {
      name: "FISH",
      color: "#0ea5e9",
      items: [
        { name: "Flake", description: "Grilled or Fried", price: 10.0 },
        { name: "Blue Grenadier", description: "Grilled or Fried", price: 8.5 },
        { name: "Flathead", description: "3 Fillets Fried only", price: 12.0 },
        { name: "Barramundi", description: "Grilled or Fried", price: 9.0 },
        { name: "Whiting", description: "Grilled or Fried", price: 9.0 },
        { name: "Butter Fish", description: "Grilled or Fried", price: 9.0 },
        { name: "Barracouta", description: "Fried only", price: 8.5 },
        { name: "Any Grilled Fish Add $0.50", description: "", price: 0.5 }
      ]
    },
    {
      name: "SIDES",
      color: "#059669",
      items: [
        { name: "Dim Sim", description: "Steamed or Fried", price: 1.8 },
        { name: "Potato Cake", description: "", price: 1.8 },
        { name: "Spring Roll", description: "", price: 3.6 },
        { name: "Chiko Roll", description: "", price: 4.2 },
        { name: "Corn Jack", description: "", price: 4.0 },
        { name: "Chicken Breast Nugget", description: "", price: 1.0 },
        { name: "Frankfurt In Batter", description: "", price: 4.0 },
        { name: "Burger In Batter", description: "", price: 5.2 },
        { name: "Pickled Onion", description: "", price: 2.0 },
        { name: "South Melbourne Dim Sim", description: "", price: 3.5 },
        { name: "Cheese Kransky In Batter", description: "", price: 5.5 },
        { name: "Dim Sim In Batter", description: "", price: 2.5 },
        { name: "Cheese & Bacon Potato Cake", description: "", price: 5.8 },
        { name: "DINO NUGGETS", description: "", price: 1.0, highlight: true }
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
        { name: "Extra Large", description: "Serves 4-5", price: 15.5 },
        { name: "Custom Amount", description: "Order any amount between $4-$15", price: 4.0, priceRange: "$4.00 - $15.00" }
      ]
    },
    {
      name: "SEAFOOD SIDES",
      color: "#8b5cf6",
      items: [
        { name: "Seafood Stick", description: "", price: 1.5 },
        { name: "Fish Bite", description: "", price: 5.0 },
        { name: "Prawn Cutlet", description: "", price: 3.2 },
        { name: "Fish Cake", description: "", price: 3.6 },
        { name: "Calamari Ring", description: "", price: 1.65 },
        { name: "Scallop", description: "", price: 4.5 },
        { name: "Mussels in batter", description: "", price: 1.0 },
        { name: "Salt & Pepper Squid", description: "Serve of 8", price: 10.0 },
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
        { name: "Hot Jam Donut", description: "Single", price: 1.5 },
        { name: "Hot Jam Donuts", description: "Serves of 6", price: 8.5 }
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
        { name: "FLAKE PACK FOR ONE", description: "1 Flake, 1 Potato Cake, 1 Dim Sim, & Small Chips", price: 18.0, highlight: true },
        { name: "FLAKE PACK FOR TWO", description: "2 Flakes, 2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 30.0, highlight: true },
        { name: "FAMILY FLAKE PACK", description: "4 Flakes, 4 Potato Cakes, 4 Dim Sims, & Medium Chips", price: 57.0, highlight: true },
        { name: "DINNER BOX", description: "2 Flake, 2 Fish Bites, 4 Potato Cakes, 4 Dim Sims, Small chips and 1.25L Drink", price: 46.0, highlight: true },
        { name: "FLATHEAD PACK", description: "6 Flathead Fillets, & Small Chips", price: 30.0, highlight: true },
        { name: "DIM & CAKE PACK", description: "2 Potato Cakes, 2 Dim Sims, & Small Chips", price: 12.0, highlight: true },
        { name: "PARTY PACK", description: "8 Potato Cakes, 8 Dim Sims, & Extra Large Chips", price: 39.0, highlight: true },
        { name: "4 Nuggets", description: "", price: 4.0 },
        { name: "8 Nuggets", description: "", price: 9.0 },
        { name: "12 Nuggets", description: "", price: 13.0 },
        { name: "Calamari Pack", description: "4 Calamari, & Small Chips", price: 14.0, highlight: true },
        { name: "Salt & Pepper Squid Pack", description: "8 Salt & Pepper Squids, & Small Chips", price: 15.5, highlight: true },
        { name: "Fisherman's Catch", description: "1 Flake, 1 Scallop, 1 Seafood Stick, 2 Calamari Rings 3.00 Chips & can", price: 21.50, highlight: true },
        { name: "Kids Snack Pack", description: "2 Flathead Fillets, & Small Chips", price: 15.0, highlight: true },
        { name: "KIDS PACK", description: "1 Fish Bite, 1 Potato Cake, 1 Dim Sim, & Half Chips", price: 11.0, highlight: true }
      ]
    },
    {
      name: "NEW ITEMS",
      color: "#f59e0b",
      items: [
        { name: "SNACK PACK (LAMB/CHICKEN)", description: "choice of meat (lamb or chicken), chips, garlic sauce, bbq sauce, and hot chilli.", price: 16.0, highlight: true },
        { name: "KIDS CHICKEN BURGER", description: "Crumbed Chicken Patty, Cheese, Lettuce, & Tomato Sauce", price: 7.0, highlight: true },
        { name: "ONION RINGS", description: "", price: 0.80, highlight: true }
      ]
    },
    {
      name: "FOR VEGETARIANS",
      color: "#10b981",
      items: [
        { name: "VEGETABLES PACK", description: "1 Vegie Dim Sim, 1 Vegie Patty, 3 Falafels, & Half Chips", price: 14.0, highlight: true },
        { name: "CLASSIC VEGGIE BURGER", description: "Gourmet Vegetable Patty, Cheese, Tomato, Red Onion, Lettuce, Mayo, & Tomato Relish", price: 8.6, highlight: true },
        { name: "VEGETABLE SOUVLAKI", description: "Gourmet Vegetable Patty, Beetroot, Tomato, Red Onion, Lettuce, & Mayo", price: 7.5, highlight: true },
        { name: "PLAIN VEGGIE BURGER", description: "Gourmet Vegetable Patty, Lettuce, & Tomato Sauce", price: 7.0, highlight: true },
        { name: "SWEET POTATO CHIPS", description: "", price: 6.0, highlight: true },
        { name: "VEGETARIAN SPRING ROLL", description: "", price: 3.6, highlight: true },
        { name: "VEGIE DIM SIM", description: "", price: 2.5, highlight: true },
      ]
    },
    {
      name: "CHIPS & GRAVY",
      color: "#8b5cf6",
      items: [
        { name: "(SMALL) CHIPS & GRAVY", description: "", price: 5.5, highlight: true },
        { name: "(LARGE) CHIPS & GRAVY", description: "", price: 8.5, highlight: true },
        { name: "Small Extras Gravy Tub", description: "", price: 3.0 },
        { name: "Medium Extras Gravy Tub", description: "", price: 4.50, highlight: true },
        { name: "Large Extras Gravy Tub", description: "", price: 6.50 }
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
        { name: "Any Can", description: "Soft drinks, juice, fanta, sprite, coke, etc", price: 2.8 },
        { name: "Water Bottle", description: "", price: 3.0 },
        { name: "600ml Bottle", description: "Soft drinks, water, juice", price: 4.0 },
        { name: "1.25L Bottle", description: "Soft drinks, water", price: 5.0 },
        { name: "2L Bottle", description: "Soft drinks, water", price: 6.0 },
        { name: "Monster Energy", description: "", price: 3.5 },
        { name: "Powerade Lon4", description: "Red or Blue", price: 4.5 }
      ]
    }
  ]
};

export const allMenuPages = [menuPage1, menuPage2, menuPage3];
