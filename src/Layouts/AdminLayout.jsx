import React from "react";
import { Link, Outlet, useLocation } from "react-router";

export default function AdminLayout() {
  const location = useLocation();
  const isPreview = location.pathname.startsWith("/preview");
  const searchParams = new URLSearchParams(location.search);
  const isEmbed =
    searchParams.get("embed") === "1" || searchParams.get("embed") === "true";

  if (isEmbed) {
    return <Outlet />;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}
      >
        <h2>
          {isPreview
            ? "Playoff Bracket Preview"
            : "Table Tennis Playoff Generator"}
        </h2>
        <Link
          to={isPreview ? "/admin" : "/preview"}
          style={{
            color: "#0052cc",
            textDecoration: "none",
            fontWeight: "bold"
          }}
        >
          {isPreview ? "Go to Admin \u2192" : "Go to Preview \u2192"}
        </Link>
      </div>
      <Outlet />
    </>
  );
}
