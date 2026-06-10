/**
 * Stripe integration for $500 non-refundable deposit on accepted quotes.
 * Uses Stripe Checkout Sessions via REST API.
 */
declare const process: { env: Record<string, string | undefined> };
import { httpAction } from "./_generated/server";
import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import { api, internal } from "./_generated/api";

const DEPOSIT_AMOUNT_CENTS = 50000; // $500.00
const DEPOSIT_AMOUNT_DISPLAY = 500;

// ── Convex mutations for updating quote status ──

export const markDepositPending = mutation({
  args: {
    slug: v.string(),
    stripeSessionId: v.string(),
    scheduledDate: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    await ctx.db.patch(quote._id, {
      depositStatus: "pending",
      stripeSessionId: args.stripeSessionId,
      scheduledDate: args.scheduledDate,
      customerAcceptedAt: Date.now(),
    });
    return null;
  },
});

export const markDepositPaid = internalMutation({
  args: {
    stripeSessionId: v.string(),
    paymentIntentId: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const quotes = await ctx.db.query("quotes").collect();
    const quote = quotes.find(
      (q) => q.stripeSessionId === args.stripeSessionId
    );
    if (!quote) return null;
    await ctx.db.patch(quote._id, {
      status: "accepted",
      depositStatus: "paid",
      depositAmount: DEPOSIT_AMOUNT_DISPLAY,
      depositPaidAt: Date.now(),
      stripePaymentIntentId: args.paymentIntentId,
    });

    // Email notification handled by external cron (Viktor)
    return null;
  },
});

export const getDepositStatus = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const quote = await ctx.db
      .query("quotes")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    if (!quote) return null;
    return {
      status: quote.status,
      depositStatus: quote.depositStatus ?? "none",
      depositPaidAt: quote.depositPaidAt,
      scheduledDate: quote.scheduledDate,
      depositAmount: quote.depositAmount,
    };
  },
});

// ── HTTP actions for Stripe ──

/** Create a Stripe Checkout Session for $500 deposit */
export const createCheckoutSession = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { slug, scheduledDate } = body as {
    slug: string;
    scheduledDate?: string;
  };

  if (!slug) {
    return new Response(JSON.stringify({ error: "Missing slug" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  // Verify quote exists
  const quote = await ctx.runQuery(api.quotes.getBySlug, { slug });
  if (!quote) {
    return new Response(JSON.stringify({ error: "Quote not found" }), {
      status: 404,
      headers: corsHeaders(),
    });
  }
  if ((quote as Record<string, unknown>).depositStatus === "paid") {
    return new Response(
      JSON.stringify({ error: "Deposit already paid" }),
      { status: 400, headers: corsHeaders() }
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 500, headers: corsHeaders() }
    );
  }

  const siteUrl = process.env.SITE_URL || "https://star-accessories-e228af77.viktor.space";

  // Create Stripe Checkout Session
  const params = new URLSearchParams();
  params.append("mode", "payment");
  params.append("payment_method_types[0]", "card");
  params.append("line_items[0][price_data][currency]", "usd");
  params.append(
    "line_items[0][price_data][product_data][name]",
    "Installation Deposit — Non-Refundable"
  );
  params.append(
    "line_items[0][price_data][product_data][description]",
    `Quote ${slug}${scheduledDate ? ` — Preferred install: ${scheduledDate}` : ""}`
  );
  params.append(
    "line_items[0][price_data][unit_amount]",
    String(DEPOSIT_AMOUNT_CENTS)
  );
  params.append("line_items[0][quantity]", "1");
  params.append(
    "success_url",
    `${siteUrl}/quote/${slug}?deposit=success&session_id={CHECKOUT_SESSION_ID}`
  );
  params.append("cancel_url", `${siteUrl}/quote/${slug}?deposit=cancelled`);
  params.append("metadata[quote_slug]", slug);
  if (scheduledDate) {
    params.append("metadata[scheduled_date]", scheduledDate);
  }
  if (quote.customerEmail) {
    params.append("customer_email", quote.customerEmail);
  }

  const stripeRes = await fetch(
    "https://api.stripe.com/v1/checkout/sessions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );

  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    console.error("Stripe error:", JSON.stringify(session));
    return new Response(
      JSON.stringify({
        error: "Failed to create checkout session",
        details: session.error?.message,
      }),
      { status: 500, headers: corsHeaders() }
    );
  }

  // Mark quote as deposit pending
  await ctx.runMutation(api.stripe.markDepositPending, {
    slug,
    stripeSessionId: session.id,
    scheduledDate: scheduledDate || undefined,
  });

  return new Response(
    JSON.stringify({ url: session.url, sessionId: session.id }),
    { status: 200, headers: corsHeaders() }
  );
});

/** Verify a completed checkout session */
export const verifySession = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("session_id");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing session_id" }), {
      status: 400,
      headers: corsHeaders(),
    });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return new Response(
      JSON.stringify({ error: "Stripe not configured" }),
      { status: 500, headers: corsHeaders() }
    );
  }

  const stripeRes = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
    {
      headers: { Authorization: `Bearer ${stripeKey}` },
    }
  );

  const session = await stripeRes.json();

  if (!stripeRes.ok) {
    return new Response(
      JSON.stringify({ error: "Failed to verify session" }),
      { status: 500, headers: corsHeaders() }
    );
  }

  if (session.payment_status === "paid") {
    await ctx.runMutation(internal.stripe.markDepositPaid, {
      stripeSessionId: sessionId,
      paymentIntentId: session.payment_intent || undefined,
    });
  }

  return new Response(
    JSON.stringify({
      paid: session.payment_status === "paid",
      slug: session.metadata?.quote_slug,
      scheduledDate: session.metadata?.scheduled_date,
    }),
    { status: 200, headers: corsHeaders() }
  );
});

/** Handle Stripe webhook events */
export const handleWebhook = httpAction(async (ctx, request) => {
  const body = await request.text();
  let event: {
    type: string;
    data: {
      object: {
        id: string;
        payment_status: string;
        payment_intent: string;
        metadata: Record<string, string>;
      };
    };
  };
  try {
    event = JSON.parse(body);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.payment_status === "paid") {
      await ctx.runMutation(internal.stripe.markDepositPaid, {
        stripeSessionId: session.id,
        paymentIntentId: session.payment_intent || undefined,
      });
    }
  }

  return new Response("OK", { status: 200 });
});

/** Handle CORS preflight */
export const corsPreflightHandler = httpAction(async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
});

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}
