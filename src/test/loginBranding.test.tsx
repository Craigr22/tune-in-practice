import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/lib/db", () => ({ supabase: { auth: {} } }));

import Login from "@/pages/Login";

afterEach(cleanup);

describe("login page branding", () => {
  it("carries no course or semester label", () => {
    const { container } = render(<Login />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/sem\s*1/i);
    expect(text).not.toMatch(/ukulele/i);
  });

  it("still shows the BAM brand and the sign-in form", () => {
    const { container } = render(<Login />);
    // The brand lockup is now the dot and the wordmark, nothing else.
    expect(container.querySelector(".brand")!.textContent!.trim()).toBe("bam");
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeTruthy();
  });
});
