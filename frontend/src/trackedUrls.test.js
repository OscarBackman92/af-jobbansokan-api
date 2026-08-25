import { describe, expect, it } from "vitest";

import {
  indexTrackedUrls,
  isSaveLocked,
  isStarred,
  trackedItemForJob,
} from "./trackedUrls.js";

describe("trackedUrls", () => {
  it("indexes items and treats archived rows as not starred", () => {
    const map = indexTrackedUrls({
      urls: ["https://example.com/a", "https://example.com/b"],
      items: [
        {
          id: 1,
          ad_url: "https://example.com/a",
          status: "wishlist",
          archived: false,
        },
        {
          id: 2,
          ad_url: "https://example.com/b",
          status: "wishlist",
          archived: true,
        },
      ],
    });
    expect(isStarred(map.get("https://example.com/a"))).toBe(true);
    expect(isStarred(map.get("https://example.com/b"))).toBe(false);
    expect(isSaveLocked(map.get("https://example.com/a"))).toBe(false);
  });

  it("locks applied jobs so the star cannot archive the pipeline", () => {
    const item = { id: 9, status: "applied", archived: false };
    expect(isStarred(item)).toBe(true);
    expect(isSaveLocked(item)).toBe(true);
  });

  it("falls back to urls when items are missing", () => {
    const map = indexTrackedUrls({ urls: ["https://example.com/a"] });
    const item = trackedItemForJob(map, { webpage_url: "https://example.com/a" });
    expect(isStarred(item)).toBe(true);
    expect(isSaveLocked(item)).toBe(true);
  });
});
