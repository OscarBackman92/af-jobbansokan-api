# Data Model

## User

The Django user stores email and optional first/last name. The username is
generated internally and is not part of the public user experience.

## JobApplication

One row on the user's tracker board.

- `owner`: the user who owns the row.
- `posting`: optional legacy imported posting reference.
- `company`, `title`, `location`, `ad_url`: the job snapshot.
- `status`: current pipeline state.
- `applied_at`, `deadline`, `next_action_at`: planning dates.
- `contact_name`, `contact_info`, `notes`: user-entered tracking details.
- `created_at`, `updated_at`: audit-friendly timestamps.

## ApplicationEvent

Timeline entry for one application. Manual notes and automatic status changes
share the same event list.

## Resume

Structured CV data saved by the user.

- `headline`
- `summary`
- `skills`
- `experience`
- `education`

Uploaded files are not stored. Parsing returns a draft, and only reviewed
structured data is saved.

## JobPosting

Legacy DB-backed job ads remain for optional imports and compatibility. The main
ad-search experience uses live JobTech search instead.

## Privacy Classification

- Account email, application rows, notes, contact details and CV fields are
  personal data.
- Recruiter names or emails entered by the user can be third-party personal
  data and must be covered in the privacy policy.
- Uploaded CV file bytes should never be persisted.
