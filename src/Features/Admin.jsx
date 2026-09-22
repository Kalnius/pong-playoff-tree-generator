import React, { useEffect, useMemo, useRef, useState } from "react";
import { buildStateUrl, getData, saveData } from "../Data/DataClient";

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

function buildRankedEntries(groups) {
  const playersPerGroup = Math.max(
    ...groups.map((group) => group.rankedPlayers.length),
    0
  );
  const entries = [];

  for (let rank = 1; rank <= playersPerGroup; rank += 1) {
    for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
      entries.push({
        rank,
        groupIndex,
        source: { kind: "player", groupIndex, rank }
      });
    }
  }

  return entries;
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
    winner: ""
  };
}

function nextPowerOfTwo(value) {
  let next = 1;
  while (next < value) next *= 2;
  return next;
}

function buildSeedOrder(size) {
  let order = [1, 2];

  while (order.length < size) {
    const nextSize = order.length * 2;
    order = order.flatMap((seed) => [seed, nextSize + 1 - seed]);
  }

  return order;
}

function buildOpeningPairs(entries) {
  const byRank = new Map();

  entries.forEach((entry) => {
    const tier = byRank.get(entry.rank) || [];
    tier.push(entry);
    byRank.set(entry.rank, tier);
  });

  const pairs = [];
  let carry = null;

  [...byRank.keys()]
    .sort((a, b) => a - b)
    .forEach((rank) => {
      const queue = [
        ...(carry ? [carry] : []),
        ...byRank.get(rank).sort((a, b) => a.groupIndex - b.groupIndex)
      ];
      carry = null;

      while (queue.length >= 2) {
        pairs.push([queue.shift(), queue.shift()]);
      }

      if (queue.length === 1) {
        carry = queue.shift();
      }
    });

  if (carry) {
    throw new Error("Could not pair all opening-round players.");
  }

  return pairs;
}

function buildSeedAssignments(groups) {
  const allEntries = buildRankedEntries(groups);
  const totalPlayers = allEntries.length;
  const bracketSize = nextPowerOfTwo(totalPlayers);
  const byeCount = bracketSize - totalPlayers;
  const assignments = {};

  allEntries.slice(0, byeCount).forEach((entry, index) => {
    assignments[index + 1] = entry.source;
  });

  const remainingEntries = allEntries.slice(byeCount);
  const openingPairs = buildOpeningPairs(remainingEntries);
  const seedPairs = [];
  const seedOrder = buildSeedOrder(bracketSize);

  for (let index = 0; index < seedOrder.length; index += 2) {
    const firstSeed = seedOrder[index];
    const secondSeed = seedOrder[index + 1];
    const activeSeeds = [firstSeed, secondSeed].filter(
      (seed) => seed <= totalPlayers && seed > byeCount
    );

    if (activeSeeds.length === 2) {
      const orderedSeeds = [...activeSeeds].sort((a, b) => a - b);
      seedPairs.push(orderedSeeds);
    }
  }

  const orderedSeedPairs = [...seedPairs].sort((a, b) => a[0] - b[0]);

  orderedSeedPairs.forEach(([betterSeed, weakerSeed], index) => {
    const [firstEntry, secondEntry] = openingPairs[index] || [];
    if (firstEntry) assignments[betterSeed] = firstEntry.source;
    if (secondEntry) assignments[weakerSeed] = secondEntry.source;
  });

  return { assignments, bracketSize, byeCount, totalPlayers };
}

function describeRound(round, totalRounds) {
  if (round === totalRounds) return "Final";
  if (round === totalRounds - 1) return "Semifinals";
  if (round === totalRounds - 2) return "Quarterfinals";
  return `Round ${round}`;
}

function applyRoundNames(matches) {
  const totalRounds = Math.max(...matches.map((match) => match.round), 0);

  return {
    totalRounds,
    matches: matches.map((match) => ({
      ...match,
      roundName: describeRound(match.round, totalRounds)
    }))
  };
}

function generateSeededTournament(groups, nextId) {
  const totalPlayers = groups.length * (groups[0]?.rankedPlayers.length || 0);
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

  const { assignments, bracketSize, byeCount } = buildSeedAssignments(groups);
  const totalRounds = Math.log2(bracketSize);
  const seedOrder = buildSeedOrder(bracketSize);
  const matches = [];

  let roundMatchIds = [];

  for (let index = 0; index < seedOrder.length; index += 2) {
    const matchNumber = index / 2 + 1;
    const match = makeMatch(
      nextId(),
      1,
      "",
      `R1-M${matchNumber}`,
      assignments[seedOrder[index]] || null,
      assignments[seedOrder[index + 1]] || null
    );

    matches.push(match);
    roundMatchIds.push(match.id);
  }

  for (let round = 2; round <= totalRounds; round += 1) {
    const nextRoundIds = [];

    for (let index = 0; index < roundMatchIds.length; index += 2) {
      const matchNumber = index / 2 + 1;
      const label =
        round === totalRounds ? "Final" : `R${round}-M${matchNumber}`;
      const match = makeMatch(
        nextId(),
        round,
        "",
        label,
        { kind: "winner", matchId: roundMatchIds[index] },
        { kind: "winner", matchId: roundMatchIds[index + 1] }
      );

      matches.push(match);
      nextRoundIds.push(match.id);
    }

    roundMatchIds = nextRoundIds;
  }

  return {
    groups,
    matches: applyRoundNames(matches).matches,
    bracketSize,
    totalPlayers,
    totalRounds,
    byeCount
  };
}

function buildWinnerBracket(sources, startRound, nextId, labelPrefix) {
  const matches = [];
  let round = startRound;
  let currentSources = [...sources];

  while (currentSources.length > 1) {
    const nextSources = [];

    for (let index = 0; index < currentSources.length; index += 2) {
      const match = makeMatch(
        nextId(),
        round,
        "",
        `${labelPrefix}-R${round}-M${index / 2 + 1}`,
        currentSources[index] || null,
        currentSources[index + 1] || null
      );

      matches.push(match);
      nextSources.push({ kind: "winner", matchId: match.id });
    }

    currentSources = nextSources;
    round += 1;
  }

  return {
    matches,
    winnerSource: currentSources[0] || null,
    endRound: Math.max(startRound - 1, round - 1)
  };
}

function buildPairBranchTournament(
  groups,
  homeGroupIndex,
  awayGroupIndex,
  nextId,
  branchIndex
) {
  const playersPerGroup = groups[homeGroupIndex]?.rankedPlayers.length || 0;
  const anchorStartRank = playersPerGroup <= 4 ? 2 : 3;
  const matches = [];
  let feederSources = [];

  for (let rank = playersPerGroup; rank > anchorStartRank; rank -= 1) {
    const match = makeMatch(
      nextId(),
      1,
      "",
      `B${branchIndex + 1}-R1-${rank}`,
      { kind: "player", groupIndex: homeGroupIndex, rank },
      { kind: "player", groupIndex: awayGroupIndex, rank }
    );

    matches.push(match);
    feederSources.push({ kind: "winner", matchId: match.id });
  }

  if (feederSources.length === 1) {
    feederSources = [feederSources[0], null];
  }

  let round = 2;

  while (feederSources.length > 2) {
    const nextSources = [];

    for (let index = 0; index < feederSources.length; index += 2) {
      const match = makeMatch(
        nextId(),
        round,
        "",
        `B${branchIndex + 1}-Merge-${index / 2 + 1}`,
        feederSources[index],
        feederSources[index + 1] || null
      );

      matches.push(match);
      nextSources.push({ kind: "winner", matchId: match.id });
    }

    feederSources = nextSources;
    round += 1;
  }

  let branchSources = feederSources;

  for (let rank = anchorStartRank; rank >= 1; rank -= 1) {
    branchSources = branchSources.map((source, sourceIndex) => {
      const groupIndex = sourceIndex === 0 ? homeGroupIndex : awayGroupIndex;
      const match = makeMatch(
        nextId(),
        round,
        "",
        `B${branchIndex + 1}-${groupName(groupIndex)}-${rank}`,
        source,
        { kind: "player", groupIndex, rank }
      );

      matches.push(match);
      return { kind: "winner", matchId: match.id };
    });

    round += 1;
  }

  const final = makeMatch(
    nextId(),
    round,
    "",
    `B${branchIndex + 1}-Final`,
    branchSources[0],
    branchSources[1]
  );

  matches.push(final);

  return {
    matches,
    winnerSource: { kind: "winner", matchId: final.id },
    endRound: round
  };
}

function generateTournament(groups) {
  const totalPlayers = groups.length * (groups[0]?.rankedPlayers.length || 0);
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

  if (groups.length % 2 !== 0) {
    return generateSeededTournament(groups, nextId);
  }

  const branchBuilds = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 2) {
    branchBuilds.push(
      buildPairBranchTournament(
        groups,
        groupIndex,
        groupIndex + 1,
        nextId,
        groupIndex / 2
      )
    );
  }

  const branchWinners = branchBuilds.map((build) => build.winnerSource);
  const initialMatches = branchBuilds.flatMap((build) => build.matches);
  const overallStartRound =
    Math.max(...branchBuilds.map((build) => build.endRound), 0) + 1;
  const finalsBuild =
    branchWinners.length > 1
      ? buildWinnerBracket(branchWinners, overallStartRound, nextId, "KO")
      : {
          matches: [],
          endRound: Math.max(...branchBuilds.map((build) => build.endRound), 0)
        };
  const allMatches = [...initialMatches, ...finalsBuild.matches];
  const named = applyRoundNames(allMatches);

  return {
    groups,
    matches: named.matches,
    bracketSize: nextPowerOfTwo(totalPlayers),
    totalPlayers,
    totalRounds: named.totalRounds,
    byeCount: allMatches.filter(
      (match) => !match.homeSource || !match.awaySource
    ).length
  };
}

function resolveLegacySource(source, ref) {
  if (!ref) return "";
  if (source.side === "loser")
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
}

function applyAutomaticWinner(match) {
  if (match.home && !match.away) {
    match.winner = match.home;
    return true;
  }

  if (!match.home && match.away) {
    match.winner = match.away;
    return true;
  }

  if (!match.home && !match.away) {
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

    const participantsChanged =
      previousHome !== current.home || previousAway !== current.away;

    if (participantsChanged) {
      clearMatchResult(current);
    }

    if (applyAutomaticWinner(current)) {
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

  const setWinner = (matchId, winner, scoreHome, scoreAway) => {
    if (!tournament) return;
    const copy = structuredClone(tournament);
    const match = copy.matches.find((candidate) => candidate.id === matchId);
    if (!match) return;
    match.scoreHome = normalizeScore(scoreHome);
    match.scoreAway = normalizeScore(scoreAway);
    match.winner =
      winner || autoWinnerForMatch(match, match.scoreHome, match.scoreAway);
    setTournament(propagateWinners({ ...copy, groups }));
  };

  const updateMatchScores = (matchId, scoreHome, scoreAway) => {
    if (!tournament) return;
    const copy = structuredClone(tournament);
    const match = copy.matches.find((candidate) => candidate.id === matchId);
    if (!match) return;
    match.scoreHome = normalizeScore(scoreHome);
    match.scoreAway = normalizeScore(scoreAway);
    match.winner = autoWinnerForMatch(match, match.scoreHome, match.scoreAway);
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
        The bracket now uses a seeded knockout model: better group-stage
        placements receive later entry via byes, while the lowest remaining
        placements are paired first, usually against the same finishing place
        from another group.
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
                            onClick={() =>
                              setWinner(
                                match.id,
                                match.home,
                                match.scoreHome,
                                match.scoreAway
                              )
                            }
                            disabled={!match.home || isBye}
                          >
                            {match.home || "TBD"}
                          </button>
                          <input
                            type="number"
                            value={match.scoreHome}
                            disabled={isBye}
                            onChange={(event) =>
                              updateMatchScores(
                                match.id,
                                event.target.value,
                                match.scoreAway
                              )
                            }
                            placeholder="0"
                          />
                        </div>
                        <div className="line">
                          <button
                            className={
                              match.winner === match.away ? "winner" : ""
                            }
                            onClick={() =>
                              setWinner(
                                match.id,
                                match.away,
                                match.scoreHome,
                                match.scoreAway
                              )
                            }
                            disabled={!match.away || isBye}
                          >
                            {match.away || "TBD"}
                          </button>
                          <input
                            type="number"
                            value={match.scoreAway}
                            disabled={isBye}
                            onChange={(event) =>
                              updateMatchScores(
                                match.id,
                                match.scoreHome,
                                event.target.value
                              )
                            }
                            placeholder="0"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}
