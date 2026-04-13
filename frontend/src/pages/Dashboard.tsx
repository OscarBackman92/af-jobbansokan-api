import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchApplications,
  updateApplicationStatus,
  deleteApplication,
} from "../api/applications";
import type { Application, AppStatus } from "../api/applications";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";

const STATUSES: { value: AppStatus; label: string }[] = [
  { value: "applied", label: "Ansökt" },
  { value: "interview", label: "Intervju" },
  { value: "offer", label: "Erbjudande" },
  { value: "rejected", label: "Nekad" },
];

function AppCard({ app }: { app: Application }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();

  const updateMut = useMutation({
    mutationFn: (s: AppStatus) => updateApplicationStatus(app.id, s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteApplication(app.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["applications"] }),
  });

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 hover:shadow-md transition-shadow animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{app.posting_detail.title}</h3>
          <p className="mt-0.5 text-sm text-gray-500">{app.posting_detail.company_name}</p>
          {app.posting_detail.location && (
            <p className="mt-0.5 text-xs text-gray-400">📍 {app.posting_detail.location}</p>
          )}
        </div>
        <StatusBadge status={app.status} />
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
          {open ? "Stäng ▲" : "Uppdatera ▼"}
        </button>
      </div>

      {open && (
        <div className="mt-4 border-t border-gray-50 pt-4 animate-slide-in">
          <p className="text-xs font-medium text-gray-500 mb-3">Uppdatera status</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {STATUSES.map((s) => (
              <button
                type="button"
                key={s.value}
                onClick={() => updateMut.mutate(s.value)}
                disabled={app.status === s.value || updateMut.isPending}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  app.status === s.value
                    ? "bg-af-blue text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                } disabled:opacity-50`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => deleteMut.mutate()}
            disabled={deleteMut.isPending}
            className="text-xs text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
          >
            {deleteMut.isPending ? "Tar bort…" : "Ta bort ansökan"}
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className={`rounded-2xl p-6 ${color}`}>
      <div className="text-3xl font-extrabold text-gray-900">{value}</div>
      <div className="mt-1 text-sm font-medium text-gray-600">{label}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["applications", query, page],
    queryFn: () => fetchApplications(query, page),
  });

  const { data: all } = useQuery({
    queryKey: ["applications", "", 1],
    queryFn: () => fetchApplications("", 1),
  });

  const counts = {
    applied: all?.results.filter((a) => a.status === "applied").length ?? 0,
    interview: all?.results.filter((a) => a.status === "interview").length ?? 0,
    offer: all?.results.filter((a) => a.status === "offer").length ?? 0,
    rejected: all?.results.filter((a) => a.status === "rejected").length ?? 0,
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(search);
    setPage(1);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <h1 className="text-3xl font-bold text-gray-900">
            Hej, {user?.username} 👋
          </h1>
          <p className="mt-1 text-gray-500">Dina jobbansökningar</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard value={counts.applied}   label="Ansökt"      color="bg-blue-50" />
          <StatCard value={counts.interview} label="Intervju"    color="bg-violet-50" />
          <StatCard value={counts.offer}     label="Erbjudande"  color="bg-green-50" />
          <StatCard value={counts.rejected}  label="Nekad"       color="bg-red-50" />
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-3 max-w-lg">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Sök bland dina ansökningar…"
            className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-af-blue focus:border-transparent"
          />
          <button
            type="submit"
            className="rounded-xl bg-af-blue px-6 py-3 text-sm font-semibold text-white hover:bg-af-blue-dark transition-colors"
          >
            Sök
          </button>
        </form>

        {/* List */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-40 rounded-2xl bg-white animate-pulse ring-1 ring-gray-100" />
            ))}
          </div>
        ) : data?.results.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-5xl mb-4">📭</div>
            <p className="text-lg text-gray-500">
              {query ? `Inga ansökningar matchar "${query}"` : "Du har inga ansökningar ännu."}
            </p>
            {!query && (
              <a href="/jobs" className="mt-4 inline-block text-af-blue text-sm hover:underline">
                Bläddra bland lediga jobb →
              </a>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data?.results.map((app: Application) => (
              <AppCard key={app.id} app={app} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.count > 20 && (
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={!data.previous}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              ← Föregående
            </button>
            <span className="text-sm text-gray-500">Sida {page}</span>
            <button
              type="button"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40"
            >
              Nästa →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
