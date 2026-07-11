import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuthHero from "./AuthHero.jsx";

vi.mock("../api.js", () => ({
  request: vi.fn(),
}));

describe("AuthHero", () => {
  it("renders the login form by default", () => {
    render(<AuthHero onLogin={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /logga in/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /startsidan/i })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByLabelText(/e-postadress/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logga in/i })).toBeInTheDocument();
  });
});
