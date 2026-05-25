import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const quoteItemValidator = v.object({
  brand: v.string(),
  series: v.string(),
  partNumber: v.string(),
  category: v.string(),
  unitPrice: v.number(),
  quantity: v.number(),
  installHours: v.number(),
});

/** Generate a short random slug like "q-a7x3m" */
function generateSlug(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789"; // no ambiguous chars
  let slug = "q-";
  for (let i = 0; i < 6; i++) {
    slug += chars[Math.floor(Math.random() * chars.length)];
  }
  return slug;
}

export const createQuote = mutation({
  args: {
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    truckMake: v.optional(v.string()),
    truckConfig: v.optional(v.string()),
    vehicleInfo: v.optional(v.string()),
    inventoryUrl: v.optional(v.string()),
    inventoryTitle: v.optional(v.string()),
    inventoryPrice: v.optional(v.number()),
    items: v.array(quoteItemValidator),
    laborRate: v.number(),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),
  },
  returns: v.string(), // returns the slug
  handler: async (ctx, args) => {
    // Generate unique slug
    let slug = generateSlug();
    let existing = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    while (existing) {
      slug = generateSlug();
      existing = await ctx.db
        .query("quotes")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique();
    }

    await ctx.db.insert("quotes", {
      slug,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,
      truckMake: args.truckMake,
      truckConfig: args.truckConfig,
      vehicleInfo: args.vehicleInfo,
      inventoryUrl: args.inventoryUrl,
      inventoryTitle: args.inventoryTitle,
      inventoryPrice: args.inventoryPrice,
      items: args.items,
      laborRate: args.laborRate,
      notes: args.notes,
      createdBy: args.createdBy,
      status: "sent",
    });

    return slug;
  },
});

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").order("desc").take(50);
    return quotes.map((q) => ({
      _id: q._id,
      _creationTime: q._creationTime,
      slug: q.slug,
      customerName: q.customerName,
      truckMake: q.truckMake,
      truckConfig: q.truckConfig,
      vehicleInfo: q.vehicleInfo,
      inventoryTitle: q.inventoryTitle,
      inventoryPrice: q.inventoryPrice,
      items: q.items,
      laborRate: q.laborRate,
      status: q.status,
    }));
  },
});
