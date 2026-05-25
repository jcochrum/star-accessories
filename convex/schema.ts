import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
  ...authTables,

  accessories: defineTable({
    category: v.string(),
    brand: v.string(),
    series: v.string(),
    partNumber: v.string(),
    cost: v.number(),
    mapPrice: v.optional(v.number()),
    retailPrice: v.optional(v.number()),
    sellPrice: v.optional(v.number()),       // Manual override sell price (if set, used instead of markup calc)
    markupPercent: v.optional(v.number()),    // Per-item markup override (e.g. 50 = 50%). Falls back to default 40%
    installHours: v.optional(v.number()),
    maxQty: v.optional(v.number()),          // Max quantity allowed (e.g. 1 for bumpers/steps, undefined = unlimited)
    source: v.string(),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    fitmentMakes: v.optional(v.array(v.string())),  // e.g. ["Ford", "Ram"] — if set, only shown for matching truck. Empty/undefined = universal.
    sortOrder: v.number(),
  })
    .index("by_category", ["category", "sortOrder"])
    .index("by_brand", ["brand"])
    .index("by_partNumber", ["partNumber"]),

  quotes: defineTable({
    slug: v.string(),               // short unique ID for sharing (e.g. "q-abc123")
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    truckMake: v.optional(v.string()),       // Ford, Ram, Chevy / GMC, Cab & Chassis
    truckConfig: v.optional(v.string()),     // e.g. "Dually 2020+"
    vehicleInfo: v.optional(v.string()),     // e.g. "2024 F-350 DRW"
    inventoryUrl: v.optional(v.string()),    // link to STE inventory item (bed/body)
    inventoryTitle: v.optional(v.string()),
    inventoryPrice: v.optional(v.number()),  // bed price
    items: v.array(v.object({
      brand: v.string(),
      series: v.string(),
      partNumber: v.string(),
      category: v.string(),
      unitPrice: v.number(),
      quantity: v.number(),
      installHours: v.number(),
    })),
    laborRate: v.number(),
    notes: v.optional(v.string()),
    createdBy: v.optional(v.string()),    // salesperson name
    status: v.string(),                    // "draft" | "sent" | "accepted" | "expired"
  })
    .index("by_slug", ["slug"])
    .index("by_status", ["status"]),

  inventory: defineTable({
    title: v.string(),              // e.g. "2026 Bedrock Granite 11G-4 - 58\" ca drw"
    url: v.string(),                // Full URL on startruckequipment.com
    price: v.optional(v.number()),  // Listed sale price
    salePrice: v.optional(v.number()), // Sale price if different from regular price
    msrp: v.optional(v.number()),   // MSRP if available
    stockNumber: v.optional(v.string()),
    type: v.optional(v.string()),   // "Truck Bed", "Crane", "Front Bumper", etc.
    bedCategory: v.optional(v.string()), // "Non-Skirted", "Skirted", "Skirted Deluxe", "Hauler", "Utility", "Service Body", "Crane Body", "Platform", "Dump"
    brand: v.optional(v.string()),  // Bedrock, CM, Pronghorn, etc.
    model: v.optional(v.string()),  // Granite, Marble, SK, etc.
    imageUrl: v.optional(v.string()),
    fitmentTags: v.optional(v.array(v.string())),  // e.g. ["FD20C", "FD1719"] - truck fitment tags
    hasHaySpike: v.optional(v.boolean()),  // Auto-detected from title containing "hay"
    status: v.string(),             // "in_stock" | "pending" | "sold"
    lastSynced: v.number(),         // Timestamp of last scrape
  })
    .index("by_status", ["status"])
    .index("by_brand", ["brand"])
    .index("by_type", ["type"])
    .searchIndex("search_title", { searchField: "title" }),

  settings: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),
});

export default schema;
