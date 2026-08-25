import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth.js", () => ({
  getAccess: vi.fn(),
  refreshAccess: vi.fn(),
  clearTokens: vi.fn(),
}));

import { getAccess, refreshAccess, clearTokens } from "./auth.js";
import { ApiError, request } from "./api.js";

describe("request auth refresh", () => {
  beforeEach(() => {
    vi.mocked(getAccess).mockReturnValue("expired-access");
    vi.mocked(refreshAccess).mockReset();
    vi.mocked(clearTokens).mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries after a successful refresh", async () => {
    vi.mocked(refreshAccess).mockResolvedValue({
      ok: true,
      access: "fresh-access",
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 401 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ id: 1 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          })
        )
    );

    const data = await request("/api/v1/me/");
    expect(data).toEqual({ id: 1 });
    expect(clearTokens).not.toHaveBeenCalled();
  });

  it("does not expire the session on a transient refresh failure", async () => {
    vi.mocked(refreshAccess).mockResolvedValue({
      ok: false,
      reason: "transient",
    });
    const expired = vi.fn();
    window.addEventListener("auth-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 }))
    );

    await expect(request("/api/v1/applications/1/", { method: "PATCH" })).rejects.toThrow(
      ApiError
    );
    expect(expired).not.toHaveBeenCalled();
    expect(clearTokens).not.toHaveBeenCalled();
    window.removeEventListener("auth-expired", expired);
  });

  it("expires the session when the refresh token is dead", async () => {
    vi.mocked(refreshAccess).mockResolvedValue({
      ok: false,
      reason: "expired",
    });
    const expired = vi.fn();
    window.addEventListener("auth-expired", expired);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 }))
    );

    await expect(request("/api/v1/me/")).rejects.toMatchObject({ status: 401 });
    expect(clearTokens).toHaveBeenCalled();
    expect(expired).toHaveBeenCalled();
    window.removeEventListener("auth-expired", expired);
  });
});
