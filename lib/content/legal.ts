import type { LegalIdentity } from "@/lib/settings";
import type { Locale } from "@/lib/i18n/config";

/**
 * The privacy policy and terms of service, in both languages.
 *
 * They live here rather than in `site_content` on purpose: Google's OAuth review
 * reads these two URLs and expects them to describe what the app actually does
 * with the scopes it asks for. That description has to change when the code
 * changes, in the same commit — not from a CMS field that nobody remembers to
 * update after a deploy.
 *
 * The identity of the party responsible is read from `studio_settings`, because
 * that is where the owner already keeps it for invoices.
 *
 * NOT LEGAL ADVICE. This is an accurate description of the system written by the
 * people who built it, and it is a starting point for a lawyer or accountant to
 * review — particularly the retention periods and the consumer-rights section,
 * which follow Serbian law and are the parts most likely to need adjusting.
 */

export const LEGAL_UPDATED_AT = "2026-07-31";

export type LegalSection = {
  heading: string;
  /** Paragraphs, rendered in order. */
  body?: string[];
  /** Bullet list, rendered after the paragraphs. */
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  lead: string;
  updatedLabel: string;
  sections: LegalSection[];
};

function controller(identity: LegalIdentity, locale: Locale): string {
  const name = identity.companyName?.trim();
  if (!name) {
    return locale === "en"
      ? "The studio operating toza-ai.rs"
      : "Studio koji vodi toza-ai.rs";
  }
  const where = [identity.address, identity.city].filter(Boolean).join(", ");
  const ids = [
    identity.pib ? `PIB ${identity.pib}` : null,
    identity.mb ? (locale === "en" ? `reg. no. ${identity.mb}` : `MB ${identity.mb}`) : null,
  ]
    .filter(Boolean)
    .join(", ");
  return [name, where, ids].filter(Boolean).join(", ");
}

function contactLine(identity: LegalIdentity, locale: Locale): string {
  const parts = [identity.email, identity.phone].filter(Boolean).join(" · ");
  if (!parts) {
    return locale === "en"
      ? "Contact us through the inquiry form on the site."
      : "Kontaktiraj nas kroz formu za upit na sajtu.";
  }
  return parts;
}

export function privacyPolicy(identity: LegalIdentity, locale: Locale): LegalDocument {
  const who = controller(identity, locale);
  const contact = contactLine(identity, locale);

  if (locale === "en") {
    return {
      title: "Privacy Policy",
      lead: `This policy explains what ${who} collects when you use toza-ai.rs, why, and what you can ask us to do about it.`,
      updatedLabel: "Last updated",
      sections: [
        {
          heading: "Who is responsible",
          body: [
            `The data controller is ${who}.`,
            `You can reach us at: ${contact}`,
          ],
        },
        {
          heading: "What we collect",
          bullets: [
            "Account data from Google Sign-In: your name, email address, profile picture and Google account identifier. We never see or receive your Google password.",
            "Billing data you type in yourself: name or company name, address, city, country, tax number (PIB) and registration number, phone. We need these to issue a legally valid invoice.",
            "Order and invoice records: what you bought, when, how much, and whether it was paid.",
            "Inquiries: the description of your business, your idea, budget range and number of clips you send through the brief form.",
            "Education bookings: the sessions you reserve, their times, the meeting link and any recording link we attach afterwards.",
            "Files you upload as project material.",
            "Aggregate traffic statistics through Vercel Web Analytics. These are counts of page views — they do not identify you and do not use advertising cookies.",
          ],
        },
        {
          heading: "Why we collect it",
          bullets: [
            "To perform the contract: deliver the videos or the training hours you paid for, and let you see your orders and invoices in your account.",
            "To meet legal accounting obligations: an issued invoice must be kept for as long as tax law requires, regardless of any later deletion request.",
            "To communicate about your order: confirmations, payment reminders and session details.",
            "To keep the service working and secure: session cookies, and aggregate statistics that tell us which pages people actually use.",
          ],
        },
        {
          heading: "Google account data and Google Calendar",
          body: [
            "Signing in uses only your name, email address and profile picture. We request no other access to your Google account, and nothing is read from your Gmail, Drive or your own calendar.",
            "Separately, the studio owner may connect the studio's own Google Calendar to the admin panel. That connection uses the calendar.events permission and applies to the studio's calendar, not to yours. It is used for one thing: creating, updating and cancelling the calendar event for a booked session, and generating its Google Meet link. When a session is booked you receive a calendar invitation and the meeting link by email.",
            "We do not use Google user data for advertising, we do not sell it, and we do not transfer it to third parties except the service providers listed below. Our use of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements.",
          ],
        },
        {
          heading: "Who else processes your data",
          body: [
            "We use a small number of providers, each only for the purpose named:",
          ],
          bullets: [
            "Vercel — hosting, and aggregate traffic analytics.",
            "Neon — the database where accounts, orders and invoices are stored.",
            "Vercel Blob — storage for uploaded project files.",
            "Google — sign-in, and calendar events and Meet links for booked sessions.",
            "The bank named on your invoice, for payments made by bank transfer.",
          ],
        },
        {
          heading: "Cookies",
          body: [
            "We use only what the site needs to function. There are no advertising or profiling cookies.",
          ],
          bullets: [
            "A sign-in cookie that keeps you logged in to your account, and a separate one for the studio's admin panel. Both expire after 30 days.",
            "A short-lived cookie that protects the sign-in round trip against request forgery.",
          ],
        },
        {
          heading: "How long we keep it",
          bullets: [
            "Invoices and the order data on them: for the period required by Serbian accounting and tax law.",
            "Account data: until you ask us to delete the account.",
            "Inquiries that never became an order: no longer than two years.",
            "Uploaded project files: for the duration of the project and a reasonable period afterwards, so the work can be re-delivered.",
          ],
        },
        {
          heading: "Your rights",
          body: [
            "You can ask us to show you the data we hold about you, correct it, delete it, or send it to you in a portable form. You can also withdraw consent and object to processing.",
            "One limit is worth stating plainly: we cannot delete an issued invoice, because tax law requires us to keep it. Everything not tied to that obligation can be deleted.",
            `Write to ${contact} and we will respond within 30 days. If you are not satisfied, you may complain to the Commissioner for Information of Public Importance and Personal Data Protection of the Republic of Serbia.`,
          ],
        },
        {
          heading: "Children",
          body: [
            "The service is not intended for children under 15, and we do not knowingly collect their data.",
          ],
        },
        {
          heading: "Changes",
          body: [
            "If this policy changes materially, we will update the date at the top and, where the change affects you directly, tell you by email.",
          ],
        },
      ],
    };
  }

  return {
    title: "Politika privatnosti",
    lead: `Ova politika objašnjava šta ${who} prikuplja kada koristiš toza-ai.rs, zašto, i šta možeš da tražiš da uradimo sa tim podacima.`,
    updatedLabel: "Poslednja izmena",
    sections: [
      {
        heading: "Ko je odgovoran",
        body: [`Rukovalac podacima je ${who}.`, `Kontakt: ${contact}`],
      },
      {
        heading: "Šta prikupljamo",
        bullets: [
          "Podatke naloga preko Google prijave: ime, imejl adresu, profilnu sliku i Google identifikator naloga. Tvoju Google lozinku nikada ne vidimo niti dobijamo.",
          "Podatke za račun koje sam unosiš: ime ili naziv firme, adresu, grad, državu, PIB i matični broj, telefon. Bez njih ne možemo da izdamo ispravan račun.",
          "Evidenciju porudžbina i faktura: šta je kupljeno, kada, po kojoj ceni i da li je plaćeno.",
          "Upite: opis posla, ideju, okvirni budžet i broj klipova koje pošalješ kroz formu.",
          "Rezervacije edukacije: termine koje zakažeš, vreme, link za sastanak i eventualni link ka snimku.",
          "Fajlove koje otpremiš kao materijal za projekat.",
          "Zbirnu statistiku poseta preko Vercel Web Analytics. To su brojači pregleda stranica — ne identifikuju te i ne koriste reklamne kolačiće.",
        ],
      },
      {
        heading: "Zašto ih prikupljamo",
        bullets: [
          "Radi izvršenja ugovora: da isporučimo video ili sate obuke koje si platio i da u nalogu vidiš svoje porudžbine i fakture.",
          "Radi zakonskih računovodstvenih obaveza: izdata faktura mora da se čuva koliko poreski propisi nalažu, bez obzira na kasniji zahtev za brisanje.",
          "Radi komunikacije o porudžbini: potvrde, podsetnici za uplatu i detalji termina.",
          "Radi rada i bezbednosti servisa: kolačići sesije i zbirna statistika koja nam pokazuje koje stranice se zaista koriste.",
        ],
      },
      {
        heading: "Google podaci i Google kalendar",
        body: [
          "Prijava koristi samo tvoje ime, imejl adresu i profilnu sliku. Ne tražimo nikakav drugi pristup tvom Google nalogu i ništa ne čitamo iz tvog Gmail-a, Drive-a ni tvog kalendara.",
          "Odvojeno od toga, vlasnik studija može da poveže studijski Google kalendar sa admin panelom. Ta veza koristi dozvolu calendar.events i odnosi se na kalendar studija, ne na tvoj. Služi za jednu stvar: da se za zakazan termin napravi, izmeni ili otkaže događaj u kalendaru i da se generiše Google Meet link. Kada zakažeš termin, dobijaš kalendarski poziv i link na imejl.",
          "Google korisničke podatke ne koristimo za oglašavanje, ne prodajemo ih i ne prosleđujemo trećim licima osim pružaocima usluga navedenim ispod. Naše korišćenje informacija dobijenih preko Google API-ja je u skladu sa Google API Services User Data Policy, uključujući i Limited Use zahteve.",
        ],
      },
      {
        heading: "Ko još obrađuje podatke",
        body: ["Koristimo mali broj pružalaca usluga, svakog samo za navedenu svrhu:"],
        bullets: [
          "Vercel — hosting i zbirna statistika poseta.",
          "Neon — baza u kojoj se čuvaju nalozi, porudžbine i fakture.",
          "Vercel Blob — skladište za otpremljene fajlove projekta.",
          "Google — prijava, kalendarski događaji i Meet linkovi za zakazane termine.",
          "Banka navedena na tvom računu, za uplate na račun.",
        ],
      },
      {
        heading: "Kolačići",
        body: [
          "Koristimo samo ono što je sajtu potrebno da radi. Nema reklamnih ni profilisanih kolačića.",
        ],
        bullets: [
          "Kolačić prijave koji te drži ulogovanog na nalog, i poseban za admin panel studija. Oba ističu posle 30 dana.",
          "Kratkotrajni kolačić koji štiti postupak prijave od zloupotrebe zahteva.",
        ],
      },
      {
        heading: "Koliko dugo čuvamo",
        bullets: [
          "Fakture i podatke o porudžbini na njima: onoliko koliko nalažu računovodstveni i poreski propisi Republike Srbije.",
          "Podatke naloga: dok ne zatražiš brisanje naloga.",
          "Upite koji nikad nisu postali porudžbina: najduže dve godine.",
          "Otpremljene fajlove projekta: za vreme trajanja projekta i razuman period posle, da bi posao mogao ponovo da se isporuči.",
        ],
      },
      {
        heading: "Tvoja prava",
        body: [
          "Možeš da tražiš uvid u podatke koje imamo o tebi, njihovu ispravku, brisanje ili prenos u prenosivom obliku. Možeš i da povučeš pristanak i uložiš prigovor na obradu.",
          "Jedno ograničenje vredi reći otvoreno: izdatu fakturu ne možemo obrisati jer smo zakonom obavezni da je čuvamo. Sve što nije vezano za tu obavezu može da se obriše.",
          `Piši na ${contact} i odgovorićemo u roku od 30 dana. Ako nisi zadovoljan odgovorom, možeš se obratiti Povereniku za informacije od javnog značaja i zaštitu podataka o ličnosti Republike Srbije.`,
        ],
      },
      {
        heading: "Deca",
        body: [
          "Usluga nije namenjena deci mlađoj od 15 godina i svesno ne prikupljamo njihove podatke.",
        ],
      },
      {
        heading: "Izmene",
        body: [
          "Ako se politika bitno promeni, izmenićemo datum na vrhu, a kada promena direktno utiče na tebe, javićemo ti imejlom.",
        ],
      },
    ],
  };
}

export function termsOfService(identity: LegalIdentity, locale: Locale): LegalDocument {
  const who = controller(identity, locale);
  const contact = contactLine(identity, locale);

  if (locale === "en") {
    return {
      title: "Terms of Service",
      lead: `These terms govern the services ${who} sells through toza-ai.rs. By placing an order you accept them.`,
      updatedLabel: "Last updated",
      sections: [
        {
          heading: "What we sell",
          bullets: [
            "AI-generated video production, sold per package or quoted per brief.",
            "Private one-on-one AI training, sold in hour packs and booked as sessions.",
          ],
        },
        {
          heading: "Orders and prices",
          body: [
            "Prices are shown on the site in the currency of the order. Some services are quoted privately after you send a brief, because the scope decides the price.",
            "An order becomes binding when it is paid, or when a proforma invoice issued for it is settled.",
          ],
        },
        {
          heading: "Payment",
          body: [
            "Payment is by bank transfer against a proforma invoice, unless another method is offered at checkout. Purchased training hours are credited, and project work begins, once the payment is actually visible on the bank statement — not on the basis of a payment screenshot.",
            "A final invoice is issued after payment is confirmed.",
          ],
        },
        {
          heading: "Booking, rescheduling and cancellation of sessions",
          bullets: [
            "Booking a session deducts the hours from your balance and reserves that time.",
            "You may cancel a session yourself no later than 24 hours before it starts; the hours return to your balance.",
            "Later than that, cancellation goes through us.",
            "If you do not attend without cancelling, the hours are treated as used.",
          ],
        },
        {
          heading: "Delivery and revisions",
          body: [
            "Delivery deadlines and the number of revisions are agreed per package or per quote and are stated in the offer for your order. Delays caused by material or feedback we are waiting on from you extend the deadline accordingly.",
          ],
        },
        {
          heading: "Rights to the work",
          body: [
            "Once the order is paid in full, you may use the delivered videos for your own commercial purposes.",
            "We may show the delivered work in our portfolio and on our own channels, unless you ask us in writing not to.",
            "You are responsible for the material you supply — brand assets, footage, names, likenesses — and for having the right to use it.",
          ],
        },
        {
          heading: "What AI generation means here",
          body: [
            "The videos are produced with AI tools. AI output is not perfectly reproducible: the same prompt does not return an identical result twice, and some ideas cannot be realised exactly as imagined. We agree the direction in advance and revise within the agreed number of rounds.",
          ],
        },
        {
          heading: "Right of withdrawal",
          body: [
            "For services fully performed at the consumer's explicit prior request, the right of withdrawal is lost once performance has begun, in line with the Serbian Consumer Protection Act. In practice: an unused hour pack can be refunded, a session already held cannot, and a video already produced cannot.",
          ],
        },
        {
          heading: "Accounts",
          body: [
            "You sign in with a Google account. You are responsible for keeping access to that account secure. We may suspend an account that is used to abuse the service or others.",
          ],
        },
        {
          heading: "Liability",
          body: [
            "We are liable for delivering the service as agreed. We are not liable for the business results you achieve with the delivered material, nor for outages at third-party providers (Google, the payment provider, the hosting provider) beyond our control.",
          ],
        },
        {
          heading: "Applicable law and disputes",
          body: [
            "Serbian law applies. We would rather settle any dispute by agreement; failing that, the competent court in the Republic of Serbia has jurisdiction.",
            `Questions: ${contact}`,
          ],
        },
      ],
    };
  }

  return {
    title: "Uslovi korišćenja",
    lead: `Ovi uslovi uređuju usluge koje ${who} prodaje preko sajta toza-ai.rs. Slanjem porudžbine ih prihvataš.`,
    updatedLabel: "Poslednja izmena",
    sections: [
      {
        heading: "Šta prodajemo",
        bullets: [
          "Izradu AI video sadržaja, po paketu ili po ponudi na osnovu upita.",
          "Privatnu AI edukaciju jedan na jedan, u paketima sati koji se zakazuju kao termini.",
        ],
      },
      {
        heading: "Porudžbine i cene",
        body: [
          "Cene su prikazane na sajtu u valuti porudžbine. Deo usluga se ponudi privatno nakon poslatog upita, jer obim posla određuje cenu.",
          "Porudžbina postaje obavezujuća kada je plaćena, odnosno kada je izmiren predračun izdat za nju.",
        ],
      },
      {
        heading: "Plaćanje",
        body: [
          "Plaćanje ide uplatom na račun po predračunu, osim ako je na naplati ponuđen drugi način. Kupljeni sati se dodaju, a rad na projektu počinje, tek kada je uplata stvarno vidljiva na izvodu banke — ne na osnovu screenshota uplate.",
          "Konačna faktura se izdaje nakon potvrde uplate.",
        ],
      },
      {
        heading: "Zakazivanje, pomeranje i otkazivanje termina",
        bullets: [
          "Zakazivanje termina skida sate sa tvog stanja i rezerviše to vreme.",
          "Termin možeš sam otkazati najkasnije 24 sata pre početka; sati ti se tada vraćaju na stanje.",
          "Posle tog roka otkazivanje ide preko nas.",
          "Ako se ne pojaviš, a nisi otkazao, sati se smatraju iskorišćenim.",
        ],
      },
      {
        heading: "Isporuka i izmene",
        body: [
          "Rokovi isporuke i broj krugova izmena dogovaraju se po paketu ili po ponudi i navedeni su u ponudi za tvoju porudžbinu. Kašnjenje uzrokovano materijalom ili povratnom informacijom koju čekamo od tebe pomera rok srazmerno.",
        ],
      },
      {
        heading: "Prava na rad",
        body: [
          "Kada je porudžbina u celosti plaćena, isporučene video snimke možeš koristiti u svoje komercijalne svrhe.",
          "Isporučen rad možemo prikazivati u našem portfoliju i na sopstvenim kanalima, osim ako nam pismeno ne kažeš da to ne želiš.",
          "Odgovoran si za materijal koji nam daješ — brend materijale, snimke, imena, likove — i za pravo da ga koristiš.",
        ],
      },
      {
        heading: "Šta ovde znači AI generisanje",
        body: [
          "Video se izrađuje AI alatima. Rezultat AI-ja nije savršeno ponovljiv: isti opis ne vraća dvaput identičan rezultat, a neke zamisli nije moguće realizovati baš onako kako su zamišljene. Pravac dogovaramo unapred, a izmene radimo u okviru dogovorenog broja krugova.",
        ],
      },
      {
        heading: "Pravo na odustanak",
        body: [
          "Kod usluga koje su u potpunosti izvršene uz izričitu prethodnu saglasnost potrošača, pravo na odustanak prestaje započinjanjem izvršenja, u skladu sa Zakonom o zaštiti potrošača. U praksi: neiskorišćen paket sati može da se refundira, već održan termin ne može, kao ni već izrađen video.",
        ],
      },
      {
        heading: "Nalozi",
        body: [
          "Prijavljuješ se Google nalogom. Odgovoran si za bezbednost pristupa tom nalogu. Nalog koji se koristi za zloupotrebu usluge ili drugih korisnika možemo suspendovati.",
        ],
      },
      {
        heading: "Odgovornost",
        body: [
          "Odgovorni smo za isporuku usluge onako kako je dogovorena. Nismo odgovorni za poslovne rezultate koje ostvariš isporučenim materijalom, niti za prekide kod trećih pružalaca usluga (Google, provajder plaćanja, hosting) van naše kontrole.",
        ],
      },
      {
        heading: "Merodavno pravo i sporovi",
        body: [
          "Primenjuje se pravo Republike Srbije. Svaki spor bismo radije rešili dogovorom; ako to ne uspe, nadležan je stvarno nadležni sud u Republici Srbiji.",
          `Pitanja: ${contact}`,
        ],
      },
    ],
  };
}
