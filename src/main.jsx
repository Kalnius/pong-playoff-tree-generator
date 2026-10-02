import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

async function start() {
  if (import.meta.env.DEV) {
    const { worker } = await import("./Data/localJsonBinMock");
    await worker.start({ onUnhandledRequest: "bypass" });
  }

  const { default: App } = await import("./App");
  createRoot(document.getElementById("root")).render(<App />);
}

start();
