import { describe, expect, it } from "vitest";

import {
  isSearchDraftPending,
  matchScanCaption,
  pendingCountCaption,
} from "./jobSearchQuery.js";

describe("matchScanCaption", () => {
  it("tells the truth when only the newest ads were scored", () => {
    const upstream = (8551).toLocaleString("sv-SE");
    expect(
      matchScanCaption({
        showingFrom: 1,
        showingTo: 25,
        matchTotal: 28,
        scanned: 35,
        upstreamTotal: 8551,
      })
    ).toBe(
      `Visar 1–25 av 28 som når filtret — matchat mot de 35 nyaste av ${upstream} träffar`
    );
  });

  it("does not claim a budget abort when the whole set was scored", () => {
    expect(
      matchScanCaption({
        showingFrom: 1,
        showingTo: 19,
        matchTotal: 19,
        scanned: 19,
        upstreamTotal: 19,
      })
    ).toBe("Visar 1–19 av 19 som når filtret — matchat mot 19 träffar");
  });
});

describe("isSearchDraftPending", () => {
  const applied = {
    q: "",
    municipalities: [],
    groups: [],
    remote: false,
    matchCv: false,
    minMatch60: false,
    hideBlocked: false,
  };

  it("is pending when the visible search text is not the applied query", () => {
    expect(
      isSearchDraftPending({ ...applied, q: "systemadministratör" }, applied)
    ).toBe(true);
  });

  it("is pending when a checkbox changed without Sök", () => {
    expect(
      isSearchDraftPending({ ...applied, minMatch60: true }, applied)
    ).toBe(true);
  });

  it("is not pending when draft matches the last search", () => {
    expect(isSearchDraftPending(applied, applied)).toBe(false);
  });
});

describe("pendingCountCaption", () => {
  it("never attributes the previous hit count to the typed query", () => {
    expect(pendingCountCaption("systemadministratör", "")).toBe(
      "Träffarna gäller inte “systemadministratör” ännu — klicka Sök."
    );
  });
});
