// Seed the FAQ table. Idempotent — matched and upserted by the Serbian
// question text, so re-running after an edit to the list below just updates
// the existing rows instead of duplicating them.
//
//   node scripts/seed-faq-2026-08.mjs        (reads DATABASE_URL from .env.local)
//
// COPY RULE — same one lib/content/offerings.ts and the 31 Jul 2026 rewrite
// follow (see scripts/meta-safe-copy-2026-07-31.mjs): no promised business
// outcome, no aggregate number that cannot be verified from the page, no other
// company's brand named. FAQ copy is an easy place for that to creep back in —
// "koliko traje" and "koliko košta" invite a hedge that reads as a guarantee.
// Answers here say what happens and what is included, never what it will earn
// the buyer.

import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL missing in .env.local");
  process.exit(1);
}
const sql = neon(url);

const FAQ = [
  {
    question: "Da li je video stvarno napravljen pomoću AI-ja?",
    answer:
      "Da. Svaki klip je AI generisan ili AI potpomognut, i to je jasno naznačeno pri isporuci. Ne prikazujemo AI sadržaj kao snimljen na terenu.",
    question_en: "Is the video actually made with AI?",
    answer_en:
      "Yes. Every clip is AI-generated or AI-assisted, and that is stated clearly on delivery. We do not present AI content as footage shot on location.",
  },
  {
    question: "Kako izgleda proces od upita do gotovog videa?",
    answer:
      "Pošalješ upit sa idejom, biznisom i budžetom. Pregledamo ga i vraćamo privatnu procenu cene i roka. Kad prihvatiš procenu, radimo klipove i šaljemo ih na reviziju pre finalne isporuke.",
    question_en: "What happens between the brief and the finished video?",
    answer_en:
      "You send a brief with the idea, the business and a budget. We review it and send back a private quote with a price and a timeline. Once you accept the quote, we produce the clips and send them for review before final delivery.",
  },
  {
    question: "Koliko traje izrada?",
    answer:
      "Zavisi od paketa, broja klipova i složenosti. Tačan rok dobijaš napisan u proceni pre nego što bilo šta platiš — nema fiksnog roka koji važi za sve upite.",
    question_en: "How long does production take?",
    answer_en:
      "It depends on the package, the number of clips and the complexity. You get the exact timeline in writing with the quote, before paying anything — there is no fixed turnaround that applies to every brief.",
  },
  {
    question: "Koliko košta AI video?",
    answer:
      "Cena zavisi od obima — broja klipova, dužine i složenosti — pa je ne objavljujemo unapred. Pošalješ upit, dobiješ pisanu procenu i tek tada odlučuješ da li prihvataš.",
    question_en: "How much does an AI video cost?",
    answer_en:
      "Price depends on scope — clip count, length and complexity — so it is not published upfront. You send a brief, get a written quote, and only then decide whether to accept it.",
  },
  {
    question: "Koliko revizija je uključeno?",
    answer:
      "Broj revizija je naveden u svakoj proceni pre nego što je prihvatiš, i vidljiv je na tvom nalogu tokom cele izrade.",
    question_en: "How many revisions are included?",
    answer_en:
      "The number of revisions is stated in every quote before you accept it, and stays visible in your account for the whole job.",
  },
  {
    question: "Ko poseduje prava na gotov video?",
    answer:
      "Nakon isporuke i plaćanja, video je tvoj za korišćenje u sopstvenim kampanjama i na sopstvenim kanalima.",
    question_en: "Who owns the finished video?",
    answer_en:
      "After delivery and payment, the video is yours to use in your own campaigns and on your own channels.",
  },
  {
    question: "Šta je AI edukacija i za koga je?",
    answer:
      "Individualno mentorstvo uživo, prodaje se u paketima od 1 do 20 sati. Radimo na konkretnim pitanjima koje doneseš — alat, proces ili ideju — a ne po fiksnom nastavnom planu.",
    question_en: "What is the AI education and who is it for?",
    answer_en:
      "One-on-one live mentorship, sold in packs from 1 to 20 hours. We work through the specific tool, process or idea you bring, not a fixed curriculum.",
  },
  {
    question: "Radite li i sajtove, aplikacije i automatizaciju?",
    answer:
      "Da, kroz upit. Opišeš šta ti treba, a izradu vodi partnerski razvojni tim. Cena i rok stižu na tvoj nalog nakon što pregledamo brief, isto kao kod AI videa.",
    question_en: "Do you also build websites, apps and automation?",
    answer_en:
      "Yes, by brief. You describe what you need, and the build is delivered by a partner development team. Price and timeline land in your account after we review the brief, the same as with AI video.",
  },
  {
    question: "Kako se plaća i da li dobijam račun?",
    answer:
      "Plaćanje karticom ili na račun. Za uplatu na račun dobijaš predračun odmah, a fakturu čim uplata legne — oba dokumenta stoje na tvom nalogu.",
    question_en: "How do I pay, and do I get an invoice?",
    answer_en:
      "By card or bank transfer. A bank transfer gets a proforma invoice right away, and the final invoice once payment lands — both documents stay in your account.",
  },
  {
    question: "Radite li sa firmama van Srbije?",
    answer:
      "Da. Predračun i faktura se izdaju na engleskom sa IBAN/SWIFT podacima za sve kupce van Srbije.",
    question_en: "Do you work with companies outside Serbia?",
    answer_en:
      "Yes. The proforma and the final invoice are issued in English with IBAN/SWIFT details for every buyer outside Serbia.",
  },
  {
    question: "Šta ako mi se ponuda ne dopadne?",
    answer:
      "Procena ne obavezuje ni na šta. Pregledaš cenu i rok na svom nalogu i odlučuješ da li prihvataš — ništa se ne naplaćuje dok to sam ne potvrdiš.",
    question_en: "What if I do not like the quote?",
    answer_en:
      "A quote carries no obligation. You review the price and timeline in your account and decide whether to accept — nothing is charged until you confirm it yourself.",
  },
];

for (const [index, item] of FAQ.entries()) {
  const [row] = await sql`
    INSERT INTO faq (question, answer, question_en, answer_en, sort, active)
    VALUES (${item.question}, ${item.answer}, ${item.question_en}, ${item.answer_en}, ${index}, true)
    ON CONFLICT (question) DO UPDATE SET
      answer = EXCLUDED.answer,
      question_en = EXCLUDED.question_en,
      answer_en = EXCLUDED.answer_en,
      sort = EXCLUDED.sort,
      active = true
    RETURNING id
  `;
  console.log(`#${row.id} ${item.question}`);
}

console.log(`\ndone — ${FAQ.length} FAQ items active.`);
