import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * Signing in, for people who were given the wrong thing to type.
 *
 * A student's record carries an email column an admin filled in; it has
 * nothing to do with the login, and it has been handed out in place of the
 * username. One retry recovers that, and the message says what to check.
 */

const signIn = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ supabase: { auth: { signInWithPassword: signIn } } }));

import Login from "@/pages/Login";

const bad = { code: "invalid_credentials", status: 400, message: "Invalid login credentials" };

const fillAndSubmit = (id: string) => {
  fireEvent.change(screen.getByLabelText(/username or email/i), { target: { value: id } });
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "uku-1234" } });
  fireEvent.click(screen.getByRole("button", { name: /^sign in$/i }));
};

beforeEach(() => signIn.mockReset());
afterEach(cleanup);

describe("signing in", () => {
  it("turns a typed name into the username's account", async () => {
    signIn.mockResolvedValue({ error: null });
    render(<Login />);

    fillAndSubmit("Payal Malviya");

    await waitFor(() => expect(signIn).toHaveBeenCalled());
    expect(signIn.mock.calls[0][0].email).toBe("payal.malviya@students.bam.invalid");
  });

  it("retries a record email as a username", async () => {
    signIn.mockResolvedValueOnce({ error: bad }).mockResolvedValueOnce({ error: null });
    render(<Login />);

    fillAndSubmit("payal.malviya@bam.test");

    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(2));
    expect(signIn.mock.calls[0][0].email).toBe("payal.malviya@bam.test");
    expect(signIn.mock.calls[1][0].email).toBe("payal.malviya@students.bam.invalid");
    expect(screen.queryByText(/doesn't match an account/i)).toBeNull();
  });

  it("stops after one attempt when the username itself is the identity", async () => {
    signIn.mockResolvedValue({ error: bad });
    render(<Login />);

    fillAndSubmit("payal.malviya");

    await waitFor(() => expect(screen.getByText(/doesn't match an account/i)).toBeTruthy());
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("does not hammer the server when the failure isn't the password", async () => {
    signIn.mockResolvedValue({ error: { status: 429, message: "Too many requests" } });
    render(<Login />);

    fillAndSubmit("payal.malviya@bam.test");

    // A rate limit means stop, not try again immediately.
    await waitFor(() => expect(screen.getByText(/too many requests/i)).toBeTruthy());
    expect(signIn).toHaveBeenCalledTimes(1);
  });

  it("explains what to type instead of 'invalid login credentials'", async () => {
    signIn.mockResolvedValue({ error: bad });
    render(<Login />);

    fillAndSubmit("payal.malviya");

    await waitFor(() => expect(screen.getByText(/students sign in with a username/i)).toBeTruthy());
    expect(screen.queryByText(/^invalid login credentials$/i)).toBeNull();
  });
});
