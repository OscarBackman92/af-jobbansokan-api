# Vision & Scope

Current product name: **Jobbdjungeln** (formerly Ansökt / Jobbsöket).
The 2026-06-12 pivot away from verifiable A-kassa events is documented in
[10-pivot-ansokt.md](10-pivot-ansokt.md).

## Vision

Jobbdjungeln helps job seekers keep calm, complete control over their job
search. It replaces the private spreadsheet many people build for
applications, deadlines, contacts, interviews and follow-ups.

## Scope

The product is a personal application tracker with:

- Email-based accounts (mandatory verification before login). Optional
  Google login when `GOOGLE_CLIENT_ID` is configured.
- Six SPA surfaces under `/app/`: Översikt, Sparade jobb, Ansökningar,
  Rapportera, Annonser, Profil & CV.
- Manual application rows from any source, plus one-click save from live
  Platsbanken search (JobTech JobSearch API).
- CV parsing (in memory), editable structured CV data, job profiles and
  explainable skill matching.
- Timeline notes per application; status changes are logged automatically.
- Monthly AF-style activity reporting (`ReportPeriod` + `Activity`) as a
  personal helper — not an authority integration.
- CSV export, ICS calendar export, reminder and weekly-summary e-mails,
  and account deletion.

## Out Of Scope

- Employer-side recruiting workflows.
- Authority or partner APIs (Arbetsförmedlingen, A-kassa). Rapportera is
  a local packing list the user copies by hand.
- Identity verification (BankID and similar). See
  [08-identity-bankid.md](08-identity-bankid.md).
- Stored CV uploads (files are parsed in memory only).
- Analytics or advertising tracking.

## Success Criteria

- A new user can understand the product from the first screen.
- A user can add or save the first application in under a minute.
- Follow-ups and deadlines are visible without manual spreadsheet scanning.
- The user can export or delete their data without contacting support.
