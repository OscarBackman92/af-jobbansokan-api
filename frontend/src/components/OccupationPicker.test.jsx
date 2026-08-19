import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { request } from "../api.js";
import OccupationPicker from "./OccupationPicker.jsx";

vi.mock("../api.js", () => ({
  request: vi.fn(),
}));

describe("OccupationPicker", () => {
  beforeEach(() => {
    vi.mocked(request).mockReset();
  });

  it("opens suggestions with the same enter class as the filter panels", async () => {
    vi.mocked(request).mockResolvedValue({
      results: [{ id: "1", label: "Systemutvecklare" }],
    });

    render(<OccupationPicker onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/sök yrke/i), {
      target: { value: "sys" },
    });

    const list = await screen.findByRole("listbox");
    await waitFor(() => {
      expect(list).toHaveClass("occupation-picker-list--open");
    });
    expect(screen.getByRole("option", { name: "Systemutvecklare" })).toBeInTheDocument();
  });

  it("closes the list on Escape", async () => {
    vi.mocked(request).mockResolvedValue({
      results: [{ id: "1", label: "Systemutvecklare" }],
    });

    render(<OccupationPicker onChange={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/sök yrke/i), {
      target: { value: "sys" },
    });
    const list = await screen.findByRole("listbox");
    await waitFor(() => {
      expect(list).toHaveClass("occupation-picker-list--open");
    });

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(list).not.toHaveClass("occupation-picker-list--open");
    });
  });
});
