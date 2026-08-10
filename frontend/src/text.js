/** Fold Swedish (and other) diacritics for tolerant search. */
export function foldDiacritics(value) {
  if (!value) return "";
  return String(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[øØ]/g, (ch) => (ch === "ø" ? "o" : "O"))
    .replace(/[æÆ]/g, (ch) => (ch === "æ" ? "ae" : "AE"))
    .toLowerCase();
}

/** Free-text match over common application fields. */
export function matchesApplicationSearch(application, query) {
  const terms = foldDiacritics(query)
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return true;
  const haystack = foldDiacritics(
    [
      application.company,
      application.title,
      application.location,
      application.notes,
      application.contact_name,
      application.contact_info,
      application.source,
    ]
      .filter(Boolean)
      .join(" ")
  );
  return terms.every((term) => haystack.includes(term));
}
