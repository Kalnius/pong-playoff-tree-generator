import React, { useMemo } from "react";
import "./StandingsList.css";

export function computeStandings(groups, matches) {
  if (!groups || !matches) return [];

  const totalPlayers = groups.reduce(
    (total, group) => total + (group.rankedPlayers?.length || 0),
    0
  );

  // Initialize standings array from place 1 to totalPlayers
  const standings = Array.from({ length: totalPlayers }, (_, i) => ({
    place: i + 1,
    player: ""
  }));

  const getWinner = (m) => {
    if (!m || !m.winner) return "";
    return m.winner;
  };

  const getLoser = (m) => {
    if (!m || !m.winner) return "";
    return m.winner === m.home ? m.away : m.home;
  };

  // Find placing matches
  matches.forEach((m) => {
    if (!m.winner) return;

    if (m.roundName === "Final" && m.label === "Final") {
      const winner = getWinner(m);
      const loser = getLoser(m);
      if (winner && standings[0]) standings[0].player = winner;
      if (loser && standings[1]) standings[1].player = loser;
    } else if (m.roundName === "Final" && m.label === "3rd Place") {
      const winner = getWinner(m);
      const loser = getLoser(m);
      if (winner && standings[2]) standings[2].player = winner;
      if (loser && standings[3]) standings[3].player = loser;
    } else if (m.placingMatch) {
      // e.g. placingMatch: { placeWinner: 13, placeLoser: 14 }
      const winner = getWinner(m);
      const loser = getLoser(m);
      if (
        m.placingMatch.placeWinner &&
        standings[m.placingMatch.placeWinner - 1]
      ) {
        standings[m.placingMatch.placeWinner - 1].player = winner;
      }
      if (
        m.placingMatch.placeLoser &&
        standings[m.placingMatch.placeLoser - 1]
      ) {
        standings[m.placingMatch.placeLoser - 1].player = loser;
      }
    }
  });

  return standings;
}

export default function StandingsList({ groups, matches }) {
  const standings = useMemo(
    () => computeStandings(groups, matches),
    [groups, matches]
  );

  if (!groups || standings.length === 0) return null;

  return (
    <div className="standings-card">
      <h3 className="standings-title">Placings</h3>
      <div className="standings-table">
        {standings.map((row) => (
          <div className="standings-row" key={row.place}>
            <span className="standings-place">{row.place}.</span>
            <span
              className={`standings-player ${row.player ? "placed" : "unplaced"}`}
            >
              {row.player || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
