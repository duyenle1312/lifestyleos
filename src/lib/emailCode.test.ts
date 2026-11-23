import { describe, expect, it } from "vitest";
import { EMAIL_CODE_LENGTH, isCompleteEmailCode, sanitizeEmailCode } from "./emailCode";

describe("sanitizeEmailCode", () => {
  it("keeps plain digits", () => expect(sanitizeEmailCode("123456")).toBe("123456"));
  it("strips spaces and dashes from pasted codes", () => {
    expect(sanitizeEmailCode("123 456")).toBe("123456");
    expect(sanitizeEmailCode(" 123-456 ")).toBe("123456");
  });
  it("drops letters", () => expect(sanitizeEmailCode("12a3b4")).toBe("1234"));
  it("truncates to the code length", () => expect(sanitizeEmailCode("12345678")).toBe("123456"));
  it("returns empty for no digits", () => expect(sanitizeEmailCode("abc")).toBe(""));
});

describe("isCompleteEmailCode", () => {
  it("is 6", () => expect(EMAIL_CODE_LENGTH).toBe(6));
  it("accepts exactly 6 digits", () => expect(isCompleteEmailCode("123456")).toBe(true));
  it("rejects short or non-digit codes", () => {
    expect(isCompleteEmailCode("12345")).toBe(false);
    expect(isCompleteEmailCode("12345a")).toBe(false);
  });
});
