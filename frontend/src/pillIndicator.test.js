import { afterEach, describe, expect, it, vi } from "vitest";

import { alignPillIndicator, observePillIndicator } from "./pillIndicator.js";

describe("alignPillIndicator", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("sizes and moves the indicator onto the active item", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span class="pill-indicator"></span>
      <button type="button">System</button>
      <button type="button" class="active">Daylight</button>
    `;
    document.body.appendChild(root);
    const active = root.querySelector(".active");
    Object.defineProperty(active, "offsetWidth", { value: 88 });
    Object.defineProperty(active, "offsetLeft", { value: 52 });

    alignPillIndicator(root);

    const indicator = root.querySelector(".pill-indicator");
    expect(indicator.style.width).toBe("88px");
    expect(indicator.style.transform).toBe("translateX(52px)");
    expect(indicator.classList.contains("is-ready")).toBe(true);
  });

  it("scrolls a clipped active item into view", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <span class="tab-indicator"></span>
      <a class="tab active">Annonser</a>
    `;
    document.body.appendChild(root);
    root.getBoundingClientRect = () => ({ left: 100, right: 200 });
    const active = root.querySelector(".active");
    active.getBoundingClientRect = () => ({ left: 40, right: 90 });
    const scrollBy = vi.fn();
    root.scrollBy = scrollBy;

    alignPillIndicator(root, { scrollActive: true });

    expect(scrollBy).toHaveBeenCalledWith({ left: -68, behavior: "auto" });
  });
});

describe("observePillIndicator", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("aligns immediately and disconnects the observer on cleanup", () => {
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = observe;
        disconnect = disconnect;
      }
    );

    const root = document.createElement("div");
    root.innerHTML = `
      <span class="pill-indicator"></span>
      <button type="button" class="active">Command</button>
    `;
    document.body.appendChild(root);
    const active = root.querySelector(".active");
    Object.defineProperty(active, "offsetWidth", { value: 70 });
    Object.defineProperty(active, "offsetLeft", { value: 8 });

    const stop = observePillIndicator(root);
    expect(root.querySelector(".pill-indicator").style.width).toBe("70px");
    expect(observe).toHaveBeenCalled();

    stop();
    expect(disconnect).toHaveBeenCalled();
  });
});
