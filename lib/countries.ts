// Where the buyer is, and what that means for their paperwork.
//
// The country is not a cosmetic profile field: `invoiceScope()` reads it and
// decides which document the buyer gets — a Serbian proforma with the dinar
// account and the domestic VAT note, or the English one with IBAN/SWIFT and the
// export note. Until this was asked for, every brief and every order defaulted
// to "domestic", so a buyer in Germany was quoted on a Serbian tax document
// they could not book.
//
// Names, not ISO codes, because that is what the existing rows hold (the admin
// invoice editor has always written "Srbija" / "Hrvatska" by hand) and what the
// PDF prints. `isSerbia()` is the only comparison the code ever makes, and it
// accepts every spelling those two paths can produce.
//
// Deliberately free of `server-only`: the select in the brief is a client
// component and needs the same list the API validates against.

export type Country = {
  /** ISO 3166-1 alpha-2, used as the option value's stable identity. */
  code: string;
  sr: string;
  en: string;
};

/** Serbia first — it is the default and the overwhelming majority — then the
 *  region, then the rest alphabetically by English name. */
export const COUNTRIES: Country[] = [
  { code: "RS", sr: "Srbija", en: "Serbia" },
  { code: "BA", sr: "Bosna i Hercegovina", en: "Bosnia and Herzegovina" },
  { code: "HR", sr: "Hrvatska", en: "Croatia" },
  { code: "ME", sr: "Crna Gora", en: "Montenegro" },
  { code: "MK", sr: "Severna Makedonija", en: "North Macedonia" },
  { code: "SI", sr: "Slovenija", en: "Slovenia" },
  { code: "AL", sr: "Albanija", en: "Albania" },
  { code: "AD", sr: "Andora", en: "Andorra" },
  { code: "AR", sr: "Argentina", en: "Argentina" },
  { code: "AU", sr: "Australija", en: "Australia" },
  { code: "AT", sr: "Austrija", en: "Austria" },
  { code: "BE", sr: "Belgija", en: "Belgium" },
  { code: "BR", sr: "Brazil", en: "Brazil" },
  { code: "BG", sr: "Bugarska", en: "Bulgaria" },
  { code: "CA", sr: "Kanada", en: "Canada" },
  { code: "CL", sr: "Čile", en: "Chile" },
  { code: "CN", sr: "Kina", en: "China" },
  { code: "CY", sr: "Kipar", en: "Cyprus" },
  { code: "CZ", sr: "Češka", en: "Czechia" },
  { code: "DK", sr: "Danska", en: "Denmark" },
  { code: "EG", sr: "Egipat", en: "Egypt" },
  { code: "EE", sr: "Estonija", en: "Estonia" },
  { code: "FI", sr: "Finska", en: "Finland" },
  { code: "FR", sr: "Francuska", en: "France" },
  { code: "DE", sr: "Nemačka", en: "Germany" },
  { code: "GR", sr: "Grčka", en: "Greece" },
  { code: "HU", sr: "Mađarska", en: "Hungary" },
  { code: "IS", sr: "Island", en: "Iceland" },
  { code: "IN", sr: "Indija", en: "India" },
  { code: "IE", sr: "Irska", en: "Ireland" },
  { code: "IL", sr: "Izrael", en: "Israel" },
  { code: "IT", sr: "Italija", en: "Italy" },
  { code: "JP", sr: "Japan", en: "Japan" },
  { code: "LV", sr: "Letonija", en: "Latvia" },
  { code: "LI", sr: "Lihtenštajn", en: "Liechtenstein" },
  { code: "LT", sr: "Litvanija", en: "Lithuania" },
  { code: "LU", sr: "Luksemburg", en: "Luxembourg" },
  { code: "MT", sr: "Malta", en: "Malta" },
  { code: "MX", sr: "Meksiko", en: "Mexico" },
  { code: "MD", sr: "Moldavija", en: "Moldova" },
  { code: "MC", sr: "Monako", en: "Monaco" },
  { code: "MA", sr: "Maroko", en: "Morocco" },
  { code: "NL", sr: "Holandija", en: "Netherlands" },
  { code: "NZ", sr: "Novi Zeland", en: "New Zealand" },
  { code: "NO", sr: "Norveška", en: "Norway" },
  { code: "PL", sr: "Poljska", en: "Poland" },
  { code: "PT", sr: "Portugal", en: "Portugal" },
  { code: "QA", sr: "Katar", en: "Qatar" },
  { code: "RO", sr: "Rumunija", en: "Romania" },
  { code: "SA", sr: "Saudijska Arabija", en: "Saudi Arabia" },
  { code: "SG", sr: "Singapur", en: "Singapore" },
  { code: "SK", sr: "Slovačka", en: "Slovakia" },
  { code: "ZA", sr: "Južnoafrička Republika", en: "South Africa" },
  { code: "KR", sr: "Južna Koreja", en: "South Korea" },
  { code: "ES", sr: "Španija", en: "Spain" },
  { code: "SE", sr: "Švedska", en: "Sweden" },
  { code: "CH", sr: "Švajcarska", en: "Switzerland" },
  { code: "TR", sr: "Turska", en: "Türkiye" },
  { code: "UA", sr: "Ukrajina", en: "Ukraine" },
  { code: "AE", sr: "Ujedinjeni Arapski Emirati", en: "United Arab Emirates" },
  { code: "GB", sr: "Velika Britanija", en: "United Kingdom" },
  { code: "US", sr: "Sjedinjene Američke Države", en: "United States" },
];

export const SERBIA = COUNTRIES[0];

/** The label shown, and stored, for a given language. */
export function countryLabel(country: Country, locale: string): string {
  return locale === "en" ? country.en : country.sr;
}

/** The default selection: Serbia, named in the language being used. */
export function defaultCountry(locale: string): string {
  return countryLabel(SERBIA, locale);
}

/** Options for a <select>, in the language being used. */
export function countryOptions(locale: string): { value: string; label: string }[] {
  return COUNTRIES.map((country) => ({
    value: countryLabel(country, locale),
    label: countryLabel(country, locale),
  }));
}

function normalize(value: string): string {
  // Diacritics are stripped so "Č"/"C" and the like cannot make two spellings
  // of the same country compare as different ones.
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

/**
 * Is this the home country?
 *
 * Every spelling the system can produce has to be recognised, because getting
 * it wrong issues the buyer the wrong tax document: the brief writes the
 * localized name ("Srbija" or "Serbia"), the admin invoice editor has always
 * written it by hand, and older rows may hold a bare code.
 */
export function isSerbia(value: string | null | undefined): boolean {
  const normalized = normalize(value ?? "");
  // Empty means "not asked" — every order placed before this field existed.
  if (!normalized) return true;
  return (
    normalized === "RS" ||
    normalized === "SRB" ||
    normalized === "SRBIJA" ||
    normalized === "SERBIA" ||
    normalized === "REPUBLIKA SRBIJA" ||
    normalized === "REPUBLIC OF SERBIA"
  );
}

/**
 * Whether a buyer in this country must supply Serbian company identifiers.
 *
 * A PIB is 9 digits and a matični broj is 8 — both are issued by the Serbian
 * business register and a company in Vienna has neither. Demanding them was
 * what made the brief impossible to send from abroad; foreign companies give a
 * VAT / tax ID in whatever shape their own registry uses, and it prints under
 * "Tax ID" on the English document.
 */
export function requiresSerbianCompanyIds(country: string | null | undefined): boolean {
  return isSerbia(country);
}
