import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import { applyDesignTokens } from "./design-tokens";
import "./styles.css";

applyDesignTokens();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
