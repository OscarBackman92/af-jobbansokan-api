export function matchScanCaption({
  showingFrom,
  showingTo,
  matchTotal,
  scanned,
  upstreamTotal,
  empty = false,
}) {
  const scannedN = Number(scanned || 0);
  const upstreamN = Number(upstreamTotal || 0);
  const scannedLabel = scannedN.toLocaleString("sv-SE");
  const upstreamLabel = upstreamN.toLocaleString("sv-SE");
  const totalLabel = Number(matchTotal || 0).toLocaleString("sv-SE");

  if (empty) {
    if (upstreamN > scannedN && scannedN > 0) {
      return `Inga av de ${scannedLabel} nyaste av ${upstreamLabel} träffar nådde filtret.`;
    }
    return `Inga av de ${scannedLabel || "—"} genomsökta annonserna nådde filtret.`;
  }

  const range = `Visar ${showingFrom}–${showingTo} av ${totalLabel} som når filtret`;
  if (!scannedN) return range;
  if (upstreamN > scannedN) {
    return `${range} — matchat mot de ${scannedLabel} nyaste av ${upstreamLabel} träffar`;
  }
  return `${range} — matchat mot ${scannedLabel} träffar`;
}

function idsKey(items = []) {
  return items
    .map((row) => (typeof row === "string" ? row : row?.id))
    .filter(Boolean)
    .join("\0");
}

export function isSearchDraftPending(draft, applied) {
  if (!draft || !applied) return false;
  return (
    String(draft.q || "").trim() !== String(applied.q || "").trim() ||
    idsKey(draft.municipalities) !== idsKey(applied.municipalities) ||
    idsKey(draft.groups) !== idsKey(applied.groups) ||
    Boolean(draft.remote) !== Boolean(applied.remote) ||
    Boolean(draft.matchCv) !== Boolean(applied.matchCv) ||
    Boolean(draft.minMatch60) !== Boolean(applied.minMatch60) ||
    Boolean(draft.hideBlocked) !== Boolean(applied.hideBlocked)
  );
}

export function pendingCountCaption(draftQ, appliedQ) {
  const typed = String(draftQ || "").trim();
  const applied = String(appliedQ || "").trim();
  if (typed && typed !== applied) {
    return `Träffarna gäller inte “${typed}” ännu — klicka Sök.`;
  }
  return "Filtren är ändrade — klicka Sök för att uppdatera träffarna.";
}
