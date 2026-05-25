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
      "Toolboxes",
      "Side Packs",
      "Saddle Boxes",
      "Transfer Tanks",
      "Tank/Toolbox Combos",
      "Transfer Pumps",
      "Winches",
      "Air Bags",
      "Jumper Cables",
      "Floor Mats",
      "Bed Liners",
      "Fire Extinguishers",
      "Vises",
      "Rat Packs",
      "CTech Cabinets",
      "Cabinet Lighting",
      "Work Lights",
      "Ladder Racks",
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
