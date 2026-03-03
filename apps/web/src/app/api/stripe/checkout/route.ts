import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, workspaces } from "@teamkit/db";
import { getStripe } from "@/lib/stripe";
import { getServerSession } from "@/lib/auth";
import { env } from "@/lib/env";

// POST /api/stripe/checkout
export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    plan?: "indie" | "pro";
    workspaceId?: string;
  };

  const { plan, workspaceId } = body;

  if (!plan || !["indie", "pro"].includes(plan)) {
    return NextResponse.json({ error: "plan must be 'indie' or 'pro'" }, { status: 400 });
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const userId = (session.user as { id?: string }).id;
  if (workspace.ownerId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const priceId =
    plan === "indie" ? env.STRIPE_PRICE_INDIE : env.STRIPE_PRICE_PRO;

  const stripe = getStripe();

  // Get or create Stripe customer
  let customerId = workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: session.user.name ?? undefined,
      metadata: { workspaceId, plan },
    });
    customerId = customer.id;

    await db
      .update(workspaces)
      .set({ stripeCustomerId: customerId })
      .where(eq(workspaces.id, workspaceId));
  }

  const checkoutSession = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?success=1`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing?canceled=1`,
    metadata: { workspaceId, plan },
  });

  return NextResponse.json({ url: checkoutSession.url });
}
