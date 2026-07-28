export type EmailAttachment = {
  filename: string;
  /** Base64-encoded attachment content, as required by Resend's HTTP API. */
  content: string;
};

export function resendPayload(input: {
  from: string;
  recipient: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}) {
  return {
    from: input.from,
    to: [input.recipient],
    subject: input.subject,
    text: input.body,
    ...(input.attachments?.length ? { attachments: input.attachments } : {}),
  };
}
