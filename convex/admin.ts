import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Simple password check - stored in settings table
const ADMIN_PASSWORD_KEY = "adminPassword";
const DEFAULT_PASSWORD = "StarAdmin2026!";

export const checkPassword = query({
  args: { password: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", ADMIN_PASSWORD_KEY))
      .unique();
    const correctPassword = setting ? setting.value : DEFAULT_PASSWORD;
    return args.password === correctPassword;
  },
});

export const updateAccessory = mutation({
  args: {
    id: v.id("accessories"),
    cost: v.optional(v.number()),
    sellPrice: v.optional(v.number()),
    installHours: v.optional(v.number()),
    markupPercent: v.optional(v.number()),
    brand: v.optional(v.string()),
    series: v.optional(v.string()),
    partNumber: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    maxQty: v.optional(v.number()),
    fitmentMakes: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Remove undefined fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }
    return null;
  },
});

export const deleteAccessory = mutation({
  args: { id: v.id("accessories") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
    return null;
  },
});

export const addAccessory = mutation({
  args: {
    category: v.string(),
    brand: v.string(),
    series: v.string(),
    partNumber: v.string(),
    cost: v.number(),
    sellPrice: v.optional(v.number()),
    installHours: v.optional(v.number()),
    markupPercent: v.optional(v.number()),
    maxQty: v.optional(v.number()),
    source: v.string(),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    fitmentMakes: v.optional(v.array(v.string())),
    sortOrder: v.number(),
  },
  returns: v.id("accessories"),
  handler: async (ctx, args) => {
    return await ctx.db.insert("accessories", args);
  },
});

export const updateSetting = mutation({
  args: { key: v.string(), value: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.value });
    } else {
      await ctx.db.insert("settings", { key: args.key, value: args.value });
    }
    return null;
  },
});

export const getSetting = query({
  args: { key: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .unique();
    return setting ? setting.value : null;
  },
});

// Get all accessories with full details for admin view
export const listAllForAdmin = query({
  args: {},
  returns: v.array(
    v.object({
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
      maxQty: v.optional(v.number()),
      source: v.string(),
      notes: v.optional(v.string()),
      imageUrl: v.optional(v.string()),
      fitmentMakes: v.optional(v.array(v.string())),
      sortOrder: v.number(),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("accessories").collect();
  },
});
