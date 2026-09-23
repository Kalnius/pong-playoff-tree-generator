import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildStateUrl, getData, saveData } from "../Data/DataClient";
import PlayoffMatch from "./components/PlayoffMatch";

function groupName(index) {
  return String.fromCodePoint(65 + index);
}

function makeInitialGroups(groupCount, playersPerGroup) {
  return Array.from({ length: groupCount }, (_, i) => ({
    id: groupName(i),
    rankedPlayers: Array.from({ length: playersPerGroup }, () => "")
  }));
}

function resizeGroups(existingGroups, groupCount, playersPerGroup) {
  return Array.from({ length: groupCount }, (_, groupIndex) => ({
    id: groupName(groupIndex),
    rankedPlayers: Array.from(
      { length: playersPerGroup },
      (_, playerIndex) =>
        existingGroups?.[groupIndex]?.rankedPlayers?.[playerIndex] || ""
    )
  }));
}

function normalizeScore(value) {
  if (value === "" || value === null || value === undefined) return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

function autoWinnerForMatch(match, scoreHome, scoreAway) {
  const homeScore = Number(scoreHome);
  const awayScore = Number(scoreAway);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore))
    return match.winner || "";
  if (homeScore === awayScore) return "";
  return homeScore > awayScore ? match.home : match.away;
}

function getPlayerName(groups, groupIndex, rank) {
  const group = groups[groupIndex];
  if (!group) return "";
  return group.rankedPlayers[rank - 1] || `${group.id}${rank}`;
}

function makeMatch(id, round, roundName, label, homeSource, awaySource) {
  return {
    id,
    round,
    roundName,
    label,
    homeSource,
    awaySource,
    home: "",
    away: "",
    scoreHome: "",
    scoreAway: "",
    winner: "",
    technicalLoss: ""
  };
}

function nextPowerOfTwo(value) {
  let next = 1;
  while (next < value) next *= 2;
  return next;
}

function getSeedForSlot(groups, groupCount, slotIndex, tierIndex) {
  let groupIndex;
  let rank;

  if (groupCount === 2) {
    const isEvenTier = tierIndex % 2 === 0;
    if (isEvenTier) {
      if (slotIndex === 0) {
        groupIndex = 1;
        rank = tierIndex * 2 + 1;
      } else if (slotIndex === 1) {
        groupIndex = 0;
        rank = tierIndex * 2 + 2;
      } else if (slotIndex === 2) {
        groupIndex = 1;
        rank = tierIndex * 2 + 2;
      } else {
        groupIndex = 0;
        rank = tierIndex * 2 + 1;
      }
    } else {
      if (slotIndex === 0) {
        groupIndex = 0;
        rank = tierIndex * 2 + 2;
      } else if (slotIndex === 1) {
        groupIndex = 1;
        rank = tierIndex * 2 + 1;
      } else if (slotIndex === 2) {
        groupIndex = 0;
        rank = tierIndex * 2 + 1;
      } else {
        groupIndex = 1;
        rank = tierIndex * 2 + 2;
      }
    }
  } else {
    const groupOrder = [
      [0, 2, 1, 3],
      [1, 3, 0, 2],
      [2, 0, 3, 1],
      [3, 1, 2, 0]
    ];
    groupIndex = groupOrder[slotIndex][tierIndex % 4];
    rank = tierIndex + 1;
  }

  const group = groups[groupIndex];
  if (!group || rank > group.rankedPlayers.length) {
    return null;
  }

  return {
    kind: "player",
    groupIndex,
    rank
  };
}

function buildKnockoutTournament(groups, nextId) {
  const totalPlayers = groups.reduce(
    (total, group) => total + group.rankedPlayers.length,
    0
  );
  const matches = [];
  const groupCount = groups.length;

  const maxPlayersPerGroup = Math.max(
    ...groups.map((group) => group.rankedPlayers.length),
    0
  );

  const maxTier =
    groupCount === 2
      ? Math.max(1, Math.ceil(maxPlayersPerGroup / 2) - 1)
      : Math.max(1, maxPlayersPerGroup - 1);

  let currentFeeders = [null, null, null, null];
  let currentRound = 1;

  if (maxTier === 1) {
    // 8 players or fewer: Quarterfinals is Round 1
    const quarterfinalMatches = [];
    for (let slot = 0; slot < 4; slot += 1) {
      const topSeed = getSeedForSlot(groups, groupCount, slot, 0);
      const opponent = getSeedForSlot(groups, groupCount, slot, 1);
      const match = makeMatch(
        nextId(),
        currentRound,
        "Quarterfinals",
        `QF-M${slot + 1}`,
        topSeed,
        opponent
      );
      matches.push(match);
      quarterfinalMatches.push(match);
    }
    currentFeeders = quarterfinalMatches.map((match) => ({
      kind: "winner",
      matchId: match.id
    }));
  } else {
    // Round 1: Tier maxTier vs Tier (maxTier - 1)
    let r1MatchNumber = 1;
    const nextFeeders = [];

    for (let slot = 0; slot < 4; slot += 1) {
      const higherSeed = getSeedForSlot(groups, groupCount, slot, maxTier - 1);
      const lowerSeed = getSeedForSlot(groups, groupCount, slot, maxTier);

      if (higherSeed && lowerSeed) {
        const match = makeMatch(
          nextId(),
          currentRound,
          "Round 1",
          `R1-M${r1MatchNumber++}`,
          higherSeed,
          lowerSeed
        );
        matches.push(match);
        nextFeeders.push({ kind: "winner", matchId: match.id });
      } else if (higherSeed) {
        nextFeeders.push(higherSeed);
      } else {
        nextFeeders.push(null);
      }
    }
    currentFeeders = nextFeeders;
    currentRound += 1;

    // Intermediate preliminary rounds up to the round before Quarterfinals
    for (let tier = maxTier - 2; tier >= 1; tier -= 1) {
      const nextRoundFeeders = [];
      for (let slot = 0; slot < 4; slot += 1) {
        const seededPlayer = getSeedForSlot(groups, groupCount, slot, tier);
        const incomingFeeder = currentFeeders[slot];
        const match = makeMatch(
          nextId(),
          currentRound,
          `Round ${currentRound}`,
          `R${currentRound}-M${slot + 1}`,
          seededPlayer,
          incomingFeeder
        );
        matches.push(match);
        nextRoundFeeders.push({ kind: "winner", matchId: match.id });
      }
      currentFeeders = nextRoundFeeders;
      currentRound += 1;
    }

    // Quarterfinals
    const quarterfinalMatches = [];
    for (let slot = 0; slot < 4; slot += 1) {
      const qfSeed = getSeedForSlot(groups, groupCount, slot, 0);
      const incomingFeeder = currentFeeders[slot];
      const match = makeMatch(
        nextId(),
        currentRound,
        "Quarterfinals",
        `QF-M${slot + 1}`,
        qfSeed,
        incomingFeeder
      );
      matches.push(match);
      quarterfinalMatches.push(match);
    }
    currentFeeders = quarterfinalMatches.map((match) => ({
      kind: "winner",
      matchId: match.id
    }));
  }

  // Semifinals
  currentRound += 1;
  const semifinalMatches = [];
  for (let index = 0; index < 2; index += 1) {
    const match = makeMatch(
      nextId(),
      currentRound,
      "Semifinals",
      `SF-M${index + 1}`,
      currentFeeders[index * 2],
      currentFeeders[index * 2 + 1]
    );
    matches.push(match);
    semifinalMatches.push(match);
  }

  // Final & 3rd Place
  currentRound += 1;
  matches.push(
    makeMatch(
      nextId(),
      currentRound,
      "Final",
      "Final",
      { kind: "winner", matchId: semifinalMatches[0].id },
      { kind: "winner", matchId: semifinalMatches[1].id }
    ),
    makeMatch(
      nextId(),
      currentRound,
      "Final",
      "3rd Place",
      { kind: "loser", matchId: semifinalMatches[0].id },
      { kind: "loser", matchId: semifinalMatches[1].id }
    )
  );

  return {
    groups,
    matches,
    bracketSize: nextPowerOfTwo(Math.max(totalPlayers, 8)),
    totalPlayers,
    totalRounds: currentRound,
    byeCount: matches.filter((match) => !match.homeSource || !match.awaySource)
      .length
  };
}

function generateTournament(groups) {
  const totalPlayers = groups.reduce(
    (total, group) => total + group.rankedPlayers.length,
    0
  );
  if (totalPlayers < 2) {
    return {
      groups,
      matches: [],
      bracketSize: 0,
      totalPlayers: 0,
      totalRounds: 0,
      byeCount: 0
    };
  }

  let idCounter = 1;
  const nextId = () => `M${idCounter++}`;
  return buildKnockoutTournament(groups, nextId);
}

function resolveLegacySource(source, ref) {
  if (!ref) return "";
  if (source.kind === "loser" || source.side === "loser")
    return ref.winner === ref.home ? ref.away : ref.home;
  return ref.winner || "";
}

function resolveWinnerOrLoserSource(source, byId) {
  const ref = byId[source.matchId];
  if (!ref) return "";
  return source.kind === "winner"
    ? ref.winner || ""
    : resolveLegacySource(source, ref);
}

function resolveSource(source, byId, groups) {
  if (!source) return "";
  if (typeof source === "string") return source;

  if (source.kind === "player") {
    return getPlayerName(groups, source.groupIndex, source.rank);
  }

  if (source.kind === "winner" || source.kind === "loser") {
    return resolveWinnerOrLoserSource(source, byId);
  }

  if (source.matchId && source.side) {
    return resolveLegacySource(source, byId[source.matchId]);
  }

  return "";
}

function clearMatchResult(match) {
  match.scoreHome = "";
  match.scoreAway = "";
  match.winner = "";
  match.technicalLoss = "";
}

function isPendingSource(source, resolvedName) {
  return Boolean(
    !resolvedName &&
    source &&
    typeof source === "object" &&
    (source.kind === "winner" || source.kind === "loser")
  );
}

function applyAutomaticWinner(match, homePending, awayPending) {
  if (match.technicalLoss === "home") {
    match.winner = match.away || "";
    return true;
  }

  if (match.technicalLoss === "away") {
    match.winner = match.home || "";
    return true;
  }

  if (match.home && !match.away && !awayPending) {
    match.winner = match.home;
    return true;
  }

  if (!match.home && match.away && !homePending) {
    match.winner = match.away;
    return true;
  }

  if (!match.home && !match.away && !homePending && !awayPending) {
    match.winner = "";
    return true;
  }

  const autoWinner = autoWinnerForMatch(
    match,
    match.scoreHome,
    match.scoreAway
  );
  if (autoWinner) {
    match.winner = autoWinner;
    return true;
  }

  return false;
}

export function propagateWinners(state) {
  const byId = Object.fromEntries(
    state.matches.map((match) => [match.id, { ...match }])
  );

  for (const match of state.matches) {
    const current = byId[match.id];
    const previousHome = current.home;
    const previousAway = current.away;

    current.home = resolveSource(current.homeSource, byId, state.groups);
    current.away = resolveSource(current.awaySource, byId, state.groups);
    const homePending = isPendingSource(current.homeSource, current.home);
    const awayPending = isPendingSource(current.awaySource, current.away);

    const participantsChanged =
      previousHome !== current.home || previousAway !== current.away;

    if (participantsChanged) {
      clearMatchResult(current);
    }

    if (applyAutomaticWinner(current, homePending, awayPending)) {
      continue;
    }

    if (
      current.winner &&
      current.winner !== current.home &&
      current.winner !== current.away
    ) {
      current.winner = "";
    }
  }

  return {
    ...state,
    matches: state.matches.map((match) => byId[match.id])
  };
}

export function getDefaultState(groupCount = 2, playersPerGroup = 4) {
  return {
    groupCount,
    playersPerGroup,
    groups: makeInitialGroups(groupCount, playersPerGroup),
    tournament: null
  };
}

function parseState(data) {
  if (!data || typeof data !== "object") return null;
  const groupCount = Number(data.groupCount) === 4 ? 4 : 2;
  const playersPerGroup = Math.min(
    16,
    Math.max(4, Number(data.playersPerGroup) || 4)
  );
  const groups = resizeGroups(
    Array.isArray(data.groups)
      ? data.groups
      : makeInitialGroups(groupCount, playersPerGroup),
    groupCount,
    playersPerGroup
  );
  const tournament = data.tournament
    ? propagateWinners({ ...data.tournament, groups })
    : null;

  return { groupCount, playersPerGroup, groups, tournament };
}

async function copyText(value) {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard API not available.");
  }

  await navigator.clipboard.writeText(value);
}

function downloadText(filename, text, mimeType) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Admin() {
  const initialData = useMemo(() => {
    return parseState(getData()) || getDefaultState();
  }, []);

  const [groupCount, setGroupCount] = useState(initialData.groupCount);
  const [playersPerGroup, setPlayersPerGroup] = useState(
    initialData.playersPerGroup
  );
  const [groups, setGroups] = useState(initialData.groups);
  const [tournament, setTournament] = useState(initialData.tournament);
  const [saveMsg, setSaveMsg] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const configInitializedRef = useRef(false);
  const fileInputRef = useRef(null);

  const payload = useMemo(
    () => ({ groupCount, playersPerGroup, groups, tournament }),
    [groupCount, playersPerGroup, groups, tournament]
  );

  const shareUrl = useMemo(() => buildStateUrl(payload), [payload]);

  const groupedMatches = useMemo(() => {
    if (!tournament) return {};
    return tournament.matches.reduce((acc, match) => {
      acc[match.round] = acc[match.round] || [];
      acc[match.round].push(match);
      return acc;
    }, {});
  }, [tournament]);

  const setTemporaryMessage = (setter, value) => {
    setter(value);
    window.setTimeout(() => setter(""), 1800);
  };

  const applyState = (data) => {
    const next = parseState(data);
    if (!next) return;
    setGroupCount(next.groupCount);
    setPlayersPerGroup(next.playersPerGroup);
    setGroups(next.groups);
    setTournament(next.tournament);
  };

  useEffect(() => {
    if (!configInitializedRef.current) {
      configInitializedRef.current = true;
      return;
    }

    setGroups((current) => resizeGroups(current, groupCount, playersPerGroup));
    setTournament(null);
  }, [groupCount, playersPerGroup]);

  useEffect(() => {
    if (!tournament) return;
    setTournament((current) =>
      current ? propagateWinners({ ...current, groups }) : current
    );
  }, [groups]);

  useEffect(() => {
    saveData(payload);
  }, [payload, tournament]);

  const updatePlayer = (groupIndex, playerIndex, value) => {
    setGroups((current) => {
      const copy = structuredClone(current);
      copy[groupIndex].rankedPlayers[playerIndex] = value;
      return copy;
    });
  };

  const onGenerate = () => {
    const created = generateTournament(groups);
    setTournament(propagateWinners(created));
  };

  const updateMatchScores = (matchId, scoreHome, scoreAway) => {
    if (!tournament) return;
    const copy = structuredClone(tournament);
    const match = copy.matches.find((candidate) => candidate.id === matchId);
    if (!match) return;
    match.scoreHome = normalizeScore(scoreHome);
    match.scoreAway = normalizeScore(scoreAway);
    if (!match.technicalLoss) {
      match.winner = autoWinnerForMatch(
        match,
        match.scoreHome,
        match.scoreAway
      );
    }
    setTournament(propagateWinners({ ...copy, groups }));
  };

  const handleTechnicalLoss = (matchId, side) => {
    if (!tournament) return;
    const copy = structuredClone(tournament);
    const match = copy.matches.find((candidate) => candidate.id === matchId);
    if (!match) return;
    if (match.technicalLoss === side) {
      match.technicalLoss = "";
      match.winner = autoWinnerForMatch(
        match,
        match.scoreHome,
        match.scoreAway
      );
    } else {
      match.technicalLoss = side;
      match.winner = side === "home" ? match.away : match.home;
    }
    setTournament(propagateWinners({ ...copy, groups }));
  };

  const onSave = () => {
    const ok = saveData(payload);
    setTemporaryMessage(
      setSaveMsg,
      ok ? "Saved in this browser and in the URL." : "Could not save locally."
    );
  };

  const onCopyShareLink = async () => {
    try {
      await copyText(shareUrl);
      setTemporaryMessage(setShareMsg, "Share link copied.");
    } catch {
      setTemporaryMessage(
        setShareMsg,
        "Clipboard access is not available in this browser."
      );
    }
  };

  const onExportJson = () => {
    downloadText(
      "playoff-state.json",
      JSON.stringify(payload, null, 2),
      "application/json"
    );
    setTemporaryMessage(setSaveMsg, "JSON backup downloaded.");
  };

  const onImportJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const raw = await file.text();
      applyState(JSON.parse(raw));
      setTemporaryMessage(setSaveMsg, "JSON backup imported.");
    } catch {
      setTemporaryMessage(setSaveMsg, "Could not import that JSON file.");
    }
  };

  return (
    <div className="container">
      <p className="intro">
        The bracket uses ranked group entries in a knockout format with
        preliminary rounds, quarterfinals, semifinals, a final, and a 3rd place
        match.
      </p>

      <div className="info-panel">
        <strong>Important GitHub Pages persistence note:</strong> local browser
        save is still available, but the durable, redeploy-safe version is the
        URL itself. Every change is mirrored into the page URL, and you can also
        export a JSON backup.
      </div>

      <div className="config">
        <label>
          Group count{" "}
          <select
            value={groupCount}
            onChange={(event) => setGroupCount(Number(event.target.value))}
          >
            <option value={2}>2</option>
            <option value={4}>4</option>
          </select>
        </label>
        <label>
          Players per group{" "}
          <input
            type="number"
            min={4}
            max={16}
            value={playersPerGroup}
            onChange={(event) =>
              setPlayersPerGroup(
                Math.min(16, Math.max(4, Number(event.target.value) || 4))
              )
            }
          />
        </label>
      </div>

      <>
        <h3>Group standings (ranked)</h3>
        <div className="groups">
          {groups.map((group, groupIndex) => (
            <div className="group" key={group.id}>
              <h4>Group {group.id}</h4>
              {group.rankedPlayers.map((player, playerIndex) => (
                <div className="row" key={`${group.id}-${playerIndex}`}>
                  <span>{playerIndex + 1}.</span>
                  <input
                    type="text"
                    value={player}
                    placeholder={`${group.id}${playerIndex + 1}`}
                    onChange={(event) =>
                      updatePlayer(groupIndex, playerIndex, event.target.value)
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </>

      <>
        <div className="actions">
          <button onClick={onGenerate}>Generate Playoff Tree</button>
          <button onClick={onSave}>Save in browser</button>
          <button onClick={onCopyShareLink}>Copy live share link</button>
          <button onClick={onExportJson}>Download JSON backup</button>
          <button onClick={() => fileInputRef.current?.click()}>
            Import JSON backup
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={onImportJson}
          />
        </div>
        <div className="messages">
          <span>{saveMsg}</span>
          <span>{shareMsg}</span>
        </div>

        <div className="share-panel">
          <label>
            <span>Live share link</span>
            <input type="text" readOnly value={shareUrl} />
          </label>
        </div>
      </>

      {tournament && (
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

          <h3>Playoff</h3>
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
                    <PlayoffMatch
                      key={match.id}
                      match={match}
                      onTechnicalLoss={(side) =>
                        handleTechnicalLoss(match.id, side)
                      }
                      onScoreHomeChange={(scoreHome) =>
                        updateMatchScores(match.id, scoreHome, match.scoreAway)
                      }
                      onScoreAwayChange={(scoreAway) =>
                        updateMatchScores(match.id, match.scoreHome, scoreAway)
                      }
                    />
                  ))}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
