import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { request } from "../api.js";
import ReportPanel, { selectPeriodKey } from "./ReportPanel.jsx";

vi.mock("../api.js", () => ({
  request: vi.fn(() =>
    Promise.resolve({
      jobs: [],
      events: [],
      activities: [],
      excluded_jobs: [],
      missing_occupation_count: 0,
      label: "Augusti 2026",
      status: "pagaende",
      window_closes: "2026-09-14",
    })
  ),
  downloadBlob: vi.fn(),
}));

const PERIODS = [
  { key: "2026-06", label: "Juni 2026", status: "forsenad", job_count: 10 },
  { key: "2026-08", label: "Augusti 2026", status: "pagaende", job_count: 20 },
];

describe("selectPeriodKey", () => {
  it("uses the latest period when nothing is selected yet", () => {
    expect(selectPeriodKey(PERIODS, "", "")).toBe("2026-08");
  });

  it("keeps a stored selection over the latest period", () => {
    expect(selectPeriodKey(PERIODS, "2026-06", "")).toBe("2026-06");
  });

  it("falls back to the URL month when state is still empty", () => {
    expect(selectPeriodKey(PERIODS, "", "2026-06")).toBe("2026-06");
  });

  it("returns empty when there are no periods", () => {
    expect(selectPeriodKey([], "", "")).toBe("");
  });
});

describe("ReportPanel", () => {
  it("selects a period when the list arrives after the first render", async () => {
    const { rerender } = render(
      <ReportPanel token="t" periods={[]} onPeriodsReload={vi.fn()} />
    );
    expect(
      screen.getByText(/inga sökta perioder ännu/i)
    ).toBeInTheDocument();

    rerender(
      <ReportPanel token="t" periods={PERIODS} onPeriodsReload={vi.fn()} />
    );

    expect(
      screen.queryByText(/inga sökta perioder ännu/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: /rapportperioder/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", { name: /augusti 2026/i })
    ).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => {
      expect(request).toHaveBeenCalledWith("/api/v1/periods/2026-08/");
    });
  });
});
