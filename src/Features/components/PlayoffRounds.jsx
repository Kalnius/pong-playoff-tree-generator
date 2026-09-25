import React, {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import PlayoffMatch from "./PlayoffMatch";

function sourceMatchId(source) {
  return source && typeof source === "object" ? source.matchId : null;
}

function getWinnerConnections(matches) {
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const connections = [];

  matches.forEach((match) => {
    [
      ["home", match.homeSource],
      ["away", match.awaySource]
    ].forEach(([toSide, source]) => {
      if (!source || source.kind !== "winner") {
        return;
      }
      const fromMatch = matchById.get(sourceMatchId(source));
      if (!fromMatch || !fromMatch.winner) {
        return;
      }
      const fromSide = fromMatch.winner === fromMatch.home ? "home" : "away";
      connections.push({
        key: `${fromMatch.id}:${fromSide}->${match.id}:${toSide}`,
        fromMatchId: fromMatch.id,
        fromSide,
        toMatchId: match.id,
        toSide
      });
    });
  });

  return connections;
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

  const containerRef = useRef(null);
  const rowRefsMap = useRef(new Map());
  const [connectorPaths, setConnectorPaths] = useState([]);
  const [overlaySize, setOverlaySize] = useState({ width: 0, height: 0 });

  const registerRowRef = useCallback((matchId, side, element) => {
    const key = `${matchId}:${side}`;
    if (element) {
      rowRefsMap.current.set(key, element);
    } else {
      rowRefsMap.current.delete(key);
    }
  }, []);

  const recomputeConnectorPaths = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const offsetX = container.scrollLeft - containerRect.left;
    const offsetY = container.scrollTop - containerRect.top;

    const nextPaths = getWinnerConnections(tournament.matches)
      .map((connection) => {
        const fromEl = rowRefsMap.current.get(
          `${connection.fromMatchId}:${connection.fromSide}`
        );
        const toEl = rowRefsMap.current.get(
          `${connection.toMatchId}:${connection.toSide}`
        );
        if (!fromEl || !toEl) {
          return null;
        }

        const fromRect = fromEl.getBoundingClientRect();
        const toRect = toEl.getBoundingClientRect();

        const x1 = fromRect.right + offsetX;
        const y1 = fromRect.top + fromRect.height / 2 + offsetY;
        const x2 = toRect.left + offsetX;
        const y2 = toRect.top + toRect.height / 2 + offsetY;
        const midX = x1 + (x2 - x1) / 2;

        return {
          key: connection.key,
          d: `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`
        };
      })
      .filter(Boolean);

    setConnectorPaths(nextPaths);
    setOverlaySize({
      width: container.scrollWidth,
      height: container.scrollHeight
    });
  }, [tournament.matches]);

  useLayoutEffect(() => {
    recomputeConnectorPaths();
  }, [recomputeConnectorPaths]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const resizeObserver = new ResizeObserver(() => recomputeConnectorPaths());
    resizeObserver.observe(container);
    window.addEventListener("resize", recomputeConnectorPaths);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", recomputeConnectorPaths);
    };
  }, [recomputeConnectorPaths]);

  return (
    <div className="rounds" ref={containerRef}>
      <svg
        className="connector-overlay"
        width={overlaySize.width}
        height={overlaySize.height}
      >
        {connectorPaths.map((path) => (
          <path key={path.key} d={path.d} />
        ))}
      </svg>
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
                    homeRowRef={(element) =>
                      registerRowRef(match.id, "home", element)
                    }
                    awayRowRef={(element) =>
                      registerRowRef(match.id, "away", element)
                    }
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
