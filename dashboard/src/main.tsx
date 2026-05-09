import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import Router from "./Router";

const root = document.getElementById("root");
if (!root) throw new Error("No #root element found");
createRoot(root).render(
  <StrictMode>
    <Router />
  </StrictMode>
);
