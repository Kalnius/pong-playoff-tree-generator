import React from "react";
import { useLoaderData } from "react-router";
import { getData } from "../Data/JsonBinDataClient";
import PlayoffRounds from "./components/PlayoffRounds";
import StandingsList from "./components/StandingsList";

export function previewLoader() {
  return getData();
}

export default function Preview() {
  const data = useLoaderData();
  const tournament = data?.tournament;
  const groups = data?.groups;

  return (
    <div className="container">
      {tournament ? (
        <div className="playoff-section-wrapper">
          <div className="playoff-content-layout">
            <StandingsList
              groups={tournament.groups || groups}
              matches={tournament.matches}
            />
            <div className="playoff-main-column">
              <div className="playoff-heading">
                <h3>Playoff</h3>
              </div>
              <PlayoffRounds tournament={tournament} readOnly />
            </div>
          </div>
        </div>
      ) : (
        <div className="info-panel">No playoff tree generated yet.</div>
      )}
    </div>
  );
}
