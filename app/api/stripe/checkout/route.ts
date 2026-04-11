import { auth } from "@/lib/auth";
import { db } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { NextResponse } from "next/server";

const SETTINGS_URL = process.env.NEXT_PUBLIC_APP_URL + "/dashboard";

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user || !session.user.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { user } = session;

    // 1. If user is already pro, redirect to Stripe Billing Portal to manage subscription
    if (user.id) {
        const dbUser = await db.user.findUnique({
            where: { id: user.id }
        });

        if (dbUser?.stripeCustomerId) {
            const stripeSession = await stripe.billingPortal.sessions.create({
                customer: dbUser.stripeCustomerId,
                return_url: SETTINGS_URL,
            });

            return new NextResponse(JSON.stringify({ url: stripeSession.url }));
        }
    }

    // 2. If user is free, redirect to Stripe Checkout
    const stripeSession = await stripe.checkout.sessions.create({
      success_url: SETTINGS_URL,
      cancel_url: SETTINGS_URL,
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      customer_email: session.user.email!,
      line_items: [
        {
          price_data: {
            currency: "USD",
            product_data: {
              name: "ClinicalDDI Professional",
            description: "Unlimited professional clinical reports.",
            },
            unit_amount: 1200,
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId: session.user.id,
      },
    });

    return new NextResponse(JSON.stringify({ url: stripeSession.url }));
  } catch (error) {
    console.error("[STRIPE_CHECKOUT_ERROR]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
