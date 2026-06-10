import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/** List all in-stock inventory items */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("inventory")
      .withIndex("by_status", (q) => q.eq("status", "in_stock"))
      .collect();
  },
});

/** Search inventory by title */
export const search = query({
  args: { term: v.string() },
  handler: async (ctx, { term }) => {
    if (!term.trim()) return [];
    return await ctx.db
      .query("inventory")
      .withSearchIndex("search_title", (q) => q.search("title", term))
      .take(20);
  },
});

/** List inventory filtered by fitment tag */
export const listByFitment = query({
  args: { tag: v.string() },
  handler: async (ctx, { tag }) => {
    const all = await ctx.db
      .query("inventory")
      .withIndex("by_status", (q) => q.eq("status", "in_stock"))
      .collect();
    return all.filter(
      (item) => item.fitmentTags && item.fitmentTags.includes(tag)
    );
  },
});

/** Bulk upsert inventory from scraper */
export const syncInventory = mutation({
  args: {
    items: v.array(
      v.object({
        title: v.string(),
        url: v.string(),
        price: v.optional(v.number()),
        salePrice: v.optional(v.number()),
        msrp: v.optional(v.number()),
        stockNumber: v.optional(v.string()),
        type: v.optional(v.string()),
        bedCategory: v.optional(v.string()),
        brand: v.optional(v.string()),
        model: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
        fitmentTags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, { items }) => {
    const now = Date.now();

    // Get existing items by URL for upsert
    const existing = await ctx.db.query("inventory").collect();
    const byUrl = new Map(existing.map((e) => [e.url, e]));

    let created = 0;
    let updated = 0;

    for (const item of items) {
      const ex = byUrl.get(item.url);
      if (ex) {
        // Update existing item — do NOT overwrite hasHaySpike (preserve manual overrides)
        await ctx.db.patch(ex._id, {
          title: item.title,
          price: item.price,
          salePrice: item.salePrice,
          msrp: item.msrp,
          stockNumber: item.stockNumber,
          type: item.type,
          bedCategory: item.bedCategory,
          brand: item.brand,
          model: item.model,
          imageUrl: item.imageUrl,
          fitmentTags: item.fitmentTags,
          status: "in_stock",
          lastSynced: now,
        });
        updated++;
      } else {
        // New item — auto-detect hay spike and trough from title for initial value only
        const hasHaySpike = /\bhay\b/i.test(item.title);
        const hasTrough = /\btrough\b/i.test(item.title);
        await ctx.db.insert("inventory", {
          ...item,
          hasHaySpike,
          hasTrough,
          status: "in_stock",
          lastSynced: now,
        });
        created++;
      }
    }

    // Mark items not in this sync as potentially sold
    const syncedUrls = new Set(items.map((i) => i.url));
    for (const ex of existing) {
      if (!syncedUrls.has(ex.url) && ex.status === "in_stock") {
        await ctx.db.patch(ex._id, { status: "sold" });
      }
    }

    return { created, updated, total: items.length };
  },
});

/** Reclassify bed categories - update bedCategory for items matching title patterns */
export const reclassifyBeds = mutation({
  args: {
    rules: v.array(v.object({
      titlePattern: v.string(),
      newCategory: v.string(),
    })),
  },
  handler: async (ctx, { rules }) => {
    const all = await ctx.db.query("inventory").collect();
    let updated = 0;

    for (const item of all) {
      for (const rule of rules) {
        if (item.title.toLowerCase().includes(rule.titlePattern.toLowerCase())) {
          await ctx.db.patch(item._id, { bedCategory: rule.newCategory });
          updated++;
          break;
        }
      }
    }

    return { updated, total: all.length };
  },
});

/** Backfill hasHaySpike flag on all inventory items based on title */
export const backfillHaySpike = mutation({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("inventory").collect();
    let updated = 0;
    for (const item of all) {
      const hasHaySpike = /hay/i.test(item.title);
      if (item.hasHaySpike !== hasHaySpike) {
        await ctx.db.patch(item._id, { hasHaySpike });
        updated++;
      }
    }
    return { updated, total: all.length };
  },
});

/** Update image gallery for an inventory item */
export const updateImageGallery = mutation({
  args: {
    id: v.id("inventory"),
    imageUrls: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { imageUrls: args.imageUrls });
    return null;
  },
});

/** Set hasHaySpike flag for a specific item */
export const setHaySpike = mutation({
  args: {
    id: v.id("inventory"),
    hasHaySpike: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { hasHaySpike: args.hasHaySpike });
    return null;
  },
});

/** Set hasTrough flag for a specific item */
export const setTrough = mutation({
  args: {
    id: v.id("inventory"),
    hasTrough: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { hasTrough: args.hasTrough });
    return null;
  },
});
