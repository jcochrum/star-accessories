import { query } from "./_generated/server";
import { v } from "convex/values";

const accessoryValidator = v.object({
  _id: v.id("accessories"),
  _creationTime: v.number(),
  category: v.string(),
  brand: v.string(),
  series: v.string(),
  partNumber: v.string(),
  cost: v.number(),
  mapPrice: v.optional(v.number()),
  retailPrice: v.optional(v.number()),
  sellPrice: v.optional(v.number()),
  markupPercent: v.optional(v.number()),
  installHours: v.optional(v.number()),
  source: v.string(),
  notes: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  sortOrder: v.number(),
  fitmentMakes: v.optional(v.array(v.string())),
  fitment: v.optional(v.array(v.object({
    make: v.string(),
    models: v.array(v.string()),
    cabTypes: v.array(v.string()),
  }))),
  fitmentCabTypes: v.optional(v.array(v.string())),
  maxQty: v.optional(v.number()),
  isVisible: v.optional(v.boolean()),
  priceUpdatedAt: v.optional(v.number()),
  priceUpdatedBy: v.optional(v.string()),
  description: v.optional(v.string()),
  images: v.optional(v.array(v.object({
    url: v.string(),
    isPrimary: v.optional(v.boolean()),
    caption: v.optional(v.string()),
    make: v.optional(v.string()),
  }))),
  productFamily: v.optional(v.string()),
  compatibleCALengths: v.optional(v.array(v.string())),
});

export const listAll = query({
  args: {},
  returns: v.array(accessoryValidator),
  handler: async (ctx) => {
    return await ctx.db.query("accessories").collect();
  },
});

export const listByCategory = query({
  args: { category: v.string() },
  returns: v.array(accessoryValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("accessories")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .collect();
  },
});

export const getCategories = query({
  args: {},
  returns: v.array(v.object({ name: v.string(), count: v.number() })),
  handler: async (ctx) => {
    const all = await ctx.db.query("accessories").collect();
    const categoryMap = new Map<string, number>();
    for (const item of all) {
      categoryMap.set(item.category, (categoryMap.get(item.category) || 0) + 1);
    }
    const ORDER = [
      "Front Bumpers",
      "Rear Bumpers",
      "Grille Guards",
      "Steps & Running Boards",
      "Gooseneck Hitches",
      "Tow & Stow Hitches",
      "Hitches",
      "Pintle Hooks",
      "Toolboxes",
      "Side Packs",
      "Saddle Boxes",
      "Transfer Tanks",
      "Tank/Toolbox Combos",
      "Transfer Pumps",
      "Winches",
      "Winch Tracks",
      "Air Bags",
      "Air Tanks",
      "Compressors",
      "Jumper Cables",
      "Floor Mats",
      "Bed Liners",
      "Fire Extinguishers",
      "Vises",
      "Rat Packs",
      "CTech Cabinets",
      "Cabinet Lighting",
      "Work Lights",
      "Strobe Lights",
      "Rope Lights",
      "Ladder Racks",
      "Headache Racks",
      "Weekender Racks",
      "Cameras",
      "Back Up Sensors",
      "Back Up Alarms",
      "GPS Systems",
      "Welders",
      "Inverters & Plugs",
      "Hose Reels",
      "Laptop Mounts",
      "Master Lock Systems",
      "D-Rings",
      "Spare Tire Racks",
      "Mud Flaps",
    ];
    const result = [];
    for (const name of ORDER) {
      if (categoryMap.has(name)) {
        result.push({ name, count: categoryMap.get(name)! });
      }
    }
    for (const [name, count] of categoryMap) {
      if (!ORDER.includes(name)) {
        result.push({ name, count });
      }
    }
    return result;
  },
});

// ─── Customer-safe query (no cost/markup data, filtered categories) ──────────

const CUSTOMER_CATEGORIES = [
  "Toolboxes",
  "Transfer Tanks",
  "Tank/Toolbox Combos",
  "Toolbox/Fuel Tank Combos",
  "Transfer Pumps",
  "Front Bumper",
  "Front Bumpers",
  "Grille Guards",
  "Steps & Running Boards",
];

// Per-category brand+series allowlists (only items matching get through)
// Use "*" as the series list to allow all items from that brand
// Allowlist: controls which brands/series show on the customer-facing tool.
// Use "*" to allow ALL items for a brand. Omit a category entirely to allow everything.
// Only add restrictive entries when specific items must be hidden from customers.
const CATEGORY_ALLOWLIST: Record<string, Record<string, string[] | "*">> = {
  // All categories open — every item visible in admin is visible to customers.
  // Toolboxes note: BCI & UWS crossover boxes (63"+) were previously blocked.
  // If specific items need hiding again, add them back per-brand here.
};

const customerAccessoryValidator = v.object({
  _id: v.id("accessories"),
  _creationTime: v.number(),
  category: v.string(),
  brand: v.string(),
  series: v.string(),
  partNumber: v.string(),
  cost: v.number(),
  sellPrice: v.number(),
  installHours: v.optional(v.number()),
  installCost: v.number(),
  maxQty: v.optional(v.number()),
  source: v.string(),
  notes: v.optional(v.string()),
  imageUrl: v.optional(v.string()),
  fitmentMakes: v.optional(v.array(v.string())),
  fitment: v.optional(v.array(v.object({
    make: v.string(),
    models: v.array(v.string()),
    cabTypes: v.array(v.string()),
  }))),
  fitmentCabTypes: v.optional(v.array(v.string())),
  sortOrder: v.number(),
  images: v.optional(v.array(v.object({
    url: v.string(),
    isPrimary: v.optional(v.boolean()),
    caption: v.optional(v.string()),
    make: v.optional(v.string()),
  }))),
  productFamily: v.optional(v.string()),
  compatibleCALengths: v.optional(v.array(v.string())),
});

export const listAllCustomer = query({
  args: {},
  returns: v.array(customerAccessoryValidator),
  handler: async (ctx) => {
    const all = await ctx.db.query("accessories").collect();

    // Get default markup & labor rate from settings
    const markupSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "defaultMarkupPercent"))
      .unique();
    const laborRateSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "laborRate"))
      .unique();
    const defaultMarkup = markupSetting ? Number.parseFloat(markupSetting.value) : 40;
    const laborRate = laborRateSetting ? Number.parseFloat(laborRateSetting.value) : 150;

    const categorySet = new Set(CUSTOMER_CATEGORIES);

    // Get hidden categories from settings
    const hiddenCatsSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hiddenCategories"))
      .unique();
    const hiddenCategories = new Set(
      hiddenCatsSetting ? JSON.parse(hiddenCatsSetting.value) as string[] : []
    );

    return all
      .filter((a) => {
        // Skip items hidden by admin
        if (a.isVisible === false) return false;
        if (!categorySet.has(a.category)) return false;
        // Skip entire hidden categories
        if (hiddenCategories.has(a.category)) return false;
        // Also check the display category name (e.g. "Underbody Boxes" mapped from "Toolboxes")
        const displayCat = a.category === "Toolboxes" && a.series.toLowerCase().includes("underbody")
          ? "Underbody Boxes" : a.category;
        if (hiddenCategories.has(displayCat)) return false;
        // If this category has an allowlist, enforce it
        const allowlist = CATEGORY_ALLOWLIST[a.category];
        if (allowlist) {
          const allowedSeries = allowlist[a.brand];
          if (!allowedSeries) return false;
          if (allowedSeries !== "*" && !allowedSeries.includes(a.series)) return false;
        }
        return true;
      })
      .map((a) => {
        // Compute effective sell price (same logic as frontend getEffectiveSellPrice)
        let computedSellPrice: number;
        if (a.sellPrice !== undefined && a.sellPrice > 0) {
          computedSellPrice = a.sellPrice;
        } else if (a.cost > 0) {
          const markup = a.markupPercent ?? defaultMarkup;
          computedSellPrice = Math.round(a.cost * (1 + markup / 100));
        } else {
          computedSellPrice = 0;
        }
        // Pre-compute install cost
        const installCost = Math.round((a.installHours ?? 0) * laborRate);
        // Remap underbody boxes to their own customer-facing category
        const customerCategory =
          a.category === "Toolboxes" && a.series.toLowerCase().includes("underbody")
            ? "Underbody Boxes"
            : a.category;

        return {
          _id: a._id,
          _creationTime: a._creationTime,
          category: customerCategory,
          brand: a.brand,
          series: a.series,
          partNumber: a.partNumber,
          cost: 0,                   // Never expose cost to customers
          sellPrice: computedSellPrice,
          installHours: a.installHours,
          installCost,
          maxQty: a.maxQty,
          source: a.source,
          notes: a.notes,
          imageUrl: a.imageUrl,
          fitmentMakes: a.fitmentMakes,
          fitment: a.fitment,
          fitmentCabTypes: a.fitmentCabTypes,
          sortOrder: a.sortOrder,
          images: a.images,
          productFamily: a.productFamily,
          compatibleCALengths: a.compatibleCALengths,
        };
      })
      .filter((a) => a.sellPrice > 0); // Hide items with no price
  },
});

// Look up fitment data by part number (for auto-remember)
export const getFitmentByPartNumber = query({
  args: { partNumber: v.string() },
  returns: v.union(
    v.array(v.object({
      make: v.string(),
      models: v.array(v.string()),
      cabTypes: v.array(v.string()),
    })),
    v.null()
  ),
  handler: async (ctx, args) => {
    if (!args.partNumber) return null;
    const existing = await ctx.db
      .query("accessories")
      .withIndex("by_partNumber", (q) => q.eq("partNumber", args.partNumber))
      .first();
    return existing?.fitment ?? null;
  },
});

export const getLaborRate = query({
  args: {},
  returns: v.union(v.number(), v.null()),
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "laborRate"))
      .unique();
    return setting ? Number.parseFloat(setting.value) : null;
  },
});

export const getDefaultMarkup = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "defaultMarkupPercent"))
      .unique();
    return setting ? Number.parseFloat(setting.value) : 40;
  },
});
