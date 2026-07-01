// Tiny stand-in for the JobTech APIs so E2E runs are deterministic
// and offline. The Django backend is pointed here via
// JOBTECH_SEARCH_URL / JOBTECH_TAXONOMY_URL (see backend.py).
import { createServer } from "node:http";

const PORT = 9797;

const SEARCH_PAYLOAD = {
  total: { value: 2 },
  hits: [
    {
      id: "9001",
      headline: "Backendutvecklare Python",
      employer: { name: "Testbolaget AB" },
      workplace_address: { municipality: "Stockholm" },
      publication_date: "2026-06-20T08:00:00",
      application_deadline: "2026-08-15T23:59:59",
      description: { text: "Vi arbetar med Python och Django i molnet." },
      webpage_url: "https://arbetsformedlingen.se/platsbanken/annonser/9001",
      remote_work: true,
    },
    {
      id: "9002",
      headline: "Frontendutvecklare React",
      employer: { name: "Webbyran AB" },
      workplace_address: { municipality: "Göteborg" },
      publication_date: "2026-06-21T08:00:00",
      application_deadline: "2026-08-20T23:59:59",
      description: { text: "React, Vite och TypeScript i vardagen." },
      webpage_url: "https://arbetsformedlingen.se/platsbanken/annonser/9002",
      remote_work: false,
    },
  ],
};

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  if (url.pathname === "/search") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(SEARCH_PAYLOAD));
    return;
  }
  if (url.pathname === "/taxonomy") {
    // Shape accepted by jobtech._concepts_from_payload (plain list).
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify([]));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`mock-jobtech listening on http://127.0.0.1:${PORT}`);
});
