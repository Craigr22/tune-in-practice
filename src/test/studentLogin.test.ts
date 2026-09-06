import { describe, it, expect } from "vitest";
import { toUsername, loginCandidates, toLoginEmail, STUDENT_EMAIL_DOMAIN } from "@/lib/studentLogin";

/**
 * What a student types, and what the app tries to sign them in with.
 *
 * Students are children with no email address. They are given a username, and
 * they mistype it, or type their name, or type the address off their record —
 * which is a field an admin filled in and which no account answers to.
 */

const d = `@${STUDENT_EMAIL_DOMAIN}`;

describe("toUsername", () => {
  it("makes the same username the provisioning function makes", () => {
    expect(toUsername("Payal Malviya")).toBe("payal.malviya");
    expect(toUsername("Renuka")).toBe("renuka");
  });

  it("drops accents rather than leaving them in", () => {
    expect(toUsername("José Ramírez")).toBe("jose.ramirez");
  });

  it("treats every kind of separator alike", () => {
    for (const typed of ["Payal Malviya", "payal_malviya", "payal-malviya", "Payal  Malviya "]) {
      expect(toUsername(typed)).toBe("payal.malviya");
    }
  });
});

describe("loginCandidates", () => {
  it("turns a username into the account's address", () => {
    expect(loginCandidates("payal.malviya")).toEqual([`payal.malviya${d}`]);
  });

  it("gets a child in who types their own name", () => {
    expect(loginCandidates("Payal Malviya")).toEqual([`payal.malviya${d}`]);
  });

  it("tries a real address first, then as a username", () => {
    // Their record's email column was handed out in place of the username.
    expect(loginCandidates("payal.malviya@bam.test")).toEqual([
      "payal.malviya@bam.test",
      `payal.malviya${d}`,
    ]);
  });

  it("does not try the same address twice", () => {
    expect(loginCandidates(`payal.malviya${d}`)).toEqual([`payal.malviya${d}`]);
  });

  it("leaves a teacher's own address alone", () => {
    const teacher = loginCandidates("Jason@BAM.test");
    expect(teacher[0]).toBe("jason@bam.test");
  });

  it("has nothing to try for an empty box", () => {
    expect(loginCandidates("   ")).toEqual([]);
    expect(loginCandidates("@@@")).toEqual([]);
  });
});

describe("toLoginEmail", () => {
  it("is the first thing to try", () => {
    expect(toLoginEmail("Payal Malviya")).toBe(`payal.malviya${d}`);
    expect(toLoginEmail("jason@bam.test")).toBe("jason@bam.test");
  });
});
