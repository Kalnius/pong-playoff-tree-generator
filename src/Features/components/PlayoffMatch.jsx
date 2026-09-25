import React from "react";

export default function PlayoffMatch({
  match,
  onScoreHomeChange,
  onScoreAwayChange,
  onTechnicalLoss,
  homeRowRef,
  awayRowRef,
  readOnly = false
}) {
  const isBye = Boolean(
    (match.home && !match.away && !match.awaySource) ||
    (!match.home && match.away && !match.homeSource)
  );

  const hasTechLoss = Boolean(match.technicalLoss);
  const isHomeTechLoss = match.technicalLoss === "home";
  const isAwayTechLoss = match.technicalLoss === "away";
  const bothPlayersPresent = Boolean(match.home && match.away);

  const homeTechDisabled =
    readOnly || isBye || !bothPlayersPresent || isAwayTechLoss;

  const awayTechDisabled =
    readOnly || isBye || !bothPlayersPresent || isHomeTechLoss;

  const scoreInputsDisabled = isBye || hasTechLoss;

  return (
    <div className="match">
      <div className="match-title">
        {match.label} ({match.id})
        {isBye ? <span className="bye-badge">BYE</span> : null}
      </div>
      <div
        ref={homeRowRef}
        className={`line ${
          match.winner && match.winner === match.home ? "winner" : ""
        }`}
      >
        <div className="player-name">{match.home || "TBD"}</div>
        <input
          type="number"
          min={0}
          value={match.scoreHome ?? 0}
          disabled={scoreInputsDisabled}
          readOnly={readOnly}
          onChange={(event) => onScoreHomeChange?.(event.target.value)}
        />
        <button
          type="button"
          className={`tech-loss-btn ${isHomeTechLoss ? "tech-loss-active" : ""}`}
          onClick={() => onTechnicalLoss?.("home")}
          disabled={homeTechDisabled}
          title={
            isHomeTechLoss
              ? "Undo technical loss"
              : `Technical loss for ${match.home || "player"}`
          }
          aria-label={
            isHomeTechLoss
              ? "Undo technical loss"
              : `Technical loss for ${match.home || "player"}`
          }
        >
          T
        </button>
      </div>
      <div
        ref={awayRowRef}
        className={`line ${
          match.winner && match.winner === match.away ? "winner" : ""
        }`}
      >
        <div className="player-name">{match.away || "TBD"}</div>
        <input
          type="number"
          min={0}
          value={match.scoreAway ?? 0}
          disabled={scoreInputsDisabled}
          readOnly={readOnly}
          onChange={(event) => onScoreAwayChange?.(event.target.value)}
        />
        <button
          type="button"
          className={`tech-loss-btn ${isAwayTechLoss ? "tech-loss-active" : ""}`}
          onClick={() => onTechnicalLoss?.("away")}
          disabled={awayTechDisabled}
          title={
            isAwayTechLoss
              ? "Undo technical loss"
              : `Technical loss for ${match.away || "player"}`
          }
          aria-label={
            isAwayTechLoss
              ? "Undo technical loss"
              : `Technical loss for ${match.away || "player"}`
          }
        >
          T
        </button>
      </div>
    </div>
  );
}
