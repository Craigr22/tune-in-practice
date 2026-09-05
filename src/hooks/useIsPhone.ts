import { useEffect, useState } from "react";

/** Where the header collapses and the week grid stops being readable. */
export const PHONE_QUERY = "(max-width: 900px)";

/**
 * True on phone-width screens.
 *
 * Reactive rather than read once, so rotating a phone or resizing a window
 * switches the layout instead of leaving it in whichever mode it booted in.
 */
export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(
    () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(PHONE_QUERY);
    const onChange = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    setIsPhone(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return isPhone;
}
