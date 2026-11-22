import { describe, expect, it } from "vitest";
import { isRetryable } from "./remote";
import { normalizeThrown, toRemoteError, unwrap } from "./remoteErrors";

describe("toRemoteError", () => {
  it("keeps code and status for server errors", () => {
    const e = toRemoteError({ code: "23505", message: "dup" }, 409);
    expect(e).toMatchObject({ code: "23505", status: 409, message: "dup" });
    expect(isRetryable(e)).toBe(false);
  });
  it("marks 5xx and JWT errors retryable", () => {
    expect(isRetryable(toRemoteError({ code: "XX000", message: "boom" }, 503))).toBe(true);
    expect(isRetryable(toRemoteError({ code: "PGRST301", message: "jwt" }, 401))).toBe(true);
  });
  it("maps status 0 / missing code to a retryable network error", () => {
    const a = toRemoteError({ message: "TypeError: Failed to fetch" }, 0);
    const b = toRemoteError({ code: "", message: "Failed to fetch" });
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);
    expect(isRetryable(a) && isRetryable(b)).toBe(true);
  });
  it("does not treat an error with a code and status as network", () => {
    expect(toRemoteError({ code: "42501", message: "rls" }, 403).status).toBe(403);
  });
});

describe("unwrap / normalizeThrown", () => {
  it("throws only when there is an error", () => {
    expect(() => unwrap({ error: null, status: 200 })).not.toThrow();
    expect(() => unwrap({ error: { code: "42501", message: "rls" }, status: 403 })).toThrow(/rls/);
  });
  it("turns a thrown fetch TypeError into a retryable RemoteError", () => {
    const e = normalizeThrown(new TypeError("Failed to fetch"));
    expect(e.status).toBe(0);
    expect(isRetryable(e)).toBe(true);
  });
});
