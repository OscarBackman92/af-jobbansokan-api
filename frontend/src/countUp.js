import { useEffect, useRef, useState } from "react";

const DEFAULT_DURATION = 620;

export function countUpValue(from, to, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - clamped) ** 3;
  return Math.round(from + (to - from) * eased);
}

function canAnimate(target) {
  if (typeof target !== "number" || !Number.isFinite(target)) return false;
  if (typeof window === "undefined") return false;
  if (typeof IntersectionObserver === "undefined") return false;
  return !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Counts a number up to `target` the first time the element is on screen —
 * tiles in a hidden tab wait until their tab is opened instead of animating
 * where nobody sees it. Returns the ref to attach and the value to render.
 */
export default function useCountUp(target, duration = DEFAULT_DURATION) {
  const animates = canAnimate(target);
  const nodeRef = useRef(null);
  const fromRef = useRef(0);
  const [onScreen, setOnScreen] = useState(!animates);
  const [value, setValue] = useState(animates ? 0 : target);

  useEffect(() => {
    if (!animates || onScreen) return undefined;
    const node = nodeRef.current;
    if (!node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) setOnScreen(true);
      },
      { threshold: 0.25 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [animates, onScreen]);

  useEffect(() => {
    if (!animates || !onScreen || fromRef.current === target) {
      fromRef.current = typeof target === "number" ? target : 0;
      setValue(target);
      return undefined;
    }

    const from = fromRef.current;
    const start = performance.now();
    let frame = requestAnimationFrame(step);

    function step(now) {
      const progress = (now - start) / duration;
      const next = countUpValue(from, target, progress);
      fromRef.current = next;
      setValue(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    }

    return () => cancelAnimationFrame(frame);
  }, [animates, onScreen, target, duration]);

  return [nodeRef, value];
}
