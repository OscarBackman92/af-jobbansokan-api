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
});
