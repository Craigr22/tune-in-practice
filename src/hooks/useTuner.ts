// The autocorrelation pitch-detection logic and mic/cents-meter UI live in
// `src/components/Tuner.tsx` as a self-contained component. This module
// re-exports it so the routing layer can mount the tuner under
// `/student/tuner` while preserving the original behaviour.
export { default as Tuner } from "@/components/Tuner";
