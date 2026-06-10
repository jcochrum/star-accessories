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
    isCustomOrder: v.optional(v.boolean()),
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
      isCustomOrder: args.isCustomOrder,
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
      depositStatus: q.depositStatus,
      depositPaidAt: q.depositPaidAt,
      scheduledDate: q.scheduledDate,
      overrideBy: q.overrideBy,
      overrideReason: q.overrideReason,
      overrideAt: q.overrideAt,
      // CRM fields
      pipelineStage: q.pipelineStage,
      assignedTo: q.assignedTo,
      lostReason: q.lostReason,
      followUpDate: q.followUpDate,
      lastContactedAt: q.lastContactedAt,
      activityLog: q.activityLog,
      jobType: q.jobType,
      customerPhone: q.customerPhone,
      customerEmail: q.customerEmail,
    }));
  },
});

/** Get quotes that need deposit notifications sent to salesperson */
export const getPendingNotifications = query({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    return quotes.filter(
      (q) => q.depositStatus === "paid" && !q.depositNotificationSent
    );
  },
});

/** Get quotes that need day-before install reminders */
export const getPendingReminders = query({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    return quotes.filter(
      (q) =>
        q.scheduledDate === tomorrowStr &&
        !q.reminderSent &&
        (q.depositStatus === "paid" || q.depositStatus === "waived")
    );
  },
});

/** Get quotes needing 2-day-before SMS (install in 2 days, not yet sent) */
export const getPending2DaySmsReminders = query({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    const twoDays = new Date();
    twoDays.setDate(twoDays.getDate() + 2);
    const twoDaysStr = twoDays.toISOString().split("T")[0];
    return quotes
      .filter(
        (q) =>
          q.scheduledDate === twoDaysStr &&
          !q.reminder2DaySmsSent &&
          (q.depositStatus === "paid" || q.depositStatus === "waived")
      )
      .map((q) => ({
        slug: q.slug,
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        customerEmail: q.customerEmail,
        scheduledDate: q.scheduledDate,
        inventoryTitle: q.inventoryTitle,
      }));
  },
});

/** Get quotes needing 1-day-before follow-up SMS (install tomorrow, 2-day sent but no customer reply) */
export const getPendingSmsReminders = query({
  args: {},
  handler: async (ctx) => {
    const quotes = await ctx.db.query("quotes").collect();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    return quotes
      .filter(
        (q) =>
          q.scheduledDate === tomorrowStr &&
          q.reminder2DaySmsSent &&
          !q.reminderSmsSent &&
          (q.depositStatus === "paid" || q.depositStatus === "waived")
      )
      .map((q) => ({
        slug: q.slug,
        customerName: q.customerName,
        customerPhone: q.customerPhone,
        customerEmail: q.customerEmail,
        scheduledDate: q.scheduledDate,
        inventoryTitle: q.inventoryTitle,
        reminder2DaySmsAt: q.reminder2DaySmsAt,
      }));
  },
});

/** Mark deposit notification as sent */
export const markNotificationSent = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    await ctx.db.patch(quote._id, { depositNotificationSent: true });
    return null;
  },
});

/** Mark day-before reminder as sent */
export const markReminderSent = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    await ctx.db.patch(quote._id, { reminderSent: true });
    return null;
  },
});

export const markReminderSmsSent = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    await ctx.db.patch(quote._id, { reminderSmsSent: true });
    return null;
  },
});

/** Mark 2-day-before SMS as sent with timestamp */
export const markReminder2DaySmsSent = mutation({
  args: { slug: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    await ctx.db.patch(quote._id, {
      reminder2DaySmsSent: true,
      reminder2DaySmsAt: Date.now(),
    });
    return null;
  },
});

/** Override: manually schedule without deposit (requires team member name + reason) */
export const overrideSchedule = mutation({
  args: {
    slug: v.string(),
    scheduledDate: v.string(),
    overrideBy: v.string(),
    overrideReason: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    await ctx.db.patch(quote._id, {
      status: "accepted",
      scheduledDate: args.scheduledDate,
      overrideBy: args.overrideBy,
      overrideReason: args.overrideReason,
      overrideAt: Date.now(),
      depositStatus: "waived",
    });
    return null;
  },
});

/* ──────── CRM MUTATIONS ──────── */

export const updatePipeline = mutation({
  args: {
    id: v.id("quotes"),
    pipelineStage: v.string(),
    by: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const log = quote.activityLog || [];
    log.push({
      timestamp: Date.now(),
      action: "status_change",
      by: args.by,
      detail: `Status changed to ${args.pipelineStage}`,
    });
    const updates: Record<string, unknown> = {
      pipelineStage: args.pipelineStage,
      activityLog: log,
    };
    if (args.pipelineStage === "contacted") {
      updates.lastContactedAt = Date.now();
    }
    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const assignSalesperson = mutation({
  args: {
    id: v.id("quotes"),
    assignedTo: v.string(),
    by: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const log = quote.activityLog || [];
    log.push({
      timestamp: Date.now(),
      action: "assigned",
      by: args.by,
      detail: `Assigned to ${args.assignedTo}`,
    });
    await ctx.db.patch(args.id, { assignedTo: args.assignedTo, activityLog: log });
    return null;
  },
});

export const addNote = mutation({
  args: {
    id: v.id("quotes"),
    action: v.string(),
    by: v.string(),
    detail: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const log = quote.activityLog || [];
    log.push({
      timestamp: Date.now(),
      action: args.action,
      by: args.by,
      detail: args.detail,
    });
    const updates: Record<string, unknown> = { activityLog: log };
    if (["call", "email", "text"].includes(args.action)) {
      updates.lastContactedAt = Date.now();
    }
    await ctx.db.patch(args.id, updates);
    return null;
  },
});

export const setFollowUp = mutation({
  args: {
    id: v.id("quotes"),
    followUpDate: v.string(),
    by: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const log = quote.activityLog || [];
    log.push({
      timestamp: Date.now(),
      action: "note",
      by: args.by,
      detail: `Follow-up set for ${args.followUpDate}`,
    });
    await ctx.db.patch(args.id, { followUpDate: args.followUpDate, activityLog: log });
    return null;
  },
});

export const markLost = mutation({
  args: {
    id: v.id("quotes"),
    reason: v.string(),
    by: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const log = quote.activityLog || [];
    log.push({
      timestamp: Date.now(),
      action: "status_change",
      by: args.by,
      detail: `Marked as lost: ${args.reason}`,
    });
    await ctx.db.patch(args.id, { pipelineStage: "lost", lostReason: args.reason, activityLog: log });
    return null;
  },
});

export const setJobType = mutation({
  args: {
    id: v.id("quotes"),
    jobType: v.string(),
    by: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db.get(args.id);
    if (!quote) return null;
    const log = quote.activityLog || [];
    log.push({
      timestamp: Date.now(),
      action: "note",
      by: args.by,
      detail: `Job type set to ${args.jobType}`,
    });
    await ctx.db.patch(args.id, { jobType: args.jobType, activityLog: log });
    return null;
  },
});
