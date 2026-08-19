export function countSummary(count, singular, plural) {
  const n = Number(count) || 0;
  if (n === 1) return `1 ${singular}`;
  return `${n} ${plural}`;
}
