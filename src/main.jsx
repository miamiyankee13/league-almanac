import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import "./terminal.css";

let storedTheme = null;
try {
  storedTheme = localStorage.getItem("league-almanac.theme");
} catch {
  // Fall back to the Almanac's default dark theme.
}

document.documentElement.dataset.theme =
  storedTheme === "light" ? "light" : "dark";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
