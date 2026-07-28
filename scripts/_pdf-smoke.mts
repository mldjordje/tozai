import { mkdirSync, writeFileSync } from "node:fs";
import { renderInvoicePdf } from "../lib/invoices/pdf.ts";

const OUT = "tmp/pdfs";
mkdirSync(OUT, { recursive: true });

const seller = {
  name: "TOZA AI",
  companyName: "Svetozar Marković PR TOZA AI",
  address: "Bulevar oslobođenja 123",
  city: "Novi Sad",
  pib: "112233445",
  mb: "66778899",
  email: "info@tozai.rs",
  bankAccount: "160-0000123456789-12",
  iban: "RS35160005010012345678",
  swift: "DBDBRSBG",
  bankName: "Banca Intesa a.d. Beograd",
};

const base = {
  item: "AI Commercials — kinematska AI reklama, 30–60s, uključuje scenario, storyboard i muziku",
  amount: 890,
  currency: "EUR",
  reference: "TZ-00042",
  issuedAt: new Date("2026-07-28T10:00:00Z"),
  dueDate: new Date("2026-08-02T10:00:00Z"),
  rsd: { amount: 890 * 117.4305, rate: 117.4305, date: "2026-07-28" },
  seller,
};

const domestic = await renderInvoicePdf({
  ...base,
  kind: "proforma",
  scope: "domestic",
  number: "PR-2026-0001",
  buyer: {
    name: "Miloš Đorđević",
    companyName: "ČAROBNI ŠEŠIR DOO",
    address: "Njegoševa 5",
    city: "Beograd",
    country: "RS",
    pib: "998877665",
    mb: "12345678",
    email: "milos@example.rs",
  },
  vatNote: "Nije u sistemu PDV-a. Test dijakritika: ćčžšđ ĆČŽŠĐ.",
});

const foreign = await renderInvoicePdf({
  ...base,
  kind: "invoice",
  scope: "foreign",
  number: "TZ-2026-0007",
  buyer: {
    name: "Anna Müller",
    companyName: "Müller Digital GmbH",
    address: "Hauptstraße 42",
    city: "Berlin",
    country: "DE",
    pib: "DE123456789",
    email: "anna@example.de",
  },
  vatNote: "VAT not charged — place of supply is the customer's country.",
});

writeFileSync(`${OUT}/domestic.pdf`, domestic);
writeFileSync(`${OUT}/foreign.pdf`, foreign);
console.log("domestic bytes:", domestic.length, "| foreign bytes:", foreign.length);
