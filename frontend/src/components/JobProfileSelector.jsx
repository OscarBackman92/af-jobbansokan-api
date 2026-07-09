import { MAX_PROFILES } from "../jobProfiles.js";

export default function JobProfileSelector({
  profiles,
  activeId,
  onSelect,
  onAdd,
  onRename,
}) {
  return (
    <div className="job-profile-selector">
      <div className="job-profile-tabs" role="tablist" aria-label="Jobbprofiler">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            role="tab"
            className={profile.id === activeId ? "job-profile-tab active" : "job-profile-tab"}
            aria-selected={profile.id === activeId}
            onClick={() => onSelect(profile.id)}
            onDoubleClick={() => {
              const next = window.prompt("Namn på profilen", profile.label);
              if (next?.trim()) onRename(profile.id, next.trim());
            }}
            title="Dubbelklicka för att byta namn"
          >
            {profile.label}
          </button>
        ))}
        {profiles.length < MAX_PROFILES && (
          <button type="button" className="job-profile-tab job-profile-tab--add" onClick={onAdd}>
            + Ny profil
          </button>
        )}
      </div>
      <p className="muted job-profile-hint">
        Olika sökprofiler om du söker olika typer av jobb. Dubbelklicka fliken
        för att byta namn.
      </p>
    </div>
  );
}
