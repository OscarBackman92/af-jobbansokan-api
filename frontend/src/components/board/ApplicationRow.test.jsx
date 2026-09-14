import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ApplicationRow from "./ApplicationRow.jsx";

const application = {
  id: "1",
  title: "QA-ingenjör",
  company: "Test AB",
  location: "Stockholm",
  applied_at: "2026-09-01",
  status: "applied",
  status_label: "Ansökt",
};

describe("ApplicationRow", () => {
  it("keeps the primary action and overflow menu available", () => {
    render(
      <ApplicationRow
        application={application}
        onOpen={vi.fn()}
        onMove={vi.fn()}
        primaryAction={{ label: "Följ upp", className: "small", onClick: vi.fn() }}
        overflowActions={[{ label: "Kalender", onClick: vi.fn() }]}
      />
    );

    expect(screen.getByRole("button", { name: "Följ upp" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fler åtgärder" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Byt steg")).toBeInTheDocument();
  });

  it("puts other statuses in the overflow menu for mobile", () => {
    const onMove = vi.fn();
    render(
      <ApplicationRow
        application={application}
        onOpen={vi.fn()}
        onMove={onMove}
        primaryAction={{ label: "Följ upp", className: "small", onClick: vi.fn() }}
        overflowActions={[{ label: "Kalender", onClick: vi.fn() }]}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Fler åtgärder" }));
    expect(screen.getByRole("menuitem", { name: "Kalender" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Intervju" }));
    expect(onMove).toHaveBeenCalledWith("interview");
  });

  it("opens the application when the card body is clicked", () => {
    const onOpen = vi.fn();
    render(
      <ApplicationRow
        application={application}
        onOpen={onOpen}
        onMove={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText("Stockholm · Sökt 2026-09-01"));
    expect(onOpen).toHaveBeenCalled();
  });

  it("shows company above the role so the list is easy to scan", () => {
    render(
      <ApplicationRow
        application={application}
        onOpen={vi.fn()}
        onMove={vi.fn()}
      />
    );
    expect(screen.getByText("Test AB")).toHaveClass("pipeline-row-company");
    expect(
      screen.queryByText("Test AB · Stockholm · Sökt 2026-09-01")
    ).not.toBeInTheDocument();
  });
});
