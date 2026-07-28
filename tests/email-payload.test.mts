import assert from "node:assert/strict";
import test from "node:test";
import { resendPayload } from "../lib/email-payload.ts";

test("Resend payload includes base64 PDF attachments", () => {
  assert.deepEqual(
    resendPayload({
      from: "TOZA AI <hello@example.com>",
      recipient: "buyer@example.com",
      subject: "Predračun",
      body: "Dokument je u prilogu.",
      attachments: [{ filename: "PR-2026-0001.pdf", content: "cGRm" }],
    }),
    {
      from: "TOZA AI <hello@example.com>",
      to: ["buyer@example.com"],
      subject: "Predračun",
      text: "Dokument je u prilogu.",
      attachments: [{ filename: "PR-2026-0001.pdf", content: "cGRm" }],
    },
  );
});

test("Resend payload omits attachments when there are none", () => {
  const payload = resendPayload({
    from: "hello@example.com",
    recipient: "buyer@example.com",
    subject: "Status",
    body: "Gotovo.",
  });
  assert.equal("attachments" in payload, false);
});
