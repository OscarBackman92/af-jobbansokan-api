const ICONS = {
  dash: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"
      />
    </svg>
  ),
  saved: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3.5h10a1.5 1.5 0 0 1 1.5 1.5v16L12 17.5 5.5 21V5A1.5 1.5 0 0 1 7 3.5z"
      />
    </svg>
  ),
  applied: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5zm4.2 7.1 2.3 2.3 5.3-5.4 1.1 1.1-6.4 6.5-3.4-3.4z"
      />
    </svg>
  ),
  report: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3.5h7.5L20 9v11.5A1.5 1.5 0 0 1 18.5 22h-13A1.5 1.5 0 0 1 4 20.5v-15A1.5 1.5 0 0 1 5.5 4zm7.5 1.2V9H19zM8 12h8v1.5H8zm0 3.5h8V17H8z"
      />
    </svg>
  ),
  postings: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13m0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9m6.66 9.25 4.07 4.06-1.41 1.42-4.07-4.07z"
      />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8m0 9.5c3.6 0 6.5 2.05 6.5 5.25V20H5.5v-1.25C5.5 15.55 8.4 13.5 12 13.5z"
      />
    </svg>
  ),
};

export default function TabIcon({ id }) {
  const icon = ICONS[id];
  if (!icon) return null;
  return <span className="tab-icon">{icon}</span>;
}
