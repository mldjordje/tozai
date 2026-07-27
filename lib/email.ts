import "server-only";
import { getSql } from "@/lib/db";

type EmailInput = {
  /** Null for mail addressed to the studio rather than to a customer. */
  userId: number | null;
  recipient: string;
  templateKey: string;
  subject: string;
  body: string;
};

/**
 * Queue first, send second. A notification stays recoverable even when the
 * provider is not configured or is temporarily unavailable.
 */
export async function queueTransactionalEmail(input: EmailInput) {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO email_outbox (user_id, recipient, template_key, subject, body)
    VALUES (${input.userId}, ${input.recipient}, ${input.templateKey}, ${input.subject}, ${input.body})
    RETURNING id
  `) as { id: number }[];
  const outboxId = rows[0].id;

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { queued: true, sent: false, outboxId };

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.recipient],
        subject: input.subject,
        text: input.body,
      }),
    });
    const result = (await response.json()) as { id?: string; message?: string };
    if (!response.ok) throw new Error(result.message ?? `Email HTTP ${response.status}`);
    await sql`
      UPDATE email_outbox
      SET status = 'sent', sent_at = now(), provider_ref = ${result.id ?? null}
      WHERE id = ${outboxId}
    `;
    return { queued: true, sent: true, outboxId };
  } catch (error) {
    await sql`
      UPDATE email_outbox
      SET status = 'failed',
          error = ${error instanceof Error ? error.message.slice(0, 1000) : "Unknown email error"}
      WHERE id = ${outboxId}
    `;
    return { queued: true, sent: false, outboxId };
  }
}

/**
 * Same pipeline, addressed to the studio.
 *
 * A lead that only appears inside the admin panel is a lead nobody sees until
 * someone happens to log in, so both buyer-initiated events send a copy here.
 * The address comes from studio_settings (admin → Podešavanja); until it is
 * filled in this is a no-op rather than a failure, because a missing owner
 * address must never cost the buyer their order.
 */
export async function queueStudioNotice(input: {
  templateKey: string;
  subject: string;
  body: string;
}) {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT email FROM studio_settings WHERE id = 1
    `) as { email: string | null }[];
    const to = rows[0]?.email?.trim();
    if (!to) return { queued: false, sent: false };
    return await queueTransactionalEmail({ ...input, userId: null, recipient: to });
  } catch (error) {
    console.error("[email] studio notice failed", error);
    return { queued: false, sent: false };
  }
}

/**
 * Queue without letting mail take a purchase down with it. The buyer's order is
 * already committed by the time these run; an outbox insert that fails must
 * surface in the log, not as a 500 on a completed transaction.
 */
export async function queueQuietly(input: EmailInput) {
  try {
    return await queueTransactionalEmail(input);
  } catch (error) {
    console.error(`[email] ${input.templateKey} failed to queue`, error);
    return { queued: false, sent: false };
  }
}
