import { Resend } from "resend";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export async function sendInvitationEmail({
  to,
  workspaceName,
  inviterName,
  role,
  token,
}: {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  token: string;
}) {
  const acceptUrl = `${process.env.NEXTAUTH_URL}/invite/accept?token=${token}`;
  const safeWorkspace = escapeHtml(workspaceName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);
  const safeTo = escapeHtml(to);

  return getResend().emails.send({
    from: "TeamKit <noreply@teamkit.threestack.io>",
    to,
    subject: `You've been invited to ${safeWorkspace} as ${safeRole}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2>You've been invited!</h2>
        <p><strong>${safeInviter}</strong> has invited <strong>${safeTo}</strong> to join <strong>${safeWorkspace}</strong> as a <strong>${safeRole}</strong>.</p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          Accept Invitation
        </a>
        <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">This invitation expires in 48 hours. If you did not expect this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendInvitationReminderEmail({
  to,
  workspaceName,
  inviterName,
  role,
  token,
}: {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  token: string;
}) {
  const acceptUrl = `${process.env.NEXTAUTH_URL}/invite/accept?token=${token}`;
  const safeWorkspace = escapeHtml(workspaceName);
  const safeInviter = escapeHtml(inviterName);
  const safeRole = escapeHtml(role);
  const safeTo = escapeHtml(to);

  return getResend().emails.send({
    from: "TeamKit <noreply@teamkit.threestack.io>",
    to,
    subject: `Reminder: You've been invited to ${safeWorkspace}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2>Reminder: Pending Invitation</h2>
        <p>This is a reminder that <strong>${safeInviter}</strong> has invited <strong>${safeTo}</strong> to join <strong>${safeWorkspace}</strong> as a <strong>${safeRole}</strong>.</p>
        <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; margin-top: 16px;">
          Accept Invitation
        </a>
        <p style="color: #6b7280; margin-top: 24px; font-size: 14px;">This invitation expires soon. If you did not expect this, you can ignore this email.</p>
      </div>
    `,
  });
}

export async function sendInvitationExpiredEmail({
  to,
  workspaceName,
}: {
  to: string;
  workspaceName: string;
}) {
  const safeWorkspace = escapeHtml(workspaceName);

  return getResend().emails.send({
    from: "TeamKit <noreply@teamkit.threestack.io>",
    to,
    subject: `Your invitation to ${safeWorkspace} has expired`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2>Invitation Expired</h2>
        <p>Your invitation to join <strong>${safeWorkspace}</strong> has expired.</p>
        <p style="color: #6b7280; font-size: 14px;">If you'd still like to join, please ask the workspace admin to send a new invitation.</p>
      </div>
    `,
  });
}
