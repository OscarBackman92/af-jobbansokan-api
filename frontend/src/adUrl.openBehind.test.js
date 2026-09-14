import { afterEach, describe, expect, it, vi } from "vitest";

import { isModifiedClick, openBehind } from "./adUrl.js";

describe("openBehind", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("opens the employer URL in another tab and focuses this window", () => {
    const tab = {
      opener: window,
      location: { replace: vi.fn(), href: "" },
    };
    const open = vi.fn(() => tab);
    const focus = vi.fn();
    vi.stubGlobal("open", open);
    vi.spyOn(window, "focus").mockImplementation(focus);

    expect(openBehind("https://example.com/ansok?utm_source=mail")).toBe(true);
    expect(open).toHaveBeenCalledWith("about:blank", "_blank");
    expect(tab.opener).toBeNull();
    expect(tab.location.replace).toHaveBeenCalledWith(
      "https://example.com/ansok"
    );
    expect(focus).toHaveBeenCalled();
  });

  it("returns false when the popup is blocked", () => {
    vi.stubGlobal("open", vi.fn(() => null));
    expect(openBehind("https://example.com/ansok")).toBe(false);
  });
});

describe("isModifiedClick", () => {
  it("lets ctrl/cmd/shift/middle clicks through to the browser", () => {
    expect(isModifiedClick({ button: 0, ctrlKey: true })).toBe(true);
    expect(isModifiedClick({ button: 0, metaKey: true })).toBe(true);
    expect(isModifiedClick({ button: 1 })).toBe(true);
    expect(isModifiedClick({ button: 0 })).toBe(false);
  });
});
