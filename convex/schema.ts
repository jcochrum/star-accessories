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
    fitment: v.optional(v.array(v.object({           // Detailed fitment per make
      make: v.string(),                               // "Ford", "Ram", "Chevy / GMC"
      models: v.array(v.string()),                    // ["F250", "F350", "F450", "F550"]
      cabTypes: v.array(v.string()),                  // ["Single Cab", "Extended Cab", "Crew Cab"]
    }))),
    fitmentCabTypes: v.optional(v.array(v.string())), // Universal cab types (independent of make): ["Single Cab", "Extended Cab", "Crew Cab", "Mega Cab"]
    sortOrder: v.number(),
    priceUpdatedAt: v.optional(v.number()),    // Timestamp of last price change
    priceUpdatedBy: v.optional(v.string()),    // Who updated: "Viktor", admin name, etc.
    isVisible: v.optional(v.boolean()),        // false = hidden from customer-facing tool. Default (undefined/true) = visible
    images: v.optional(v.array(v.object({      // Multiple product images
      url: v.string(),
      isPrimary: v.optional(v.boolean()),      // true = shown first / as thumbnail
      caption: v.optional(v.string()),
      make: v.optional(v.string()),            // "Ford", "Ram", "Chevy / GMC" — if set, only shown when customer selects this make. undefined = universal
    }))),
    productFamily: v.optional(v.string()),     // Group key for customer display. Items sharing the same productFamily+category show as ONE card (e.g. "Ranch Hand Legend")
    compatibleCALengths: v.optional(v.array(v.string())),  // e.g. ["38", "40", "42"] — CA lengths this accessory fits (used for underbody boxes)
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
    // Deposit & scheduling fields
    depositStatus: v.optional(v.string()),   // "none" | "pending" | "paid" | "refunded"
    depositAmount: v.optional(v.number()),   // 500 (cents: 50000)
    depositPaidAt: v.optional(v.number()),   // timestamp
    stripeSessionId: v.optional(v.string()), // Stripe Checkout Session ID
    stripePaymentIntentId: v.optional(v.string()), // For refund reference
    scheduledDate: v.optional(v.string()),   // ISO date string e.g. "2026-06-15"
    customerAcceptedAt: v.optional(v.number()), // timestamp when customer accepted
    // Override fields — when team manually schedules without deposit
    overrideBy: v.optional(v.string()),      // Team member name who overrode
    overrideReason: v.optional(v.string()),  // Why deposit was waived
    overrideAt: v.optional(v.number()),      // Timestamp of override
    // Notification tracking
    depositNotificationSent: v.optional(v.boolean()),  // email sent to salesperson?
    reminderSent: v.optional(v.boolean()),              // day-before email reminder sent?
    reminderSmsSent: v.optional(v.boolean()),           // 1-day-before SMS reminder sent?
    reminder2DaySmsSent: v.optional(v.boolean()),       // 2-day-before SMS reminder sent?
    reminder2DaySmsAt: v.optional(v.number()),          // timestamp when 2-day SMS was sent (for RC reply check)
    isCustomOrder: v.optional(v.boolean()),             // true when customer requested item not in stock
    // CRM fields
    pipelineStage: v.optional(v.string()),  // "new" | "contacted" | "quoted" | "scheduled" | "completed" | "lost"
    assignedTo: v.optional(v.string()),     // salesperson name
    lostReason: v.optional(v.string()),     // reason for lost deal
    followUpDate: v.optional(v.string()),   // ISO date for next follow-up
    lastContactedAt: v.optional(v.number()), // timestamp
    activityLog: v.optional(v.array(v.object({
      timestamp: v.number(),
      action: v.string(),      // "note" | "call" | "email" | "text" | "status_change" | "assigned"
      by: v.string(),          // who performed the action
      detail: v.string(),      // note text or description
    }))),
    jobType: v.optional(v.string()),        // "waiter" | "drop-off"
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
    imageUrls: v.optional(v.array(v.string())),    // All product images (scraped from product page)
    fitmentTags: v.optional(v.array(v.string())),  // e.g. ["FD20C", "FD1719"] - truck fitment tags
    hasHaySpike: v.optional(v.boolean()),  // Auto-detected from title containing "hay"
    hasTrough: v.optional(v.boolean()),    // Auto-detected from title containing "trough"
    description: v.optional(v.string()),   // Dealer notes / specs scraped from website
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
