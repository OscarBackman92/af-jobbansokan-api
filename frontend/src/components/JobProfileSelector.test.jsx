import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import JobProfileSelector from "./JobProfileSelector.jsx";

describe("JobProfileSelector", () => {
  it("renders a sliding pill indicator on the active profile", () => {
    render(
      <JobProfileSelector
        profiles={[
          { id: "a", label: "IT-support" },
          { id: "b", label: "Ekonomi" },
        ]}
        activeId="b"
        onSelect={vi.fn()}
        onAdd={vi.fn()}
        onRename={vi.fn()}
      />
    );

    expect(document.querySelector(".pill-indicator")).toBeInTheDocument();
    expect(screen.getByRole("tablist")).toHaveClass("pill-bar");
    expect(screen.getByRole("tab", { name: "Ekonomi" })).toHaveClass("active");
  });
});
