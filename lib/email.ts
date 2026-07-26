import "server-only";
import { getSql } from "@/lib/db";

type EmailInput = {
  userId: number;
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
