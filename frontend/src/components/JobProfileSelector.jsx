import { useLayoutEffect, useRef } from "react";

import { syncPillIndicator } from "../pillIndicator.js";
import { MAX_PROFILES } from "../jobProfiles.js";

export default function JobProfileSelector({
  profiles,
  activeId,
  onSelect,
  onAdd,
  onRename,
}) {
  const tabsRef = useRef(null);

  useLayoutEffect(() => {
    const tabs = tabsRef.current;
    if (!(tabs instanceof HTMLElement)) return undefined;

    function alignActive() {
      syncPillIndicator(tabs, {
        activeSelector: ".job-profile-tab.active",
        indicatorSelector: ".pill-indicator",
      });
    }

    alignActive();
    const observer = new ResizeObserver(() => alignActive());
    observer.observe(tabs);
    for (const child of tabs.querySelectorAll(".job-profile-tab")) {
      observer.observe(child);
    }
    return () => observer.disconnect();
  }, [profiles, activeId]);

  return (
    <div className="job-profile-selector">
      <div
        ref={tabsRef}
        className="job-profile-tabs"
        role="tablist"
        aria-label="Jobbprofiler"
      >
        <span className="pill-indicator" aria-hidden="true" />
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            role="tab"
            className={
              profile.id === activeId
                ? "job-profile-tab active"
                : "job-profile-tab"
            }
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
          <button
            type="button"
            className="job-profile-tab job-profile-tab--add"
            onClick={onAdd}
          >
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
