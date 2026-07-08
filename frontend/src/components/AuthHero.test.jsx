import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuthHero from "./AuthHero.jsx";

vi.mock("../api.js", () => ({
  request: vi.fn(),
}));

describe("AuthHero", () => {
  it("renders the login form by default", () => {
    render(<AuthHero onLogin={vi.fn()} />);

    expect(screen.getByText(/välkommen/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ditt jobbsök/i })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /om jobbsöket/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/e-postadress/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logga in/i })).toBeInTheDocument();
  });
});
