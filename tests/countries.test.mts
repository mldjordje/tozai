import assert from "node:assert/strict";
import test from "node:test";
import {
  COUNTRIES,
  countryOptions,
  defaultCountry,
  isSerbia,
  requiresSerbianCompanyIds,
} from "../lib/countries.ts";

// isSerbia() decides which tax document a buyer is issued, so every spelling the
// system can produce has to land on the right side of it.

test("the default selection is Serbia, in the language being used", () => {
  assert.equal(defaultCountry("sr"), "Srbija");
  assert.equal(defaultCountry("en"), "Serbia");
});

test("Serbia is recognised in both languages, cased or not", () => {
  for (const value of ["Srbija", "SRBIJA", "srbija", "Serbia", "RS", "SRB", "Republika Srbija"]) {
    assert.equal(isSerbia(value), true, value);
  }
});

test("a country nobody chose reads as domestic, which is what old rows meant", () => {
  assert.equal(isSerbia(null), true);
  assert.equal(isSerbia(""), true);
  assert.equal(isSerbia("   "), true);
});

test("everywhere else is foreign", () => {
  for (const value of ["Germany", "Nemačka", "Hrvatska", "Croatia", "United States", "DE"]) {
    assert.equal(isSerbia(value), false, value);
  }
});

test("only a Serbian company is asked for a PIB and a matični broj", () => {
  assert.equal(requiresSerbianCompanyIds("Srbija"), true);
  assert.equal(requiresSerbianCompanyIds("Austria"), false);
});

test("every option value is what isSerbia will later be asked about", () => {
  for (const locale of ["sr", "en"]) {
    const options = countryOptions(locale);
    assert.equal(options.length, COUNTRIES.length);
    // Exactly one option — Serbia — may be domestic. If a label ever collides
    // with a Serbia alias, a buyer elsewhere would silently get the wrong
    // document, so the list itself is asserted rather than trusted.
    assert.equal(options.filter((option) => isSerbia(option.value)).length, 1);
  }
});
