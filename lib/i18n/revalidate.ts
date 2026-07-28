import "server-only";
import { revalidatePath } from "next/cache";
import { LOCALES, localePath } from "./config";

// Every public page now exists once per language, so a single revalidatePath("/")
// only refreshed half the site: the studio would save a package, see the change
// on "/", and find "/en" still serving the previous ISR render until its window
// expired. Admin writes go through here instead of naming paths one at a time.

export function revalidatePublic(path: string) {
  for (const locale of LOCALES) {
    revalidatePath(localePath(locale, path));
  }
}
