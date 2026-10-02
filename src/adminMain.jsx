import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

async function start() {
  if (import.meta.env.DEV) {
    const { worker } = await import("./Data/localJsonBinMock");
    await worker.start({
      onUnhandledRequest: "bypass",
      serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` }
    });
  }

  const { default: AdminApp } = await import("./AdminApp");
  createRoot(document.getElementById("root")).render(<AdminApp />);
}

start();
