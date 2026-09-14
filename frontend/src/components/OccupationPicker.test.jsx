import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { request } from "../api.js";
import OccupationPicker from "./OccupationPicker.jsx";

vi.mock("../api.js", () => ({
  request: vi.fn(() =>
    Promise.resolve({
      results: [{ id: "KVVN_sqH_Wpz", label: "Inköpare" }],
    })
  ),
}));

describe("OccupationPicker", () => {
  it("searches from the seeded title and saves the chosen taxonomy concept", async () => {
    const onChange = vi.fn();
    render(
      <OccupationPicker
        label=""
        ariaLabel="Yrke för Junior Inköpare"
        value="Junior Inköpare"
        autoOpen
        onChange={onChange}
      />
    );

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        "/api/v1/jobs/occupations/?q=Junior%20Ink%C3%B6pare"
      );
    });
    fireEvent.click(await screen.findByRole("button", { name: "Inköpare" }));
    expect(onChange).toHaveBeenCalledWith({
      occupation_label: "Inköpare",
      occupation_concept_id: "KVVN_sqH_Wpz",
    });
  });
});
