import { query } from "./_generated/server";

/** Debug: count all documents in each table */
export const countAll = query({
  args: {},
  handler: async (ctx) => {
    const accessories = await ctx.db.query("accessories").collect();
    const inventory = await ctx.db.query("inventory").collect();
    return {
      accessoriesCount: accessories.length,
      inventoryCount: inventory.length,
      firstAccessory: accessories[0] ? { category: accessories[0].category, brand: accessories[0].brand } : null,
      firstInventory: inventory[0] ? { title: inventory[0].title, status: inventory[0].status } : null,
    };
  },
});
