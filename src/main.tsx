import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { blockMediaSaving } from "@/lib/noSave";

blockMediaSaving();

createRoot(document.getElementById("root")!).render(<App />);
