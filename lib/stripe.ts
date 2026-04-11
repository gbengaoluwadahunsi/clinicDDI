import Stripe from "stripe";

const apiKey = process.env.STRIPE_API_KEY;

export const stripe = new Stripe(apiKey || "sk_test_placeholder", {
  apiVersion: "2026-03-25.dahlia", // Match the version expected by the installed Stripe SDK
  typescript: true,
});
