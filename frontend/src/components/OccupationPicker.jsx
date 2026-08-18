import { useEffect, useRef, useState } from "react";

import { request } from "../api.js";

export default function OccupationPicker({
  label = "Yrke (AF-taxonomi)",
  value = "",
  conceptId = "",
  onChange,
}) {
  const [query, setQuery] = useState(value || "");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) {
      setOptions([]);
      return undefined;
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      request(`/api/v1/jobs/occupations/?q=${encodeURIComponent(text)}`)
        .then((body) => setOptions(body.results || []))
        .catch(() => setOptions([]));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [query]);

  return (
    <label className="occupation-picker">
      {label}
      <input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          onChange?.({
            occupation_label: event.target.value,
            occupation_concept_id: "",
          });
        }}
        onFocus={() => setOpen(true)}
        placeholder="Sök yrke, t.ex. systemutvecklare"
        autoComplete="off"
      />
      {conceptId && (
        <span className="muted occupation-picker-id">Taxonomi {conceptId}</span>
      )}
      {open && options.length > 0 && (
        <ul className="occupation-picker-list" role="listbox">
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => {
                  setQuery(option.label);
                  setOpen(false);
                  onChange?.({
                    occupation_label: option.label,
                    occupation_concept_id: option.id,
                  });
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </label>
  );
}
