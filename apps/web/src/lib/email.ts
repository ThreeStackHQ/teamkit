import { Resend } from "resend";
import { env } from "./env";

let _resend: Resend | undefined;

function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(env.RESEND_API_KEY);
  }
  return _resend;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

interface SendInvitationEmailParams {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  acceptUrl: string;
}

export async function sendInvitationEmail(params: SendInvitationEmailParams) {
  const { to, workspaceName, inviterName, role, acceptUrl } = params;

  const safeWorkspace = escapeHtml(workspaceName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);
  const safeTo = escapeHtml(to);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>You've been invited to ${safeWorkspace}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <div style="width: 48px; height: 48px; background: #8b5cf6; border-radius: 10px; margin-bottom: 24px; display: flex; align-items: center; justify-content: center;">
      <span style="color: #fff; font-size: 24px; font-weight: bold; line-height: 48px; display: block; text-align: center;">T</span>
    </div>
    <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">You've been invited</h1>
    <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      <strong style="color: #111827;">${safeInviter}</strong> has invited <strong style="color: #111827;">${safeTo}</strong> to join
      <strong style="color: #111827;">${safeWorkspace}</strong> as <strong style="color: #111827;">${safeRole}</strong>.
    </p>
    <a href="${acceptUrl}" style="display: inline-block; background: #8b5cf6; color: #fff; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 16px; text-decoration: none; margin-bottom: 24px;">
      Accept Invitation
    </a>
    <p style="color: #9ca3af; font-size: 14px; margin: 0;">
      This invitation expires in 48 hours. If you weren't expecting this, you can ignore it.
    </p>
  </div>
</body>
</html>`;

  return getResend().emails.send({
    from: "TeamKit <noreply@teamkit.io>",
    to,
    subject: `You've been invited to join ${safeWorkspace} as ${safeRole}`,
    html,
  });
}

interface SendInviteReminderParams {
  to: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
}

export async function sendInviteReminderEmail(params: SendInviteReminderParams) {
  const { to, workspaceName, role, acceptUrl } = params;

  const safeWorkspace = escapeHtml(workspaceName);
  const safeRole = escapeHtml(role);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Reminder: Invitation to ${safeWorkspace}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Reminder: Pending Invitation</h1>
    <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin: 0 0 24px 0;">
      You have a pending invitation to join <strong style="color: #111827;">${safeWorkspace}</strong> as
      <strong style="color: #111827;">${safeRole}</strong>. This invitation expires in 24 hours.
    </p>
    <a href="${acceptUrl}" style="display: inline-block; background: #8b5cf6; color: #fff; padding: 12px 24px; border-radius: 8px; font-weight: 600; font-size: 16px; text-decoration: none;">
      Accept Invitation
    </a>
  </div>
</body>
</html>`;

  return getResend().emails.send({
    from: "TeamKit <noreply@teamkit.io>",
    to,
    subject: `Reminder: You're invited to join ${safeWorkspace}`,
    html,
  });
}

interface SendInviteExpiredParams {
  to: string;
  workspaceName: string;
}

export async function sendInviteExpiredEmail(params: SendInviteExpiredParams) {
  const { to, workspaceName } = params;
  const safeWorkspace = escapeHtml(workspaceName);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invitation Expired</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f9fafb; margin: 0; padding: 40px 20px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <h1 style="color: #111827; font-size: 24px; font-weight: 700; margin: 0 0 8px 0;">Invitation Expired</h1>
    <p style="color: #6b7280; font-size: 16px; line-height: 1.5; margin: 0;">
      Your invitation to join <strong style="color: #111827;">${safeWorkspace}</strong> has expired.
      Please ask a workspace admin to send you a new invitation.
    </p>
  </div>
</body>
</html>`;

  return getResend().emails.send({
    from: "TeamKit <noreply@teamkit.io>",
    to,
    subject: `Your invitation to ${safeWorkspace} has expired`,
    html,
  });
}
