/**
 * Sliding pill highlight — same motion as the main nav tab indicator.
 */

export function alignPillIndicator(
  container,
  { scrollActive = false, activeSelector = ".active" } = {}
) {
  if (!(container instanceof HTMLElement)) return;

  const active = container.querySelector(activeSelector);
  const indicator = container.querySelector(
    ".pill-indicator, .tab-indicator"
  );
  if (!(active instanceof HTMLElement)) return;

  if (scrollActive) {
    const navRect = container.getBoundingClientRect();
    const tabRect = active.getBoundingClientRect();
    let delta = 0;
    if (tabRect.left < navRect.left + 8) {
      delta = tabRect.left - navRect.left - 8;
    } else if (tabRect.right > navRect.right - 8) {
      delta = tabRect.right - navRect.right + 8;
    }
    if (Math.abs(delta) > 1 && typeof container.scrollBy === "function") {
      container.scrollBy({ left: delta, behavior: "auto" });
    }
  }

  if (indicator instanceof HTMLElement) {
    indicator.style.width = `${active.offsetWidth}px`;
    indicator.style.transform = `translateX(${active.offsetLeft}px)`;
    indicator.classList.add("is-ready");
  }
}

export function observePillIndicator(container, options = {}) {
  if (!(container instanceof HTMLElement)) return () => {};

  const align = () => alignPillIndicator(container, options);
  align();

  const observer = new ResizeObserver(align);
  observer.observe(container);
  for (const child of container.children) {
    if (!(child instanceof HTMLElement)) continue;
    if (
      child.classList.contains("pill-indicator") ||
      child.classList.contains("tab-indicator")
    ) {
      continue;
    }
    observer.observe(child);
  }
  container.addEventListener("scroll", align, { passive: true });
  return () => {
    observer.disconnect();
    container.removeEventListener("scroll", align);
  };
}
