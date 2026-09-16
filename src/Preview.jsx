import React from "react";
import { Link, useLoaderData } from "react-router";
import {
  readSharedSnapshot,
  readSnapshot,
  sanitizeSnapshot,
  propagateWinners
} from "./Admin";

export function previewLoader({ request }) {
  const url = new URL(request.url);
  const storageKey =
    url.searchParams.get("storageKey") || "playoff-form-state-v2";
  const snapshot =
    readSharedSnapshot() || readSnapshot(storageKey) || sanitizeSnapshot(null);
  const tournament = snapshot.tournament
    ? propagateWinners({ ...snapshot.tournament, groups: snapshot.groups })
    : null;

  return {
    ...snapshot,
    tournament
  };
}

export default function Preview() {
  const data = useLoaderData() || {};
  const { tournament, groups } = data;

  const groupedMatches = React.useMemo(() => {
    if (!tournament?.matches) return {};
    return tournament.matches.reduce((acc, match) => {
      acc[match.round] = acc[match.round] || [];
      acc[match.round].push(match);
      return acc;
    }, {});
  }, [tournament]);

  return (
    <div className="container embed-mode">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16
        }}
      >
        <h2>Playoff Bracket Preview</h2>
        <Link
          to="/admin"
          style={{
            color: "#0052cc",
            textDecoration: "none",
            fontWeight: "bold"
          }}
        >
          Go to Admin &rarr;
        </Link>
      </div>

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
          No tournament generated yet. Head to the{" "}
          <Link to="/admin">Admin</Link> page to configure and generate the
          bracket.
        </div>
      )}
    </div>
  );
}
