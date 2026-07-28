import "server-only";

// Middle exchange rate for the RSD figure printed alongside the EUR total.
//
// A Serbian invoice denominated in a foreign currency states the dinar
// equivalent at the National Bank's middle rate on the date of issue. The rate
// is fetched once, at issue time, and then STORED on the invoice row — looking
// it up again later would silently restate a document that has already been
// sent.
//
// Source: kurs.resenje.org, which republishes the NBS list as JSON (the bank's
// own service is a SOAP endpoint behind registration). If the studio's
// accountant wants the rate taken from the bank directly, this is the one
// function to swap.

export type MiddleRate = { rate: number; date: string };

const ENDPOINT = "https://kurs.resenje.org/api/v1/currencies";

/**
 * Returns null on any failure — a missing rate must never block issuing a
 * document. The invoice then prints the foreign-currency total only, which is
 * still a valid invoice, instead of failing the buyer's checkout.
 */
export async function getMiddleRate(currency: string): Promise<MiddleRate | null> {
  const code = currency.trim().toLowerCase();
  if (!code || code === "rsd") return null;

  try {
    const response = await fetch(`${ENDPOINT}/${encodeURIComponent(code)}/rates/today`, {
      // The list changes once a working day; anything fresher is wasted work.
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as {
      exchange_middle?: number | string;
      date?: string;
      parity?: number;
    };
    const middle = Number(data.exchange_middle);
    // Some currencies are quoted per 100 units; dividing by the parity gives a
    // per-unit rate whatever the quote convention.
    const parity = Number(data.parity) || 1;
    if (!Number.isFinite(middle) || middle <= 0) return null;

    return {
      rate: middle / parity,
      date: typeof data.date === "string" ? data.date : new Date().toISOString().slice(0, 10),
    };
  } catch {
    return null;
  }
}
