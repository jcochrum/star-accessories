import { httpRouter } from "convex/server";
import { auth } from "./auth";
import {
  createCheckoutSession,
  verifySession,
  handleWebhook,
  corsPreflightHandler,
} from "./stripe";

const http = httpRouter();
auth.addHttpRoutes(http);

// Stripe routes
http.route({
  path: "/stripe/create-checkout",
  method: "POST",
  handler: createCheckoutSession,
});

http.route({
  path: "/stripe/create-checkout",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/stripe/verify-session",
  method: "GET",
  handler: verifySession,
});

http.route({
  path: "/stripe/verify-session",
  method: "OPTIONS",
  handler: corsPreflightHandler,
});

http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: handleWebhook,
});

export default http;
