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
