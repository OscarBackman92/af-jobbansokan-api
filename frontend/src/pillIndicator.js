/**
 * Position a sliding pill indicator under the active control.
 * Matches the main-nav tab indicator behavior.
 */
export function syncPillIndicator(container, {
  activeSelector = ".active",
  indicatorSelector = ".pill-indicator",
} = {}) {
  if (!(container instanceof HTMLElement)) return;
  const active = container.querySelector(activeSelector);
  const indicator = container.querySelector(indicatorSelector);
  if (!(active instanceof HTMLElement) || !(indicator instanceof HTMLElement)) {
    return;
  }
  indicator.style.width = `${active.offsetWidth}px`;
  indicator.style.height = `${active.offsetHeight}px`;
  indicator.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
  indicator.classList.add("is-ready");
}
