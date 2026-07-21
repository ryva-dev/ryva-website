import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./design/tokens.css";
import "./styles.css";
import "./design-system/components.css";
import "./redesign/shell/shell.css";
import "./redesign/register/register.css";
import "./redesign/relationship/relationship.css";

const root = document.getElementById("root");
if (!root) throw new Error("Ryva Pro root element was not found.");
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
