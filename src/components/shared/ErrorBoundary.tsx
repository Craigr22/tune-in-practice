import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Shown in the fallback so the student/teacher knows what failed. */
  label?: string;
  /** Render something custom instead of the default card. */
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Stops one broken component from taking down the whole app.
 *
 * React unmounts the entire tree when a render throws, so without a boundary
 * any single bug is a white screen. Wrap the app shell (so navigation always
 * survives) and any section that renders data we don't fully control.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the stack in the console for debugging; no telemetry service here yet.
    console.error(`[error-boundary${this.props.label ? `: ${this.props.label}` : ""}]`, error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div
        className="rounded-2xl p-6 my-4 mx-auto max-w-lg text-center"
        style={{ background: "var(--card)", border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}
        role="alert"
      >
        <div className="text-3xl" aria-hidden>🎸</div>
        <h2 className="mt-2 font-bold text-lg" style={{ color: "var(--ink)" }}>
          {this.props.label ? `${this.props.label} hit a snag` : "Something went wrong"}
        </h2>
        <p className="mt-1 text-sm" style={{ color: "var(--ink-soft)" }}>
          The rest of the app is still working. Try again, or head back and come at it fresh.
        </p>
        <div className="mt-4 flex gap-2 justify-center">
          <button
            onClick={this.reset}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--navy)", color: "#fff" }}
          >
            Try again
          </button>
          <button
            onClick={() => { window.location.href = "/"; }}
            className="rounded-xl px-4 py-2 text-sm font-semibold"
            style={{ background: "var(--paper-cool)", color: "var(--ink)", border: "1px solid var(--border-strong)" }}
          >
            Back to start
          </button>
        </div>
        <details className="mt-4 text-left">
          <summary className="text-[11px] uppercase tracking-wider cursor-pointer" style={{ color: "var(--ink-faint)" }}>
            Technical details
          </summary>
          <pre className="mt-2 text-[11px] whitespace-pre-wrap break-words" style={{ color: "var(--ink-soft)" }}>
            {error.message}
          </pre>
        </details>
      </div>
    );
  }
}
