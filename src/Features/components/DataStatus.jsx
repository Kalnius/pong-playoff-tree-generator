import React from "react";
import { useRevalidator, useRouteError } from "react-router";

export function DataLoading() {
  return (
    <div className="status-panel" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      Loading data...
    </div>
  );
}

export function DataError() {
  const error = useRouteError();
  const revalidator = useRevalidator();
  const isRetrying = revalidator.state === "loading";

  return (
    <div className="status-panel error-panel" role="alert">
      <div>
        <strong>Could not load data.</strong>{" "}
        {error instanceof Error ? error.message : "Unknown error."}
      </div>
      <button onClick={() => revalidator.revalidate()} disabled={isRetrying}>
        {isRetrying ? "Retrying..." : "Retry"}
      </button>
    </div>
  );
}
