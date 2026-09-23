import React from "react";

export default function PlayoffMatch({
  match,
  onScoreHomeChange,
  onScoreAwayChange,
  onTechnicalLoss,
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
      <div className="line">
        <div
          className={`player-name ${
            match.winner && match.winner === match.home ? "winner" : ""
          }`}
        >
          {match.home || "TBD"}
        </div>
        <input
          type="number"
          value={match.scoreHome ?? ""}
          disabled={scoreInputsDisabled}
          readOnly={readOnly}
          onChange={(event) => onScoreHomeChange?.(event.target.value)}
          placeholder="0"
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
      <div className="line">
        <div
          className={`player-name ${
            match.winner && match.winner === match.away ? "winner" : ""
          }`}
        >
          {match.away || "TBD"}
        </div>
        <input
          type="number"
          value={match.scoreAway ?? ""}
          disabled={scoreInputsDisabled}
          readOnly={readOnly}
          onChange={(event) => onScoreAwayChange?.(event.target.value)}
          placeholder="0"
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
