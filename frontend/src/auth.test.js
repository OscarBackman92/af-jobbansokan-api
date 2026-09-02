import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearTokens,
  getAccess,
  getRefresh,
  logout,
  refreshAccess,
  setTokens,
} from "./auth.js";

describe("auth storage", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persists tokens in localStorage and migrates sessionStorage", () => {
    sessionStorage.setItem("token", "access-from-tab");
    sessionStorage.setItem("refresh", "refresh-from-tab");

    expect(getAccess()).toBe("access-from-tab");
    expect(getRefresh()).toBe("refresh-from-tab");
    expect(localStorage.getItem("token")).toBe("access-from-tab");
    expect(sessionStorage.getItem("token")).toBeNull();

    setTokens({ access: "new-access", refresh: "new-refresh" });
    expect(localStorage.getItem("token")).toBe("new-access");
    expect(localStorage.getItem("refresh")).toBe("new-refresh");
  });

  it("keeps tokens when refresh fetch is aborted", async () => {
    setTokens({ access: "old-access", refresh: "old-refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new DOMException("Aborted", "AbortError")))
    );

    const result = await refreshAccess();
    expect(result).toEqual({ ok: false, reason: "transient" });
    expect(getAccess()).toBe("old-access");
    expect(getRefresh()).toBe("old-refresh");
  });

  it("keeps tokens on 429 from the refresh endpoint", async () => {
    setTokens({ access: "old-access", refresh: "old-refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response("{}", { status: 429 })))
    );

    const result = await refreshAccess();
    expect(result).toEqual({ ok: false, reason: "transient" });
    expect(getRefresh()).toBe("old-refresh");
  });

  it("clears tokens when the refresh token is rejected", async () => {
    setTokens({ access: "old-access", refresh: "old-refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(JSON.stringify({ detail: "invalid" }), { status: 401 })
        )
      )
    );

    const result = await refreshAccess();
    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it("stores rotated tokens on success", async () => {
    setTokens({ access: "old-access", refresh: "old-refresh" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({ access: "new-access", refresh: "new-refresh" }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
        )
      )
    );

    const result = await refreshAccess();
    expect(result).toEqual({ ok: true, access: "new-access" });
    expect(getAccess()).toBe("new-access");
    expect(getRefresh()).toBe("new-refresh");
  });

  it("posts the refresh token on logout and clears storage", async () => {
    setTokens({ access: "access-token", refresh: "refresh-token" });
    const fetchMock = vi.fn(() =>
      Promise.resolve(new Response("{}", { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith(
      "/dj-rest-auth/logout/",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer access-token",
        },
        body: JSON.stringify({ refresh: "refresh-token" }),
      })
    );
    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });

  it("clears tokens even when logout fetch is rejected", async () => {
    setTokens({ access: "access-token", refresh: "refresh-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("network")))
    );

    await logout();

    expect(getAccess()).toBeNull();
    expect(getRefresh()).toBeNull();
  });
});
