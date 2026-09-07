# Data Model

Source of truth: `backend/core/models.py` (migrations through `0021`).

## User

The Django user stores email and optional first/last name. The username
is generated internally and is not part of the public user experience.
`email` is the login identifier.

## OperatorProfile

One-to-one extras on the user.

- `operator_id` — unique public operator id.
- `deletion_warned_at` — set when the 24-month inactivity warning is
  sent; cleared on activity.
- `weekly_summary_sent_at` — idempotency for the Monday digest cron.

## JobApplication

One row on the user's tracker. Company and title are free text so any
application can be tracked. When saved from Platsbanken, ad fields are
copied in as a snapshot.

- `owner`, optional legacy `posting` FK.
- Snapshot: `company`, `title`, `location`, `ad_url`, `apply_url`,
  `ad_description`, `source_job_id`, `source`.
- Pipeline: `status` (public API value), derived `stage` and `outcome`,
  `employer_key`.
- Occupation snapshot: `occupation_concept_id`, `occupation_label`,
  `occupation_group_label`, `working_hours_type`, `scope_of_work_min`,
  `scope_of_work_max`.
- Wishlist planning: `intent` (`active` / `paused`), `apply_by`,
  `apply_by_is_auto`.
- Dates: `applied_at`, `deadline`, `next_action_at`, `closed_at`,
  `archived_at`.
- Contacts and notes: `contact_name`, `contact_info`, `notes`.
- CV match cache: `match_score`, `match_snapshot`, `match_version`,
  `match_scored_at`, `match_profile_id`.
- AF report flags: `report_excluded`, `report_note`, `reported_in`.

`status` values: `wishlist`, `applied`, `screening`, `interview`,
`forwarded`, `offer`, `accepted`, `rejected`, `no_response`,
`withdrawn`.

Derived `stage` values: `bevakad`, `sokt`, `kontakt`, `intervju`,
`erbjudande`, `avslutad`.

Soft-archive (`archived_at`) hides the row from the default list; it
still appears in `tracked-urls` for duplicate protection.

## ApplicationEvent

Timeline entry for one application. Manual notes and automatic status
changes share the same list.

- `occurred_at`, `note`, `status`, `event_type`
- `from_stage`, `to_stage`, `origin` (`manuell` / `auto` / `import`)
- `is_reportable`, `report_excluded`, `reported_in`

## Resume

Structured CV. Uploaded files are never stored.

- `headline`, `summary`
- `skills` (flat, derived), `skill_groups`
- `experience`, `education`
- `job_profiles` (evidence / “har det” per profile)

## SavedJobSearch

A Platsbanken query the user can re-run. Also drives “new since last
digest” via `digest_checked_at`.

- `label`, `q`, `regions`, `municipalities`
- `occupation_fields`, `occupation_groups`, `remote`, `match_cv`

## ReportPeriod

A calendar month as an AF reporting object. Status is derived (open /
submitted), never stored as a workflow enum.

- `year`, `month`, `submitted_at`, `note`
- Unique per `(user, year, month)`
- Period key in the API: `YYYY-MM`

## Activity

Something other than a job application that belongs in the AF report
(recruitment fair, course, networking, CV work, AF meeting, …).

- `type`, `occurred_on`, `title`, `organisation`, `note`
- Optional `job` FK, `reported_in`, `report_excluded`, `report_note`

## JobPosting

Legacy model kept for historical `JobApplication.posting` foreign keys.
New applications are created from live JobTech hits (`/api/v1/jobs/`)
as free-text snapshots. The import command and `/api/v1/postings/` API
were removed in 2026. Admin is read-only.

## Privacy Classification

- Account email, operator id, application rows, notes, contact details,
  structured CV, saved searches, report periods and activities are
  personal data.
- Recruiter names or emails entered by the user can be third-party
  personal data and must be covered in the privacy policy.
- Uploaded CV file bytes must never be persisted.
- `ad_description` is a user-owned snapshot of an ad the user chose to
  save — not a full Platsbanken mirror.
