import React, { useMemo } from "react";
import PlayoffMatch from "./PlayoffMatch";

function sourceMatchId(source) {
  return source && typeof source === "object" ? source.matchId : null;
}

function getRoundLayout(matches) {
  const semifinalMatches = matches.filter(
    (match) => match.roundName === "Semifinals"
  );
  const nextMatchByWinnerId = new Map();

  matches.forEach((match) => {
    [match.homeSource, match.awaySource].forEach((source) => {
      const matchId = sourceMatchId(source);
      if (matchId && source.kind === "winner") {
        nextMatchByWinnerId.set(matchId, match);
      }
    });
  });

  const laneByMatchId = new Map();
  semifinalMatches.forEach((match, semifinalIndex) => {
    [match.homeSource, match.awaySource].forEach((source, sideIndex) => {
      const matchId = sourceMatchId(source);
      if (matchId) {
        laneByMatchId.set(matchId, semifinalIndex * 2 + sideIndex);
      }
    });
  });

  matches.forEach((match) => {
    if (match.roundName === "Semifinals" || match.roundName === "Final") {
      return;
    }

    const visited = new Set();
    let current = match;
    while (!laneByMatchId.has(current.id) && !visited.has(current.id)) {
      visited.add(current.id);
      current = nextMatchByWinnerId.get(current.id);
      if (!current) break;
    }

    if (current && laneByMatchId.has(current.id)) {
      laneByMatchId.set(match.id, laneByMatchId.get(current.id));
    }
  });

  return { laneByMatchId, semifinalMatches };
}

function getGridRow(match, matchIndex, layout) {
  if (match.roundName === "Final") {
    return match.label === "3rd Place" ? "7 / span 2" : "3 / span 4";
  }

  if (match.roundName === "Semifinals") {
    const semifinalIndex = layout.semifinalMatches.findIndex(
      (candidate) => candidate.id === match.id
    );
    return `${semifinalIndex * 4 + 1} / span 4`;
  }

  const lane = layout.laneByMatchId.get(match.id) ?? matchIndex;
  return `${lane * 2 + 1} / span 2`;
}

export default function PlayoffRounds({
  tournament,
  onScoreChange,
  onTechnicalLoss,
  readOnly = false
}) {
  const groupedMatches = useMemo(
    () =>
      tournament.matches.reduce((groups, match) => {
        groups[match.round] = groups[match.round] || [];
        groups[match.round].push(match);
        return groups;
      }, {}),
    [tournament.matches]
  );
  const layout = useMemo(
    () => getRoundLayout(tournament.matches),
    [tournament.matches]
  );

  return (
    <div className="rounds">
      {Object.keys(groupedMatches)
        .map(Number)
        .sort((a, b) => a - b)
        .map((round) => (
          <div className="round" key={round}>
            <h4>{groupedMatches[round][0]?.roundName || `Round ${round}`}</h4>
            <div className="round-matches">
              {groupedMatches[round].map((match, matchIndex) => (
                <div
                  className="match-position"
                  key={match.id}
                  style={{ gridRow: getGridRow(match, matchIndex, layout) }}
                >
                  <PlayoffMatch
                    match={match}
                    readOnly={readOnly}
                    onTechnicalLoss={(side) =>
                      onTechnicalLoss?.(match.id, side)
                    }
                    onScoreHomeChange={(scoreHome) =>
                      onScoreChange?.(match.id, scoreHome, match.scoreAway)
                    }
                    onScoreAwayChange={(scoreAway) =>
                      onScoreChange?.(match.id, match.scoreHome, scoreAway)
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}
