import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Query to list all accessories with their fitment info
export const listFitment = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("accessories").collect();
    return all.map(a => ({
      _id: a._id,
      brand: a.brand,
      series: a.series,
      category: a.category,
      fitmentMakes: a.fitmentMakes || [],
      notes: a.notes || "",
    }));
  },
});

// Mutation to update fitment for a specific accessory
export const setFitment = mutation({
  args: {
    id: v.id("accessories"),
    fitmentMakes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { fitmentMakes: args.fitmentMakes });
    return null;
  },
});
