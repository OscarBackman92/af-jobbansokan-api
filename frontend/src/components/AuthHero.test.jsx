import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AuthHero from "./AuthHero.jsx";

vi.mock("../api.js", () => ({
  request: vi.fn(),
}));

describe("AuthHero", () => {
  it("renders the login form by default", () => {
    render(<AuthHero onLogin={vi.fn()} />);

    expect(screen.getByRole("heading", { name: /logga in/i })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: /jobbdjungeln/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /startsidan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/e-postadress/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /logga in/i })).toBeInTheDocument();
  });

  it("switches to create-account and forgot-password from login", () => {
    render(<AuthHero onLogin={vi.fn()} />);

    fireEvent.click(
      screen.getByRole("button", { name: "Ny här? Skapa ett konto" })
    );
    expect(screen.getByRole("heading", { name: "Skapa konto" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Skapa konto" })
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Har du redan ett konto? Logga in" })
    );
    fireEvent.click(screen.getByRole("button", { name: "Glömt lösenord?" }));
    expect(screen.getByRole("heading", { name: /glömt lösenord/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^lösenord$/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /skicka återställningslänk/i })
    ).toBeInTheDocument();
  });
});
