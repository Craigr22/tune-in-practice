import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import ErrorBoundary from "@/components/shared/ErrorBoundary";

function Boom(): JSX.Element {
  throw new Error("kaboom");
}

/** React logs caught errors to console.error; silence it for these tests. */
function quietConsole() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ErrorBoundary", () => {
  it("shows a fallback instead of unmounting the tree", () => {
    const spy = quietConsole();
    render(
      <ErrorBoundary label="This page">
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText(/hit a snag/i)).toBeTruthy();
    spy.mockRestore();
  });

  it("keeps siblings outside the boundary alive", () => {
    const spy = quietConsole();
    render(
      <div>
        <nav>Navigation</nav>
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      </div>,
    );
    // The whole point: navigation survives a broken page.
    expect(screen.getByText("Navigation")).toBeTruthy();
    spy.mockRestore();
  });

  it("renders a custom fallback when given one", () => {
    const spy = quietConsole();
    render(
      <ErrorBoundary fallback={<span>quiet failure</span>}>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("quiet failure")).toBeTruthy();
    spy.mockRestore();
  });

  it("recovers when the child stops throwing and Try again is pressed", () => {
    const spy = quietConsole();
    let shouldThrow = true;
    const Flaky = () => {
      if (shouldThrow) throw new Error("kaboom");
      return <span>recovered</span>;
    };
    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeTruthy();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(screen.getByText("recovered")).toBeTruthy();
    spy.mockRestore();
  });

  it("passes children through untouched when nothing throws", () => {
    render(
      <ErrorBoundary>
        <span>all good</span>
      </ErrorBoundary>,
    );
    expect(screen.getByText("all good")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
