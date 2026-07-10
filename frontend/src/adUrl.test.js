import { describe, expect, it } from "vitest";

import {
  findDuplicateByAdUrl,
  linkLabel,
  normalizeAdUrl,
  platsbankenJobId,
} from "./adUrl.js";

describe("normalizeAdUrl", () => {
  it("strips tracking params and trailing slashes", () => {
    expect(
      normalizeAdUrl(
        "http://Arbetsformedlingen.se/annonser/1/?utm_source=mail"
      )
    ).toBe("https://arbetsformedlingen.se/annonser/1");
  });

  it("treats http and https as the same", () => {
    const https = "https://example.com/jobb/42";
    const http = "http://example.com/jobb/42/";
    expect(normalizeAdUrl(https)).toBe(normalizeAdUrl(http));
  });
});

describe("platsbankenJobId", () => {
  it("extracts id from platsbanken urls", () => {
    expect(
      platsbankenJobId(
        "https://arbetsformedlingen.se/platsbanken/annonser/31258362"
      )
    ).toBe("31258362");
  });

  it("extracts id from legacy annons urls", () => {
    expect(platsbankenJobId("https://arbetsformedlingen.se/annons/1001")).toBe(
      "1001"
    );
  });
});

describe("linkLabel", () => {
  it("shows hostname and path without tracking params", () => {
    expect(
      linkLabel(
        "https://tillvaxtverket.se/ledigajobb?rmjob=2046&utm_source=jobtip"
      )
    ).toBe("tillvaxtverket.se/ledigajobb");
  });
});

describe("findDuplicateByAdUrl", () => {
  const apps = [
    { id: 1, ad_url: "https://example.com/jobb/1" },
    { id: 2, ad_url: "https://other.com/jobb/2" },
  ];

  it("finds duplicates after normalization", () => {
    const match = findDuplicateByAdUrl(
      apps,
      "http://example.com/jobb/1/?utm_campaign=x"
    );
    expect(match?.id).toBe(1);
  });

  it("ignores the current application when editing", () => {
    const match = findDuplicateByAdUrl(
      apps,
      "https://example.com/jobb/1",
      1
    );
    expect(match).toBeNull();
  });
});
