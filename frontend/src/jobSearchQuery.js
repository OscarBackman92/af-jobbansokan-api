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
