import { request } from "./api.js";

/** POST one evidence term onto the active job profile. */
export async function addEvidenceTerm(term, { category = "domain", label = "Från annons" } = {}) {
  const cleaned = String(term || "").trim();
  if (!cleaned) throw new Error("term required");
  return request("/api/v1/me/resume/evidence/", {
    method: "POST",
    body: {
      term: cleaned,
      category,
      source: { type: "manual", label },
    },
  });
}

/** Optimistic local update after covering a gap term. */
export function coverGapInMatch(match, gap) {
  if (!match || !gap?.term) return match;
  const term = gap.term;
  const level = gap.level || "must";
  const gaps = (match.gaps || []).filter((row) => row.term !== term);
  const missing = (match.missing || []).filter((t) => t !== term);
  const covered = [
    ...(match.covered || []),
    {
      term,
      level,
      snippet: gap.snippet || "",
      source: { type: "manual", label: "Från annons" },
    },
  ];
  let must_covered = match.must_covered ?? match.count ?? 0;
  let merit_covered = match.merit_covered ?? 0;
  if (level === "merit") merit_covered += 1;
  else must_covered += 1;
  const must_total = match.must_total ?? match.total ?? 0;
  const merit_total = match.merit_total ?? 0;
  let score = match.score;
  if (match.confidence !== "low") {
    if (must_total > 0) score = Math.round((100 * must_covered) / must_total);
    else if (merit_total > 0)
      score = Math.round((100 * merit_covered) / merit_total);
  }
  const count = must_total > 0 ? must_covered : merit_covered;
  const total = must_total > 0 ? must_total : merit_total;
  return {
    ...match,
    gaps,
    missing,
    covered,
    must_covered,
    merit_covered,
    score,
    count,
    total,
    matched: covered.map((row) => row.term),
    band:
      score == null
        ? match.band
        : score >= 70
          ? "strong"
          : score >= 40
            ? "medium"
            : score > 0
              ? "weak"
              : "none",
  };
}
