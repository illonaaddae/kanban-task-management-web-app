import { Resend } from "resend";
import { env } from "../config/env";
import { logger } from "../config/logger";

/**
 * What happened to one outbound message.
 *
 * Delivery is never treated as a hard failure by callers: an invitation that
 * exists but whose email bounced is recoverable (copy the link), whereas a
 * 500 on the invite request leaves the admin unsure whether the person was
 * invited at all.
 */
export interface EmailResult {
  delivered: boolean;
  /** Resend's message id, when it accepted the send. */
  id?: string;
  /** Why it did not go out. Safe to show an admin; never contains the token. */
  reason?: string;
}

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!env.emailEnabled) return null;
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/** Test seam: drops the memoised client so a stubbed key takes effect. */
export function resetEmailClient(): void {
  client = null;
}

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
  /**
   * Makes a retry of the same logical send a no-op at Resend's end rather than a
   * second email — invitations get re-requested when a page is refreshed.
   */
  idempotencyKey?: string;
}

async function send({
  to,
  subject,
  html,
  text,
  idempotencyKey,
}: SendArgs): Promise<EmailResult> {
  const resend = getClient();

  // No API key configured. The link is logged instead so local development and
  // a key-less deployment both stay usable — the invite is still valid, it just
  // has to be delivered by hand.
  if (!resend) {
    logger.warn(
      { to, subject },
      "Email is not configured (RESEND_API_KEY unset) — message not sent",
    );
    return { delivered: false, reason: "Email delivery is not configured" };
  }

  try {
    // Resend reports failures in the payload rather than throwing, so an
    // unchecked call looks successful for every rejected address.
    const { data, error } = await resend.emails.send(
      { from: env.EMAIL_FROM, to: [to], subject, html, text },
      idempotencyKey ? { idempotencyKey } : undefined,
    );

    if (error) {
      logger.error({ to, err: error.message }, "Email delivery failed");
      return { delivered: false, reason: error.message };
    }

    logger.info({ to, id: data?.id }, "Email sent");
    return { delivered: true, id: data?.id };
  } catch (caught) {
    // Network-level failure, i.e. Resend unreachable rather than refusing.
    const reason = caught instanceof Error ? caught.message : "Unknown error";
    logger.error({ to, err: reason }, "Email delivery threw");
    return { delivered: false, reason };
  }
}

// ── Templates ───────────────────────────────────────────────────────────────

/** Escapes text interpolated into the HTML template. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface InvitationEmailArgs {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  acceptUrl: string;
  expiresInDays: number;
}

/**
 * Table-based layout with inline styles, which is what mail clients actually
 * support — Outlook ignores most of a stylesheet, and Gmail strips `<style>`
 * blocks on forwarded mail.
 */
function invitationHtml(args: InvitationEmailArgs): string {
  const inviter = escapeHtml(args.inviterName);
  const org = escapeHtml(args.organizationName);
  const role = escapeHtml(args.role);
  const url = escapeHtml(args.acceptUrl);

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f4f7fd;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#000112;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f7fd;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:#635fc7;padding:28px 32px;">
                <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">kanban</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.35;font-weight:700;">
                  ${inviter} invited you to join ${org}
                </h1>
                <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#4b5563;">
                  You have been added as <strong style="color:#000112;">${role}</strong>. Accept the
                  invitation to see the team's boards and get tasks assigned to you.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="border-radius:24px;background:#635fc7;">
                      <a href="${url}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
                        Accept invitation
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#828fa3;">
                  This link expires in ${args.expiresInDays} days and can be used once.
                  If you were not expecting it, you can ignore this email.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid #e4ebfa;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#828fa3;word-break:break-all;">
                  Button not working? Paste this into your browser:<br />${url}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function invitationText(args: InvitationEmailArgs): string {
  return [
    `${args.inviterName} invited you to join ${args.organizationName} on kanban.`,
    "",
    `You have been added as ${args.role}.`,
    "",
    "Accept the invitation:",
    args.acceptUrl,
    "",
    `This link expires in ${args.expiresInDays} days and can be used once.`,
    "If you were not expecting it, you can ignore this email.",
  ].join("\n");
}

export const emailService = {
  sendOrganizationInvitation(args: InvitationEmailArgs): Promise<EmailResult> {
    return send({
      to: args.to,
      subject: `${args.inviterName} invited you to join ${args.organizationName}`,
      html: invitationHtml(args),
      text: invitationText(args),
    });
  },
};

export default emailService;
