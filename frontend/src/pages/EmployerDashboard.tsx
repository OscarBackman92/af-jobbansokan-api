import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployerApplications,
  updateEmployerApplicationStatus,
} from "../api/applications";
import type { EmployerApplication, AppStatus } from "../api/applications";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";

const STATUSES: { value: AppStatus; label: string; color: string }[] = [
  { value: "applied",   label: "Ansökt",      color: "bg-blue-50 text-blue-700 hover:bg-blue-100" },
  { value: "interview", label: "Kallad",       color: "bg-violet-50 text-violet-700 hover:bg-violet-100" },
  { value: "offer",     label: "Erbjudande",   color: "bg-green-50 text-green-700 hover:bg-green-100" },
  { value: "rejected",  label: "Neka",         color: "bg-red-50 text-red-700 hover:bg-red-100" },
];

function ApplicantCard({ app }: { app: EmployerApplication }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const mut = useMutation({
    mutationFn: (s: AppStatus) => updateEmployerApplicationStatus(app.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employer-applications"] }),
  });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 hover:shadow-md transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-af-blue-light text-af-blue font-bold text-sm">
            {app.owner.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-gray-900">{app.owner.username}</p>
            <p className="text-xs text-gray-500">{app.owner.email}</p>
          </div>
        </div>
        <StatusBadge status={app.status} />
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3">
        <p className="text-sm font-medium text-gray-700">{app.posting.title}</p>
        <p className="text-xs text-gray-500 mt-0.5">{app.posting.company_name} · {app.posting.location}</p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-gray-400">
          Ansökt {new Date(app.applied_at).toLocaleDateString("sv-SE")}
        </span>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-medium text-af-blue hover:underline"
        >
          {open ? "Stäng ▲" : "Ändra status ▼"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-gray-50 pt-4 animate-slide-in">
          <p className="text-xs font-medium text-gray-500 mb-3">Sätt status för kandidaten</p>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => mut.mutate(s.value)}
                disabled={app.status === s.value || mut.isPending}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  app.status === s.value ? "ring-2 ring-af-blue ring-offset-1 opacity-80" : ""
                } ${s.color} disabled:cursor-default`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployerDashboard() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<AppStatus | "">("");
  const qc = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["employer-applications", filter],
    queryFn: () => fetchEmployerApplications(filter as AppStatus || undefined),
  });

  const counts = {
    all:       data.length,
    applied:   data.filter((a) => a.status === "applied").length,
    interview: data.filter((a) => a.status === "interview").length,
    offer:     data.filter((a) => a.status === "offer").length,
    rejected:  data.filter((a) => a.status === "rejected").length,
  };

  const filterBtn = (value: AppStatus | "", label: string, count: number) => (
    <button
      type="button"
      key={value}
      onClick={() => setFilter(value)}
      className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
        filter === value
          ? "bg-af-blue text-white shadow-sm"
          : "bg-white text-gray-600 ring-1 ring-gray-200 hover:ring-af-blue hover:text-af-blue"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${filter === value ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
        {count}
      </span>
    </button>
  );

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Arbetsgivarpanel</h1>
              <p className="mt-1 text-gray-500">
                {user?.username} · {user?.employer_role === "admin" ? "Administratör" : "Medlem"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ["employer-applications"] })}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ↻ Uppdatera
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {[
            { label: "Totalt",      value: counts.all,       bg: "bg-white" },
            { label: "Ansökt",      value: counts.applied,   bg: "bg-blue-50" },
            { label: "Intervju",    value: counts.interview, bg: "bg-violet-50" },
            { label: "Erbjudande",  value: counts.offer,     bg: "bg-green-50" },
            { label: "Nekad",       value: counts.rejected,  bg: "bg-red-50" },
          ].map((c) => (
            <div key={c.label} className={`rounded-2xl ${c.bg} p-5 ring-1 ring-gray-100`}>
              <div className="text-3xl font-extrabold text-gray-900">{c.value}</div>
              <div className="mt-1 text-sm text-gray-500">{c.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filterBtn("",          "Alla",        counts.all)}
          {filterBtn("applied",   "Ansökt",      counts.applied)}
          {filterBtn("interview", "Intervju",    counts.interview)}
          {filterBtn("offer",     "Erbjudande",  counts.offer)}
          {filterBtn("rejected",  "Nekad",       counts.rejected)}
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl bg-white animate-pulse ring-1 ring-gray-100" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-5xl mb-4">📬</div>
            <p className="text-lg text-gray-500">
              {filter ? "Inga ansökningar med denna status." : "Inga ansökningar ännu."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((app: EmployerApplication) => (
              <ApplicantCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
