import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPostings } from "../api/postings";
import type { JobPosting } from "../api/postings";
import { createApplication } from "../api/applications";
import { useAuth } from "../contexts/AuthContext";

function JobCard({ posting, onApply }: { posting: JobPosting; onApply: (p: JobPosting) => void }) {
  const { user } = useAuth();
  return (
    <div className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all animate-fade-in">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-lg bg-af-blue-light text-af-blue text-xs font-semibold px-2.5 py-1">
              {posting.organization?.name ?? posting.company_name}
            </span>
            {posting.location && (
              <span className="text-xs text-gray-400">📍 {posting.location}</span>
            )}
          </div>
          <h3 className="text-base font-bold text-gray-900 mt-2 truncate">{posting.title}</h3>
          <p className="mt-1 text-sm text-gray-500">{posting.company_name}</p>
        </div>
        {posting.published_at && (
          <span className="shrink-0 text-xs text-gray-400">
            {new Date(posting.published_at).toLocaleDateString("sv-SE")}
          </span>
        )}
      </div>

      {user && !user.is_employer && (
        <button
          type="button"
          onClick={() => onApply(posting)}
          className="mt-4 w-full rounded-xl bg-af-blue py-2.5 text-sm font-semibold text-white hover:bg-af-blue-dark transition-colors"
        >
          Ansök nu
        </button>
      )}
      {!user && (
        <p className="mt-4 text-center text-xs text-gray-400">
          <a href="/login" className="text-af-blue hover:underline">Logga in</a> för att ansöka
        </p>
      )}
    </div>
  );
}

function ApplyModal({
  posting,
  onClose,
  onSuccess,
}: {
  posting: JobPosting;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState("");
  const qc = useQueryClient();

  const mut = useMutation({
    mutationFn: () => createApplication(posting.id, date),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["applications"] });
      onSuccess();
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: Record<string, string[]> } })?.response?.data;
      setError(msg ? Object.values(msg).flat()[0] : "Något gick fel.");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl animate-slide-up">
        <h2 className="text-xl font-bold text-gray-900">Ansök till tjänst</h2>
        <p className="mt-1 text-sm text-gray-500">{posting.title} · {posting.company_name}</p>

        <div className="mt-6">
          <label htmlFor="apply-date" className="block text-sm font-medium text-gray-700 mb-1.5">
            Ansökningsdatum
          </label>
          <input
            id="apply-date"
            type="date"
            value={date}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-af-blue focus:border-transparent"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="flex-1 rounded-xl bg-af-blue py-2.5 text-sm font-semibold text-white hover:bg-af-blue-dark disabled:opacity-60 transition-colors"
          >
            {mut.isPending ? "Skickar…" : "Skicka ansökan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Jobs() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [applying, setApplying] = useState<JobPosting | null>(null);
  const [success, setSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["postings", query, page],
    queryFn: () => fetchPostings(query, page),
  });

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
          <h1 className="text-3xl font-bold text-gray-900">Lediga jobb</h1>
          <p className="mt-2 text-gray-500">Hitta din nästa tjänst</p>

          <form onSubmit={handleSearch} className="mt-6 flex gap-3 max-w-xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Sök på titel, företag eller ort…"
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-af-blue focus:border-transparent"
            />
            <button
              type="submit"
              className="rounded-xl bg-af-blue px-6 py-3 text-sm font-semibold text-white hover:bg-af-blue-dark transition-colors"
            >
              Sök
            </button>
          </form>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Result count */}
        {data && (
          <p className="mb-6 text-sm text-gray-500">
            {data.count} {data.count === 1 ? "tjänst" : "tjänster"} hittades
            {query && <> för <span className="font-medium text-gray-900">"{query}"</span></>}
          </p>
        )}

        {isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white animate-pulse ring-1 ring-gray-100" />
            ))}
          </div>
        ) : data?.results.length === 0 ? (
          <div className="py-24 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <p className="text-gray-500 text-lg">Inga jobb hittades.</p>
            {query && (
              <button type="button" onClick={() => { setQuery(""); setSearch(""); }} className="mt-4 text-af-blue text-sm hover:underline">
                Rensa sökning
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.results.map((p) => (
              <JobCard key={p.id} posting={p} onApply={setApplying} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {data && data.count > 20 && (
          <div className="mt-10 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={!data.previous}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              ← Föregående
            </button>
            <span className="text-sm text-gray-500">Sida {page}</span>
            <button
              type="button"
              disabled={!data.next}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
            >
              Nästa →
            </button>
          </div>
        )}
      </div>

      {applying && (
        <ApplyModal
          posting={applying}
          onClose={() => setApplying(null)}
          onSuccess={() => { setApplying(null); setSuccess(true); setTimeout(() => setSuccess(false), 3000); }}
        />
      )}

      {success && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-green-600 px-6 py-4 text-white shadow-xl animate-slide-up">
          <span>✓</span>
          <span className="font-medium">Ansökan skickad!</span>
        </div>
      )}
    </div>
  );
}
