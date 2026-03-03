export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, subscriptions } from "@teamkit/db";
import { eq } from "drizzle-orm";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });

  if (!sub?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found" },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${process.env.NEXTAUTH_URL}/dashboard/billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
