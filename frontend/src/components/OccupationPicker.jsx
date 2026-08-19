import { useEffect, useId, useRef, useState } from "react";

import { request } from "../api.js";

const CLOSE_MS = 220;

export default function OccupationPicker({
  label = "Yrke (AF-taxonomi)",
  value = "",
  conceptId = "",
  onChange,
}) {
  const [query, setQuery] = useState(value || "");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false);
  const rootRef = useRef(null);
  const timer = useRef(null);
  const listId = useId();

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

  const canShow = open && options.length > 0;

  useEffect(() => {
    if (canShow) setMounted(true);
  }, [canShow]);

  useEffect(() => {
    if (canShow && mounted) {
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    if (!canShow) setShown(false);
    return undefined;
  }, [canShow, mounted]);

  useEffect(() => {
    if (canShow || !mounted) return undefined;
    const closeTimer = window.setTimeout(() => setMounted(false), CLOSE_MS);
    return () => window.clearTimeout(closeTimer);
  }, [canShow, mounted]);

  useEffect(() => {
    if (!open) return undefined;

    function onPointerDown(event) {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    }

    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <label className="occupation-picker" ref={rootRef}>
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
        aria-autocomplete="list"
        aria-expanded={shown}
        aria-controls={mounted ? listId : undefined}
      />
      {conceptId && (
        <span className="muted occupation-picker-id">Taxonomi {conceptId}</span>
      )}
      {mounted && options.length > 0 && (
        <ul
          id={listId}
          className={`occupation-picker-list${
            shown ? " occupation-picker-list--open" : ""
          }`}
          role="listbox"
        >
          {options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                role="option"
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
