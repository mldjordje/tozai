import { type Locale } from "./config";

// Interface strings — the words that are part of the product rather than part
// of the copy.
//
// The division of labour: anything the studio should be able to rewrite without
// a deploy lives in the database (site_content, packages, faq, result_shots,
// portfolio_works) and has its own `_en` column. Everything here is structural —
// button labels, column headings, validation messages, units — and changing it
// is a code change in either language.
//
// Kept as one typed object per locale rather than flat keys so a missing string
// is a build error instead of a "footer.rights" leaking onto the page.

export type UiStrings = {
  hero: {
    /** The scroll cue at the foot of the first screen. */
    scroll: string;
  };
  nav: {
    links: { href: string; label: string }[];
    account: string;
    cta: string;
    menu: string;
    close: string;
    language: string;
    home: string;
  };
  footer: {
    offer: string;
    offerLinks: { href: string; label: string }[];
    account: string;
    accountLinks: { href: string; label: string }[];
    contact: string;
    writeUs: string;
    rights: string;
    /** Privacy policy and terms — also the two URLs Google's OAuth review reads. */
    legalLinks: { href: string; label: string }[];
  };
  /** The Google Business profile link — see components/ui/GoogleReviews.tsx. */
  reviews: {
    /** Opens the review composer. */
    write: string;
    /** Opens the reviews already left. */
    read: string;
  };
  packages: {
    popular: string;
    privateQuote: string;
  };
  education: {
    hour: string;
    /** Serbian needs three forms: 1 sat, 2–4 sata, 5+ sati. English collapses
     *  `hoursFew` onto the plural, which is why the packs can carry any hour
     *  count without the card reading as broken grammar. */
    hoursFew: string;
    hours: string;
    buy: string;
    reserve: string;
  };
  portfolio: {
    title: string;
    lead: string;
    eyebrow: string;
    all: string;
    empty: string;
    back: string;
  };
  /** The proof rail on the landing and the full-size view behind each card. */
  results: {
    open: (handle: string) => string;
    swipe: string;
    prev: string;
    next: string;
    close: string;
    position: (index: number, total: number) => string;
  };
  inquiry: {
    backToPackages: string;
    title: string;
    titleAccent: string;
    signInEyebrow: string;
    signInTitle: string;
    signInBody: string;
    signInCta: string;
    signInNote: string;
    formEyebrow: string;
    formTitle: string;
    formTitleAccent: string;
    formBody: string;
    services: string;
    servicesHint: string;
    servicesChosen: (count: number, max: number) => string;
    servicesRequired: string;
    servicesFull: (max: number) => string;
    buyerType: string;
    individual: string;
    company: string;
    fullName: string;
    contactPerson: string;
    phone: string;
    billingTitle: string;
    billingBody: string;
    legalName: string;
    legalNamePlaceholder: string;
    pib: string;
    pibHint: string;
    mb: string;
    mbHint: string;
    address: string;
    addressPlaceholder: string;
    city: string;
    cityPlaceholder: string;
    country: string;
    countryForeignHint: string;
    taxId: string;
    taxIdPlaceholder: string;
    taxIdHint: string;
    business: string;
    businessPlaceholder: string;
    aboutBusiness: string;
    aboutBusinessPlaceholder: string;
    aboutBusinessHint: string;
    idea: string;
    ideaPlaceholder: string;
    ideaHint: string;
    clips: string;
    clipsHint: string;
    budget: string;
    budgetHint: string;
    nextTitle: string;
    nextBody: string;
    submit: string;
    submitting: string;
    submitNote: string;
    minChars: (min: number) => string;
    sentEyebrow: (id: number) => string;
    sentTitle: string;
    sentTitleAccent: string;
    sentBody: string;
    sentSteps: string[];
    sentCta: string;
    summaryOne: string;
    summaryMany: string;
    summaryEmpty: string;
    changeService: string;
    pickService: string;
    quoteTitle: string;
    quoteBody: string;
    errors: {
      name: string;
      companyName: string;
      pib: string;
      mb: string;
      address: string;
      city: string;
      country: string;
      businessName: string;
      businessDescription: (min: number) => string;
      idea: (min: number) => string;
      clipCount: string;
      budget: string;
      network: string;
      generic: string;
    };
  };
};

const sr: UiStrings = {
  hero: {
    scroll: "Skroluj",
  },
  nav: {
    links: [
      { href: "/#portfolio", label: "Rezultati" },
      { href: "/portfolio", label: "Radovi" },
      { href: "/#paketi", label: "Paketi" },
      { href: "/#edukacija", label: "Edukacija" },
      { href: "/#faq", label: "Pitanja" },
      { href: "/#booking", label: "Kontakt" },
    ],
    account: "Nalog",
    cta: "Pošalji upit",
    menu: "Otvori meni",
    close: "Zatvori meni",
    language: "Jezik",
    home: "TOZA AI — početna",
  },
  footer: {
    offer: "Ponuda",
    offerLinks: [
      { href: "/#paketi", label: "AI video paketi" },
      { href: "/#edukacija", label: "Privatna edukacija" },
      { href: "/#portfolio", label: "Rezultati" },
    ],
    account: "Nalog",
    accountLinks: [
      { href: "/nalog", label: "Moj nalog" },
      { href: "/nalog/zahtevi", label: "Moji upiti" },
      { href: "/nalog/porudzbine", label: "Porudžbine" },
      { href: "/prijava", label: "Prijava" },
    ],
    contact: "Kontakt",
    writeUs: "Piši nam kroz upit →",
    rights: "Sva prava zadržana.",
    legalLinks: [
      { href: "/privatnost", label: "Politika privatnosti" },
      { href: "/uslovi", label: "Uslovi korišćenja" },
    ],
  },
  reviews: {
    write: "Oceni nas na Google-u",
    read: "Recenzije na Google-u",
  },
  packages: {
    popular: "Najpopularnije",
    privateQuote: "Privatna procena",
  },
  education: {
    hour: "sat",
    hoursFew: "sata",
    hours: "sati",
    buy: "Kupi sate",
    reserve: "Rezerviši",
  },
  portfolio: {
    title: "Radovi koje smo pustili u svet.",
    lead: "Svaki kadar je AI. Klijenti, kampanje i profili koje vodimo — na jednom mestu.",
    eyebrow: "Portfolio",
    all: "Sve",
    empty: "Radovi se uskoro pojavljuju ovde.",
    back: "Nazad",
  },
  results: {
    open: (handle) => `Otvori rezultat: ${handle}`,
    swipe: "Prevuci levo za još rezultata",
    prev: "Prethodni rezultat",
    next: "Sledeći rezultat",
    close: "Zatvori",
    position: (index, total) => `Rezultat ${index} od ${total}`,
  },
  inquiry: {
    backToPackages: "Nazad na pakete",
    title: "Pošalji",
    titleAccent: "upit",
    signInEyebrow: "Prijava",
    signInTitle: "Prijavi se da pošalješ upit.",
    signInBody:
      "Traje deset sekundi. Usluge biraš u sledećem koraku — jednu ili više njih u istom upitu — a procena, plaćanje i porudžbina vezuju se za tvoj nalog, tako da uvek vidiš šta je sledeće, bez traženja po mejlu.",
    signInCta: "Nastavi sa Google nalogom",
    signInNote: "Upit je besplatan i ne obavezuje te. Cenu vidiš pre bilo kakvog plaćanja.",
    formEyebrow: "Upit",
    formTitle: "Reci nam šta",
    formTitleAccent: "pravimo",
    formBody:
      "Upit je besplatan i ne obavezuje te. Materijale ne tražimo dok ne prihvatiš procenu.",
    services: "Usluge",
    servicesHint: "Izaberi jednu ili više — sve idu u isti upit i dobijaš jednu procenu.",
    servicesChosen: (count, max) => ` Izabrano: ${count}/${max}.`,
    servicesRequired: "Izaberi bar jednu uslugu.",
    servicesFull: (max) =>
      `Više od ${max} usluga u jednom upitu ne primamo — pošalji zaseban upit.`,
    buyerType: "Tip kupca",
    individual: "Fizičko lice",
    company: "Pravno lice",
    fullName: "Ime i prezime",
    contactPerson: "Kontakt osoba",
    phone: "Telefon",
    billingTitle: "Podaci za fakturu",
    billingBody:
      "Čuvamo ih uz ovaj upit, da faktura bude spremna kada prihvatiš procenu. Pečat nije potrebno slati.",
    legalName: "Pun naziv pravnog lica / preduzetnika",
    legalNamePlaceholder: "Naziv iz registra",
    pib: "PIB",
    pibHint: "Tačno 9 cifara",
    mb: "Matični broj",
    mbHint: "Tačno 8 cifara",
    address: "Adresa sedišta",
    addressPlaceholder: "Ulica i broj",
    city: "Grad",
    cityPlaceholder: "Mesto",
    country: "Zemlja",
    countryForeignHint:
      "Za kupce van Srbije predračun i faktura idu na engleskom, sa deviznim računom (IBAN/SWIFT).",
    taxId: "PIB / VAT broj",
    taxIdPlaceholder: "npr. DE123456789",
    taxIdHint: "Opciono — ide na fakturu ako ga upišeš.",
    business: "Biznis / brend",
    businessPlaceholder: "Naziv biznisa ili brenda",
    aboutBusiness: "Kratko o biznisu",
    aboutBusinessPlaceholder: "Čime se bavite, šta prodajete i kome prodajete?",
    aboutBusinessHint: "Par rečenica je dovoljno.",
    idea: "Ideja za klipove",
    ideaPlaceholder: "Opiši poruku, proizvod, stil ili rezultat koji želiš…",
    ideaHint: "Što konkretnije, to je procena tačnija.",
    clips: "Broj klipova",
    clipsHint: "1 — 100",
    budget: "Budžet u evrima",
    budgetHint: "Okvirno — procenu radimo po ideji.",
    nextTitle: "Šta sledi",
    nextBody:
      "Procena sadrži tačnu cenu i vreme izrade. Kad je prihvatiš, otvara se plaćanje, a materijale šalješ iz svog naloga — WeTransfer linkom ili preko WhatsApp kontakta.",
    submit: "Pošalji upit",
    submitting: "Šaljem…",
    submitNote: "Bez obaveze — cenu vidiš pre plaćanja.",
    minChars: (min) => `Minimum ${min} karaktera.`,
    sentEyebrow: (id) => `Upit #${id}`,
    sentTitle: "Upit je",
    sentTitleAccent: "stigao",
    sentBody:
      "Pregledaćemo ideju, broj klipova i budžet. Kada procena bude spremna, stiže ti email — cena i vreme izrade pojaviće se na tvom nalogu. Tek tada odlučuješ da li prihvataš.",
    sentSteps: [
      "Pregledamo upit i pripremamo procenu.",
      "Cena i rok stižu na tvoj nalog.",
      "Prihvataš, plaćaš i šalješ materijale.",
    ],
    sentCta: "Prati upit",
    summaryOne: "AI video usluga",
    summaryMany: "AI video usluge",
    summaryEmpty:
      "Još nijedna usluga nije izabrana. Izaberi bar jednu da bismo znali šta procenjujemo.",
    changeService: "Promeni ili dodaj uslugu",
    pickService: "Izaberi uslugu",
    quoteTitle: "Privatna procena",
    quoteBody:
      "Cena nije javna — svaki posao se procenjuje po ideji, broju klipova i roku.",
    errors: {
      name: "Upiši ime i prezime kontakt osobe.",
      companyName: "Upiši pun naziv pravnog lica ili preduzetnika.",
      pib: "PIB mora imati tačno 9 cifara.",
      mb: "Matični broj mora imati tačno 8 cifara.",
      address: "Upiši adresu sedišta.",
      city: "Upiši grad.",
      country: "Izaberi zemlju.",
      businessName: "Upiši naziv biznisa ili brenda.",
      businessDescription: (min) => `Još malo — treba nam najmanje ${min} karaktera.`,
      idea: (min) =>
        `Opiši ideju sa najmanje ${min} karaktera da bismo mogli da procenimo posao.`,
      clipCount: "Broj klipova mora biti između 1 i 100.",
      budget: "Upiši okvirni budžet u evrima.",
      network: "Veza je prekinuta. Proveri internet i pokušaj ponovo.",
      generic: "Upit nije poslat. Pokušaj ponovo.",
    },
  },
};

const en: UiStrings = {
  hero: {
    scroll: "Scroll",
  },
  nav: {
    links: [
      { href: "/#portfolio", label: "Results" },
      { href: "/portfolio", label: "Work" },
      { href: "/#paketi", label: "Packages" },
      { href: "/#edukacija", label: "Education" },
      { href: "/#faq", label: "FAQ" },
      { href: "/#booking", label: "Contact" },
    ],
    account: "Account",
    cta: "Send a brief",
    menu: "Open menu",
    close: "Close menu",
    language: "Language",
    home: "TOZA AI — home",
  },
  footer: {
    offer: "Services",
    offerLinks: [
      { href: "/#paketi", label: "AI video packages" },
      { href: "/#edukacija", label: "Private education" },
      { href: "/#portfolio", label: "Results" },
    ],
    account: "Account",
    accountLinks: [
      { href: "/nalog", label: "My account" },
      { href: "/nalog/zahtevi", label: "My briefs" },
      { href: "/nalog/porudzbine", label: "Orders" },
      { href: "/prijava", label: "Sign in" },
    ],
    contact: "Contact",
    writeUs: "Write to us →",
    rights: "All rights reserved.",
    legalLinks: [
      { href: "/privatnost", label: "Privacy Policy" },
      { href: "/uslovi", label: "Terms of Service" },
    ],
  },
  reviews: {
    write: "Review us on Google",
    read: "Reviews on Google",
  },
  packages: {
    popular: "Most popular",
    privateQuote: "Private quote",
  },
  education: {
    hour: "hour",
    hoursFew: "hours",
    hours: "hours",
    buy: "Buy hours",
    reserve: "Book",
  },
  portfolio: {
    title: "Work we put into the world.",
    lead: "Every frame is AI. Clients, campaigns and the profiles we run — in one place.",
    eyebrow: "Portfolio",
    all: "All",
    empty: "Work is coming here shortly.",
    back: "Back",
  },
  results: {
    open: (handle) => `Open result: ${handle}`,
    swipe: "Swipe for more results",
    prev: "Previous result",
    next: "Next result",
    close: "Close",
    position: (index, total) => `Result ${index} of ${total}`,
  },
  inquiry: {
    backToPackages: "Back to packages",
    title: "Send a",
    titleAccent: "brief",
    signInEyebrow: "Sign in",
    signInTitle: "Sign in to send your brief.",
    signInBody:
      "Ten seconds. You pick the services in the next step — one or several in the same brief — and the quote, the payment and the order all attach to your account, so you always see what comes next without digging through email.",
    signInCta: "Continue with Google",
    signInNote: "The brief is free and commits you to nothing. You see the price before you pay anything.",
    formEyebrow: "Brief",
    formTitle: "Tell us what we're",
    formTitleAccent: "making",
    formBody:
      "The brief is free and commits you to nothing. We don't ask for your material until you accept the quote.",
    services: "Services",
    servicesHint: "Pick one or several — they go into the same brief and you get one quote.",
    servicesChosen: (count, max) => ` Selected: ${count}/${max}.`,
    servicesRequired: "Pick at least one service.",
    servicesFull: (max) => `More than ${max} services in one brief is too many — send a separate one.`,
    buyerType: "Buyer type",
    individual: "Individual",
    company: "Company",
    fullName: "Full name",
    contactPerson: "Contact person",
    phone: "Phone",
    billingTitle: "Invoicing details",
    billingBody:
      "We keep them with this brief so the invoice is ready the moment you accept the quote.",
    legalName: "Registered company name",
    legalNamePlaceholder: "Name as registered",
    pib: "VAT number (PIB)",
    pibHint: "Exactly 9 digits",
    mb: "Company number (MB)",
    mbHint: "Exactly 8 digits",
    address: "Registered address",
    addressPlaceholder: "Street and number",
    city: "City",
    cityPlaceholder: "City",
    country: "Country",
    countryForeignHint:
      "Outside Serbia the proforma and the invoice are issued in English, against the foreign-currency account (IBAN/SWIFT).",
    taxId: "VAT / Tax ID",
    taxIdPlaceholder: "e.g. DE123456789",
    taxIdHint: "Optional — it goes on the invoice if you enter it.",
    business: "Business / brand",
    businessPlaceholder: "Business or brand name",
    aboutBusiness: "About the business",
    aboutBusinessPlaceholder: "What do you do, what do you sell, and who do you sell it to?",
    aboutBusinessHint: "A couple of sentences is enough.",
    idea: "Idea for the clips",
    ideaPlaceholder: "Describe the message, the product, the style or the result you want…",
    ideaHint: "The more concrete it is, the more accurate the quote.",
    clips: "Number of clips",
    clipsHint: "1 — 100",
    budget: "Budget in euros",
    budgetHint: "Ballpark — we quote from the idea.",
    nextTitle: "What happens next",
    nextBody:
      "The quote carries an exact price and turnaround. Once you accept it, payment opens and you send your material from your account — a WeTransfer link or over WhatsApp.",
    submit: "Send the brief",
    submitting: "Sending…",
    submitNote: "No commitment — you see the price before paying.",
    minChars: (min) => `Minimum ${min} characters.`,
    sentEyebrow: (id) => `Brief #${id}`,
    sentTitle: "Your brief",
    sentTitleAccent: "arrived",
    sentBody:
      "We'll go through the idea, the clip count and the budget. When the quote is ready you get an email — the price and the turnaround appear in your account. Only then do you decide whether to accept.",
    sentSteps: [
      "We read the brief and prepare a quote.",
      "The price and the deadline land in your account.",
      "You accept, pay, and send your material.",
    ],
    sentCta: "Track the brief",
    summaryOne: "AI video service",
    summaryMany: "AI video services",
    summaryEmpty:
      "No service picked yet. Choose at least one so we know what we're quoting.",
    changeService: "Change or add a service",
    pickService: "Pick a service",
    quoteTitle: "Private quote",
    quoteBody:
      "Prices aren't public — every job is quoted from the idea, the clip count and the deadline.",
    errors: {
      name: "Enter the contact person's full name.",
      companyName: "Enter the full registered company name.",
      pib: "The VAT number must be exactly 9 digits.",
      mb: "The company number must be exactly 8 digits.",
      address: "Enter the registered address.",
      city: "Enter the city.",
      country: "Pick a country.",
      businessName: "Enter the business or brand name.",
      businessDescription: (min) => `Almost — we need at least ${min} characters.`,
      idea: (min) => `Describe the idea in at least ${min} characters so we can quote the job.`,
      clipCount: "The number of clips must be between 1 and 100.",
      budget: "Enter a ballpark budget in euros.",
      network: "The connection dropped. Check your internet and try again.",
      generic: "The brief wasn't sent. Please try again.",
    },
  },
};

const STRINGS: Record<Locale, UiStrings> = { sr, en };

export function ui(locale: Locale): UiStrings {
  return STRINGS[locale] ?? STRINGS.sr;
}
