import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../adUrl.js", async () => {
  const actual = await vi.importActual("../adUrl.js");
  return {
    ...actual,
    openBehind: vi.fn(() => true),
  };
});

import { openBehind } from "../adUrl.js";
import ExternalApplyLink from "./ExternalApplyLink.jsx";

describe("ExternalApplyLink", () => {
  afterEach(() => {
    vi.mocked(openBehind).mockClear();
  });
  it("opens ordinary clicks behind this window", () => {
    render(
      <ExternalApplyLink href="https://example.com/ansok" className="btn-primary">
        Ansök ↗
      </ExternalApplyLink>
    );
    fireEvent.click(screen.getByRole("link", { name: "Ansök ↗" }));
    expect(openBehind).toHaveBeenCalledWith("https://example.com/ansok");
  });

  it("does not hijack modified clicks", () => {
    render(
      <ExternalApplyLink href="https://example.com/ansok">Ansök ↗</ExternalApplyLink>
    );
    fireEvent.click(screen.getByRole("link", { name: "Ansök ↗" }), {
      ctrlKey: true,
    });
    expect(openBehind).not.toHaveBeenCalled();
  });
});
