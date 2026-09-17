import React from "react";
import { Link, useLoaderData } from "react-router";
import { getData } from "../Data/DataClient";

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
        <>
          <div className="summary-bar">
            <span>
              <strong>Players:</strong> {tournament.totalPlayers}
            </span>
            <span>
              <strong>Bracket size:</strong> {tournament.bracketSize}
            </span>
            <span>
              <strong>Auto-byes:</strong> {tournament.byeCount}
            </span>
          </div>

          <div className="rounds">
            {Object.keys(groupedMatches)
              .map(Number)
              .sort((a, b) => a - b)
              .map((round) => (
                <div className="round" key={round}>
                  <h4>
                    {groupedMatches[round][0]?.roundName || `Round ${round}`}
                  </h4>
                  {groupedMatches[round].map((match) => {
                    const isBye = Boolean(
                      (match.home && !match.away) || (!match.home && match.away)
                    );

                    return (
                      <div className="match" key={match.id}>
                        <div className="match-title">
                          {match.label} ({match.id})
                          {isBye ? (
                            <span className="bye-badge">BYE</span>
                          ) : null}
                        </div>
                        <div className="line">
                          <button
                            className={
                              match.winner === match.home ? "winner" : ""
                            }
                            disabled
                          >
                            {match.home || "TBD"}
                          </button>
                          <input
                            type="number"
                            value={match.scoreHome}
                            disabled
                            placeholder="0"
                            readOnly
                          />
                        </div>
                        <div className="line">
                          <button
                            className={
                              match.winner === match.away ? "winner" : ""
                            }
                            disabled
                          >
                            {match.away || "TBD"}
                          </button>
                          <input
                            type="number"
                            value={match.scoreAway}
                            disabled
                            placeholder="0"
                            readOnly
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </>
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
