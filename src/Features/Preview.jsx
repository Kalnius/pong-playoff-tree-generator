import React from "react";
import { Link, useLoaderData } from "react-router";
import { getData } from "../Data/DataClient";
import PlayoffRounds from "./components/PlayoffRounds";

export function previewLoader({ request }) {
  return getData({ url: request.url });
}

export default function Preview() {
  const data = useLoaderData();
  const tournament = data?.tournament;

  return (
    <div className="container">
      {tournament ? (
        <PlayoffRounds tournament={tournament} readOnly />
      ) : (
        <div className="info-panel">
          No playoff tree generated yet. Head to the{" "}
          <Link to="/admin">Admin</Link> page to configure and generate the
          playoff tree first.
        </div>
      )}
    </div>
  );
}
