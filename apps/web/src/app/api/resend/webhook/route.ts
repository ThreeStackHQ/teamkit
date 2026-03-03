import { NextRequest, NextResponse } from "next/server";

interface ResendWebhookEvent {
  type: string;
  data: {
    email_id?: string;
    to?: string[];
    subject?: string;
    created_at?: string;
    [key: string]: unknown;
  };
}

// POST /api/resend/webhook — Resend delivery tracking
export async function POST(req: NextRequest) {
  let event: ResendWebhookEvent;
  try {
    event = await req.json() as ResendWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { type, data } = event;

  switch (type) {
    case "email.sent":
      console.info(`[TeamKit/Resend] Email sent: ${data.email_id} to ${data.to?.join(", ")}`);
      break;
    case "email.delivered":
      console.info(`[TeamKit/Resend] Email delivered: ${data.email_id}`);
      break;
    case "email.delivery_delayed":
      console.warn(`[TeamKit/Resend] Email delivery delayed: ${data.email_id}`);
      break;
    case "email.complained":
      console.warn(`[TeamKit/Resend] Spam complaint for: ${data.email_id}, to: ${data.to?.join(", ")}`);
      break;
    case "email.bounced":
      console.warn(`[TeamKit/Resend] Email bounced: ${data.email_id}, to: ${data.to?.join(", ")}`);
      break;
    case "email.opened":
      console.info(`[TeamKit/Resend] Email opened: ${data.email_id}`);
      break;
    case "email.clicked":
      console.info(`[TeamKit/Resend] Email link clicked: ${data.email_id}`);
      break;
    default:
      console.info(`[TeamKit/Resend] Unhandled webhook event: ${type}`);
  }

  return NextResponse.json({ received: true });
}
