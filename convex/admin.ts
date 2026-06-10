import { action, internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

declare const process: { env: Record<string, string | undefined> };

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
    fitment: v.optional(v.array(v.object({
      make: v.string(),
      models: v.array(v.string()),
      cabTypes: v.array(v.string()),
    }))),
    fitmentCabTypes: v.optional(v.array(v.string())),
    updatedBy: v.optional(v.string()),  // "Viktor" or admin name
    isVisible: v.optional(v.boolean()),
    images: v.optional(v.array(v.object({
      url: v.string(),
      isPrimary: v.optional(v.boolean()),
      caption: v.optional(v.string()),
      make: v.optional(v.string()),
    }))),
    productFamily: v.optional(v.string()),
    compatibleCALengths: v.optional(v.array(v.string())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, updatedBy, ...fields } = args;
    // Remove undefined fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    // Track price changes
    const priceFields = ["cost", "sellPrice", "markupPercent"];
    const hasPriceChange = priceFields.some((f) => f in updates);
    if (hasPriceChange) {
      updates.priceUpdatedAt = Date.now();
      updates.priceUpdatedBy = updatedBy || "Admin";
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
    isVisible: v.optional(v.boolean()),
    compatibleCALengths: v.optional(v.array(v.string())),
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

// Patch inventory item (e.g. backfill images)
export const patchInventoryItem = mutation({
  args: {
    id: v.id("inventory"),
    imageUrl: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
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
      fitment: v.optional(v.array(v.object({
        make: v.string(),
        models: v.array(v.string()),
        cabTypes: v.array(v.string()),
      }))),
      fitmentCabTypes: v.optional(v.array(v.string())),
      sortOrder: v.number(),
      priceUpdatedAt: v.optional(v.number()),
      priceUpdatedBy: v.optional(v.string()),
      isVisible: v.optional(v.boolean()),
      images: v.optional(v.array(v.object({
        url: v.string(),
        isPrimary: v.optional(v.boolean()),
        caption: v.optional(v.string()),
        make: v.optional(v.string()),
      }))),
      productFamily: v.optional(v.string()),
      compatibleCALengths: v.optional(v.array(v.string())),
    })
  ),
  handler: async (ctx) => {
    return await ctx.db.query("accessories").collect();
  },
});

/* ──────────────────── FORGOT PASSWORD ──────────────────── */

// Authorized admin emails that can reset the password
const ADMIN_EMAILS = [
  "jon.cochrum@trailerplace.com",
  "jcochrum@hotmail.com",
  "craig.gingles@trailerplace.com",
];

// Store a reset code in settings (key: "adminResetCode", value: JSON {code, email, expiresAt})
export const storeResetCode = internalMutation({
  args: { code: v.string(), email: v.string(), expiresAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminResetCode"))
      .unique();
    const value = JSON.stringify({ code: args.code, email: args.email, expiresAt: args.expiresAt });
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("settings", { key: "adminResetCode", value });
    }
    return null;
  },
});

// Verify a reset code and set new password
export const verifyResetCode = mutation({
  args: { email: v.string(), code: v.string(), newPassword: v.string() },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "adminResetCode"))
      .unique();
    if (!setting) return { success: false, error: "No reset code found. Please request a new one." };

    const data = JSON.parse(setting.value) as { code: string; email: string; expiresAt: number };

    if (Date.now() > data.expiresAt) {
      return { success: false, error: "Reset code has expired. Please request a new one." };
    }
    if (data.email.toLowerCase() !== args.email.toLowerCase()) {
      return { success: false, error: "Email does not match the reset request." };
    }
    if (data.code !== args.code) {
      return { success: false, error: "Incorrect code. Please try again." };
    }

    // Code is valid — set new password
    const pwSetting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", ADMIN_PASSWORD_KEY))
      .unique();
    if (pwSetting) {
      await ctx.db.patch(pwSetting._id, { value: args.newPassword });
    } else {
      await ctx.db.insert("settings", { key: ADMIN_PASSWORD_KEY, value: args.newPassword });
    }

    // Clear reset code
    await ctx.db.delete(setting._id);

    return { success: true };
  },
});

// Action: send reset code email via Viktor Spaces Email API
export const sendResetEmail = action({
  args: { email: v.string() },
  returns: v.object({ success: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    const email = args.email.toLowerCase().trim();

    // Check if email is authorized
    if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
      // Don't reveal whether email exists — always say "sent"
      return { success: true };
    }

    // Generate 6-digit code
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const code = String(array[0] % 1000000).padStart(6, "0");
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

    // Store the code
    await ctx.runMutation(internal.admin.storeResetCode, { code, email, expiresAt });

    // Send email via Viktor Spaces API
    const apiUrl = process.env.VIKTOR_SPACES_API_URL;
    const projectName = process.env.VIKTOR_SPACES_PROJECT_NAME;
    const projectSecret = process.env.VIKTOR_SPACES_PROJECT_SECRET;

    if (!apiUrl || !projectName || !projectSecret) {
      return { success: false, error: "Email service not configured." };
    }

    const response = await fetch(`${apiUrl}/api/viktor-spaces/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_name: projectName,
        project_secret: projectSecret,
        to_email: email,
        subject: "Admin Password Reset — Star Accessories",
        html_content: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 420px; margin: 0 auto; padding: 24px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #0f172a; color: white; width: 48px; height: 48px; border-radius: 50%; line-height: 48px; font-size: 20px;">⭐</div>
            </div>
            <h2 style="color: #0f172a; text-align: center; margin-bottom: 8px;">Password Reset</h2>
            <p style="color: #64748b; text-align: center; margin-bottom: 24px;">Enter this code in the admin panel to set a new password:</p>
            <div style="background: #f1f5f9; padding: 20px; text-align: center; border-radius: 12px; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">${code}</span>
            </div>
            <p style="color: #94a3b8; font-size: 13px; text-align: center;">This code expires in 15 minutes.</p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
            <p style="color: #94a3b8; font-size: 12px; text-align: center;">Star Truck Equipment — Accessories Sales Tool</p>
          </div>
        `,
        text_content: `Password Reset Code: ${code}\n\nEnter this code in the admin panel to set a new password.\n\nThis code expires in 15 minutes.`,
        email_type: "otp",
      }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to send email. Please try again." };
    }

    return { success: true };
  },
});

// ── Category order management ──

export const getCategoryOrder = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "categoryOrder"))
      .unique();
    return setting ? (JSON.parse(setting.value) as string[]) : [];
  },
});

export const setCategoryOrder = mutation({
  args: { order: v.array(v.string()) },
  handler: async (ctx, { order }) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "categoryOrder"))
      .unique();
    if (setting) {
      await ctx.db.patch(setting._id, { value: JSON.stringify(order) });
    } else {
      await ctx.db.insert("settings", { key: "categoryOrder", value: JSON.stringify(order) });
    }
    return order;
  },
});

// ── Category visibility management ──

export const getHiddenCategories = query({
  args: {},
  handler: async (ctx) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hiddenCategories"))
      .unique();
    return setting ? (JSON.parse(setting.value) as string[]) : [];
  },
});

export const toggleCategoryVisibility = mutation({
  args: { category: v.string() },
  handler: async (ctx, { category }) => {
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hiddenCategories"))
      .unique();
    
    let hiddenCategories: string[] = setting ? JSON.parse(setting.value) : [];
    
    if (hiddenCategories.includes(category)) {
      hiddenCategories = hiddenCategories.filter((c) => c !== category);
    } else {
      hiddenCategories.push(category);
    }
    
    if (setting) {
      await ctx.db.patch(setting._id, { value: JSON.stringify(hiddenCategories) });
    } else {
      await ctx.db.insert("settings", { key: "hiddenCategories", value: JSON.stringify(hiddenCategories) });
    }
    
    return hiddenCategories;
  },
});

export const renameCategory = mutation({
  args: { oldName: v.string(), newName: v.string() },
  handler: async (ctx, { oldName, newName }) => {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error("Category name cannot be empty");
    if (trimmed === oldName) return;

    // Update category on all items in this category
    const items = await ctx.db.query("accessories").collect();
    const toUpdate = items.filter((i) => i.category === oldName);
    for (const item of toUpdate) {
      await ctx.db.patch(item._id, { category: trimmed });
    }

    // Update hidden categories list if the old name was hidden
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_key", (q) => q.eq("key", "hiddenCategories"))
      .unique();
    if (setting) {
      const hidden: string[] = JSON.parse(setting.value);
      const idx = hidden.indexOf(oldName);
      if (idx !== -1) {
        hidden[idx] = trimmed;
        await ctx.db.patch(setting._id, { value: JSON.stringify(hidden) });
      }
    }

    return { updated: toUpdate.length, newName: trimmed };
  },
});

// --- File Storage for Product Images ---
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getStorageUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
