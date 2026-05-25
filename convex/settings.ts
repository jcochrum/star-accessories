import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

export const updateLaborRate = mutation({
  args: { rate: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "laborRate"))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { value: args.rate });
    } else {
      await ctx.db.insert("settings", { key: "laborRate", value: args.rate });
    }
    return null;
  },
});

export const setImageUrl = internalMutation({
  args: { partNumber: v.string(), imageUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const item = await ctx.db
      .query("accessories")
      .withIndex("by_partNumber", (q) => q.eq("partNumber", args.partNumber))
      .unique();
    if (item) {
      await ctx.db.patch(item._id, { imageUrl: args.imageUrl });
    }
    return null;
  },
});

export const bulkSetImages = internalMutation({
  args: { images: v.array(v.object({ partNumber: v.string(), imageUrl: v.string() })) },
  returns: v.null(),
  handler: async (ctx, args) => {
    for (const img of args.images) {
      const item = await ctx.db
        .query("accessories")
        .withIndex("by_partNumber", (q) => q.eq("partNumber", img.partNumber))
        .unique();
      if (item) {
        await ctx.db.patch(item._id, { imageUrl: img.imageUrl });
      }
    }
    return null;
  },
});
