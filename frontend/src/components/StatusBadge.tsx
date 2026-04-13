import type { AppStatus } from "../api/applications";

const cfg: Record<AppStatus, { label: string; cls: string; dot: string }> = {
  applied:   { label: "Ansökt",    cls: "bg-blue-50 text-blue-700 ring-blue-600/20",    dot: "bg-blue-500" },
  interview: { label: "Intervju",  cls: "bg-violet-50 text-violet-700 ring-violet-600/20", dot: "bg-violet-500" },
  offer:     { label: "Erbjudande",cls: "bg-green-50 text-green-700 ring-green-600/20",  dot: "bg-green-500" },
  rejected:  { label: "Nekad",     cls: "bg-red-50 text-red-700 ring-red-600/20",         dot: "bg-red-500" },
};

export default function StatusBadge({ status }: { status: AppStatus }) {
  const { label, cls, dot } = cfg[status] ?? cfg.applied;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
