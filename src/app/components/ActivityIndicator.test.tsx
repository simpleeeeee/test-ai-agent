import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityIndicator } from "./ActivityIndicator";

describe("ActivityIndicator", () => {
  it("renders with default active state", () => {
    const { container } = render(<ActivityIndicator />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("activity-indicator");
    expect(dot).toHaveClass("active");
  });

  it("renders idle state", () => {
    const { container } = render(<ActivityIndicator status="idle" />);
    const dot = container.firstElementChild as HTMLElement;
    expect(dot).toHaveClass("idle");
    expect(dot).not.toHaveClass("active");
  });

  it("renders done state", () => {
    const { container } = render(<ActivityIndicator status="done" />);
    expect(container.firstElementChild).toHaveClass("done");
  });

  it("renders error state", () => {
    const { container } = render(<ActivityIndicator status="error" />);
    expect(container.firstElementChild).toHaveClass("error");
  });
});
