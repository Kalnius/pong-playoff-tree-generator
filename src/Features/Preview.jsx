import React from "react";
import { Link, useLoaderData } from "react-router";
import { getData } from "../Data/DataClient";
import PlayoffMatch from "./components/PlayoffMatch";

export function previewLoader({ request }) {
  return getData({ url: request.url });
}

export default function Preview() {
  const data = useLoaderData();
  const tournament = data?.tournament;

  const groupedMatches = React.useMemo(() => {
    if (!tournament?.matches) return {};
    return tournament.matches.reduce((acc, match) => {
      acc[match.round] = acc[match.round] || [];
      acc[match.round].push(match);
      return acc;
    }, {});
  }, [tournament]);

  return (
    <div className="container">
      {tournament ? (
        <div className="rounds">
          {Object.keys(groupedMatches)
            .map(Number)
            .sort((a, b) => a - b)
            .map((round) => (
              <div className="round" key={round}>
                <h4>
                  {groupedMatches[round][0]?.roundName || `Round ${round}`}
                </h4>
                {groupedMatches[round].map((match) => (
                  <PlayoffMatch key={match.id} match={match} readOnly />
                ))}
              </div>
            ))}
        </div>
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
