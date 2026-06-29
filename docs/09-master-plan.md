# Master Plan - Ansokt

## Thesis

Ansokt should be the daily workspace for a job seeker: the place where every
application, deadline, contact, interview, note and next step is visible. The
product wins by being calmer and more useful than a spreadsheet, while still
keeping the user's data portable.

The direction is now deliberately single-player first. No identity-verification
track, no authority workflow and no employer-side platform until the personal
tracker is sticky on its own.

## Current Strengths

- A kanban board over the application pipeline.
- Manual rows for jobs found anywhere.
- Live Platsbanken search through JobTech.
- CV parsing and explainable skill matching.
- Timeline entries per application.
- CSV export and account deletion.
- Production-ready Django/DRF API with a React/Vite frontend.

## Product Phases

### Phase 0 - Launch Confidence

- [x] Render deployment blueprint.
- [x] Password reset flow.
- [x] Backend tests, linting and frontend build in CI.
- [ ] Custom domain, uptime checks and Sentry.
- [ ] Production SMTP configured and verified.
- [ ] Privacy policy page and plain-language data handling summary.
- [ ] Frontend smoke tests for signup, board, ad save and CV edit.

### Phase 1 - Useful Every Day

- [x] Board search and quick filters.
- [x] Better empty-state onboarding from the board.
- [x] Editable CV experience descriptions.
- [ ] Reminder emails for overdue `next_action_at` rows.
- [ ] Saved searches for JobTech queries.
- [ ] Hide or deprioritize ads already saved to the board.
- [ ] XLSX export alongside CSV.

### Phase 2 - Better Matching

- [ ] Sort job ads by CV skill match.
- [ ] Explain missing skills as well as matched skills.
- [ ] Suggest search terms from the user's CV.
- [ ] Let users mark skills as "must have", "nice to have" or "learning".
- [ ] Add saved-search digest emails.

### Phase 3 - Retention and Polish

- [ ] Calendar export for interviews and follow-ups.
- [ ] Templates for notes, recruiter calls and interview prep.
- [ ] Weekly summary: applications sent, follow-ups due, interviews booked.
- [ ] Mobile polish pass with visual screenshots.
- [ ] Accessibility pass for modal focus, keyboard movement and labels.

### Phase 4 - Scale When Needed

- Background jobs for reminders and digests.
- Short-lived caching for JobTech searches.
- Postgres full-text search for larger local datasets.
- Structured logging, metrics and alerting.

## Principles

1. The user owns the data: export and delete must stay obvious.
2. The app should reduce anxiety, not add administration.
3. Matching must be explainable.
4. Store less whenever possible: parse CV files, never keep uploads.
5. Prefer the personal tracker until user demand proves another surface.

## Near-Term Implementation Order

1. Make the board faster to scan with filters, search and follow-up states.
2. Make CV editing trustworthy after parsing.
3. Add reminder delivery.
4. Add saved searches and digest emails.
5. Add frontend smoke tests and monitoring before public traffic.
