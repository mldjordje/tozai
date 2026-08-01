// The pricing rails, and what buying from each one actually does.
//
// `grp` is the rail a package is sold on and `flow` is what a click on its card
// opens. They were independent fields, both of them invisible in /admin/paketi:
// a package created in the panel got flow='project' from the column default and
// no slug at all, which rendered a card whose button went to "#booking". Nobody
// filling in the panel could have known that.
//
// So the rail decides the flow, and the admin panel only ever picks a rail —
// the section header they click "Novi paket" under. Adding a rail is a change
// here plus a section on the landing, and nothing else.

export type PackageFlow = "project" | "hours" | "build";

export type PackageGroup = {
  key: string;
  /** Section heading in /admin/paketi. */
  label: string;
  flow: PackageFlow;
  /** Prefilled on a new package so the studio does not have to invent one. */
  category: string;
  /** Where the card's button goes. */
  cta: string;
  /** Shown under the section heading in /admin/paketi. The flow is invisible in
   *  the editor — there is no field for it — so this is the only place the
   *  studio can find out what a package added here will actually do. */
  hint: string;
};

export const PACKAGE_GROUPS: readonly PackageGroup[] = [
  {
    key: "services",
    label: "AI Video",
    flow: "project",
    category: "AI Video",
    cta: "Pošalji upit",
    hint: "Sekcija #paketi. Dugme otvara video upit. Cena se ne prikazuje — ostavi je praznu i pošalji procenu iz „Video upiti“.",
  },
  {
    key: "education",
    label: "Edukacija",
    flow: "hours",
    category: "Edukacija",
    cta: "Kupi sate",
    hint: "Sekcija #edukacija. Dugme otvara plaćanje odmah, pa je cena obavezna. Broj sati se čita iz Jedinice (npr. „/ 5h“).",
  },
  {
    // Web, applications and automation. TOZAI does not build these — it takes
    // the brief and hands the job to the agency that does, which is why the
    // rail is quoted by hand like the video one rather than priced on the card.
    key: "razvoj",
    label: "Web & Aplikacije",
    flow: "build",
    category: "Razvoj",
    cta: "Pošalji upit",
    hint: "Sekcija #razvoj. Dugme otvara upit za razvoj (biznis, ideja, želje, rok, budžet opciono). Cena se ne prikazuje — ostavi je praznu. Sekcija se pojavljuje na sajtu tek kad ovde postoji bar jedan aktivan paket.",
  },
];

export function groupFlow(grp: string): PackageFlow {
  return PACKAGE_GROUPS.find((g) => g.key === grp)?.flow ?? "project";
}

/**
 * The checkout URL segment for a package, derived from its rail and name.
 *
 * Matches what init-db.mjs backfilled onto the rows that predate the column, so
 * a package created in the panel gets the same shape of slug as a seeded one.
 * Latin transliteration first: "Aplikacije & Sistemi" would otherwise collapse
 * to "aplikacije-sistemi" only by luck, and "Održavanje" to "odr-avanje".
 */
const DIACRITICS: Record<string, string> = {
  č: "c", ć: "c", đ: "dj", š: "s", ž: "z",
  Č: "c", Ć: "c", Đ: "dj", Š: "s", Ž: "z",
};

export function packageSlug(grp: string, name: string): string {
  return `${grp}-${name}`
    .replace(/[čćđšžČĆĐŠŽ]/g, (char) => DIACRITICS[char] ?? char)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
