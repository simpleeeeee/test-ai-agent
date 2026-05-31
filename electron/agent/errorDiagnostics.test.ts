import { describe, expect, it } from "vitest";
import { diagnoseError, NETWORK_ERRORS, THIRD_PARTY_ERRORS } from "./errorDiagnostics.js";

describe("NETWORK_ERRORS", () => {
  it("all entries have Chinese messages", () => {
    for (const [key, entry] of Object.entries(NETWORK_ERRORS)) {
      expect(
        entry.message,
        `${key}: message should contain Chinese characters`,
      ).toMatch(/[一-鿿]/);
      expect(
        entry.suggestion,
        `${key}: suggestion should contain Chinese characters`,
      ).toMatch(/[一-鿿]/);
    }
  });

  it("covers all required error codes", () => {
    const required = [
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ECONNRESET",
      "TIMEOUT",
      "401",
      "403",
      "429",
      "500",
      "502",
      "503",
    ];
    for (const code of required) {
      expect(
        NETWORK_ERRORS[code],
        `Missing NETWORK_ERRORS entry for: ${code}`,
      ).toBeDefined();
    }
  });

  it("every entry has a retryable boolean", () => {
    for (const [key, entry] of Object.entries(NETWORK_ERRORS)) {
      expect(
        typeof entry.retryable,
        `${key}: retryable should be boolean`,
      ).toBe("boolean");
    }
  });
});

describe("THIRD_PARTY_ERRORS", () => {
  it("all entries have Chinese messages", () => {
    for (const [key, entry] of Object.entries(THIRD_PARTY_ERRORS)) {
      expect(
        entry.message,
        `${key}: message should contain Chinese characters`,
      ).toMatch(/[一-鿿]/);
      expect(
        entry.suggestion,
        `${key}: suggestion should contain Chinese characters`,
      ).toMatch(/[一-鿿]/);
    }
  });

  it("covers all required third-party error codes", () => {
    const required = [
      "insufficient_balance",
      "model_not_found",
      "model_overloaded",
      "context_length_exceeded",
      "rate_limit_exceeded",
      "invalid_api_key",
      "api_key_expired",
      "content_filtered",
    ];
    for (const code of required) {
      expect(
        THIRD_PARTY_ERRORS[code],
        `Missing THIRD_PARTY_ERRORS entry for: ${code}`,
      ).toBeDefined();
    }
  });

  it("every entry has a retryable boolean", () => {
    for (const [key, entry] of Object.entries(THIRD_PARTY_ERRORS)) {
      expect(
        typeof entry.retryable,
        `${key}: retryable should be boolean`,
      ).toBe("boolean");
    }
  });
});

describe("diagnoseError", () => {
  it("matches by code property → ENOTFOUND", () => {
    const result = diagnoseError({ code: "ENOTFOUND" });
    expect(result.message).toBe(NETWORK_ERRORS.ENOTFOUND.message);
    expect(result.suggestion).toBe(NETWORK_ERRORS.ENOTFOUND.suggestion);
    expect(result.retryable).toBe(NETWORK_ERRORS.ENOTFOUND.retryable);
  });

  it("matches HTTP 401 from message → API Key 无效或已过期", () => {
    const result = diagnoseError({ message: "status code 401" });
    expect(result.message).toContain("API Key 无效或已过期");
    expect(result.retryable).toBe(false);
  });

  it("matches third-party code model_not_found → 模型不可用", () => {
    const result = diagnoseError({ code: "model_not_found" });
    expect(result.message).toContain("模型不可用");
    expect(result.retryable).toBe(false);
  });

  it("falls back to generic for unknown error, does NOT expose raw English text", () => {
    const result = diagnoseError({
      code: "SOME_NEW_ERROR",
      message: "Something happened",
    });
    expect(result.message).toContain("未知错误");
    expect(result.message).not.toMatch(/Something happened/i);
    expect(result.message).not.toMatch(/SOME_NEW_ERROR/i);
    expect(result.retryable).toBe(false);
  });

  it("matches HTTP 429 from message", () => {
    const result = diagnoseError({ message: "Request failed with status code 429" });
    // 消息应为中文
    expect(result.message).toMatch(/[一-鿿]/);
    // 429 应该可重试
    expect(result.retryable).toBe(true);
  });

  it("matches HTTP 503 from message", () => {
    const result = diagnoseError({ message: "status code 503" });
    expect(result.message).toMatch(/[一-鿿]/);
    expect(result.retryable).toBe(NETWORK_ERRORS["503"].retryable);
  });

  it("handles non-object input gracefully", () => {
    const result = diagnoseError("just a string");
    expect(result.message).toContain("未知错误");
    expect(result.suggestion).toContain("日志");
  });

  it("handles null/undefined gracefully", () => {
    const result1 = diagnoseError(null);
    expect(result1.message).toContain("未知错误");

    const result2 = diagnoseError(undefined);
    expect(result2.message).toContain("未知错误");
  });

  it("handles error with empty object", () => {
    const result = diagnoseError({});
    expect(result.message).toContain("未知错误");
  });

  it("matches THIRD_PARTY_ERRORS code even when message is also present", () => {
    const result = diagnoseError({
      code: "rate_limit_exceeded",
      message: "status code 429",
    });
    // code 匹配优先，应返回 third-party 消息而非 HTTP 消息
    expect(result.message).toContain("频率");
    expect(result.retryable).toBe(true);
  });
});
