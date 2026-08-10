/** Best job-profile fit line: "Bäst som: IT-support 71% · Ekonomi 32%" */

export default function ProfileFitRow({ profiles }) {
  if (!Array.isArray(profiles) || profiles.length < 2) return null;
  const parts = profiles
    .filter((row) => row?.label)
    .slice(0, 3)
    .map((row) => {
      const score =
        row.score != null
          ? `${row.score}%`
          : row.confidence === "low"
            ? "litet underlag"
            : "—";
      return `${row.label} ${score}`;
    });
  if (!parts.length) return null;
  return (
    <p className="profile-fit-row muted">
      Bäst som: {parts.join(" · ")}
    </p>
  );
}
