import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MatchScore, { shrinkageScoreLabel } from "./MatchScore.jsx";

describe("shrinkageScoreLabel", () => {
  it("explains must-requirement shrinkage", () => {
    expect(shrinkageScoreLabel(6, 6)).toBe(
      "Nedjusterad för korta kravlistor — 6 av 6 krav träffade"
    );
  });

  it("returns null when there is no denominator", () => {
    expect(shrinkageScoreLabel(0, 0)).toBeNull();
  });

  it("explains merit-only shrinkage", () => {
    expect(shrinkageScoreLabel(2, 3, { kind: "meriterande" })).toBe(
      "Nedjusterad för korta listor — 2 av 3 meriterande träffade"
    );
  });
});

describe("MatchScore merit-only postings", () => {
  it("labels and explains merit-only scores instead of 0 av 0 krav", () => {
    render(
      <MatchScore
        match={{
          must_total: 0,
          must_covered: 0,
          merit_total: 3,
          merit_covered: 2,
          score: 40,
          band: "medium",
          confidence: "high",
          gaps: [],
          covered: [],
        }}
      />
    );

    expect(screen.getByText("2 av 3 meriterande")).toBeInTheDocument();
    expect(screen.queryByText("0 av 0 krav")).not.toBeInTheDocument();
    const pct = screen.getByText("40%");
    expect(pct).toHaveAttribute(
      "title",
      "Nedjusterad för korta listor — 2 av 3 meriterande träffade"
    );
    expect(pct).toHaveAttribute(
      "aria-label",
      "Nedjusterad för korta listor — 2 av 3 meriterande träffade"
    );
  });

  it("does not render a percentage when there are no must or merit totals", () => {
    const { container } = render(
      <MatchScore
        match={{
          must_total: 0,
          must_covered: 0,
          merit_total: 0,
          merit_covered: 0,
          score: null,
          band: "unknown",
          confidence: "low",
          gaps: [],
          covered: [],
        }}
      />
    );

    expect(container.querySelector(".match-score-pct")).toBeNull();
    expect(container.textContent || "").not.toMatch(/\d+\s*%/);
  });
});
