import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_STORAGE_KEY = "playoff-form-state-v2";

function getSearchParams() {
  return new URLSearchParams(window.location.search);
}

function getHashParams() {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(hash);
}

function getStorageKey() {
  return getSearchParams().get("storageKey") || DEFAULT_STORAGE_KEY;
}

function getFlag(name) {
  const value = getSearchParams().get(name);
  return value === "1" || value === "true";
}

function getViewMode() {
  return getSearchParams().get("view") || "app";
}

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
      (_, playerIndex) => existingGroups?.[groupIndex]?.rankedPlayers?.[playerIndex] || ""
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
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return match.winner || "";
  if (homeScore === awayScore) return "";
  return homeScore > awayScore ? match.home : match.away;
}

function getPlayerName(groups, groupIndex, rank) {
  const group = groups[groupIndex];
  if (!group) return "";
  return group.rankedPlayers[rank - 1] || `${group.id}${rank}`;
}

function buildRankedEntries(groups) {
  const playersPerGroup = Math.max(...groups.map((group) => group.rankedPlayers.length), 0);
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
      const queue = [...(carry ? [carry] : []), ...byRank.get(rank).sort((a, b) => a.groupIndex - b.groupIndex)];
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
    const activeSeeds = [firstSeed, secondSeed].filter((seed) => seed <= totalPlayers && seed > byeCount);

    if (activeSeeds.length === 2) {
      const orderedSeeds = [...activeSeeds].sort((a, b) => a - b);
      seedPairs.push(orderedSeeds);
    }
  }

  const orderedSeedPairs = [...seedPairs].sort((a, b) => a[0] - b[0]);

  orderedSeedPairs
    .forEach(([betterSeed, weakerSeed], index) => {
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
    return { groups, matches: [], bracketSize: 0, totalPlayers: 0, totalRounds: 0, byeCount: 0 };
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
      const label = round === totalRounds ? "Final" : `R${round}-M${matchNumber}`;
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

function buildPairBranchTournament(groups, homeGroupIndex, awayGroupIndex, nextId, branchIndex) {
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
     loserSource: { kind: "loser", matchId: final.id },
     endRound: round
   };
 }

 function generateTournament(groups) {
  const totalPlayers = groups.length * (groups[0]?.rankedPlayers.length || 0);
  if (totalPlayers < 2) {
    return { groups, matches: [], bracketSize: 0, totalPlayers: 0, totalRounds: 0, byeCount: 0 };
  }

  let idCounter = 1;
  const nextId = () => `M${idCounter++}`;

  if (groups.length % 2 !== 0) {
    return generateSeededTournament(groups, nextId);
  }

  const branchBuilds = [];
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 2) {
    branchBuilds.push(buildPairBranchTournament(groups, groupIndex, groupIndex + 1, nextId, groupIndex / 2));
  }

   const branchWinners = branchBuilds.map((build) => build.winnerSource);
   const branchLosers = branchBuilds.map((build) => build.loserSource);
   const initialMatches = branchBuilds.flatMap((build) => build.matches);
   const overallStartRound = Math.max(...branchBuilds.map((build) => build.endRound), 0) + 1;
   const finalsBuild = branchWinners.length > 1
     ? buildWinnerBracket(branchWinners, overallStartRound, nextId, "KO")
     : { matches: [], endRound: Math.max(...branchBuilds.map((build) => build.endRound), 0) };
   
   // Add third-place match
   const thirdPlaceMatches = [];
   if (branchLosers.length >= 2) {
     const thirdPlaceRound = finalsBuild.endRound ? finalsBuild.endRound + 1 : overallStartRound;
     const thirdPlaceMatch = makeMatch(
       nextId(),
       thirdPlaceRound,
       "",
       "Third Place Play-off",
       branchLosers[0],
       branchLosers[1]
     );
     thirdPlaceMatches.push(thirdPlaceMatch);
   }
   
   const allMatches = [...initialMatches, ...finalsBuild.matches, ...thirdPlaceMatches];
   const named = applyRoundNames(allMatches);

  return {
    groups,
    matches: named.matches,
    bracketSize: nextPowerOfTwo(totalPlayers),
    totalPlayers,
    totalRounds: named.totalRounds,
    byeCount: allMatches.filter((match) => !match.homeSource || !match.awaySource).length
  };
}

function resolveLegacySource(source, ref) {
  if (!ref) return "";
  if (source.side === "loser") return ref.winner === ref.home ? ref.away : ref.home;
  return ref.winner || "";
}

function resolveWinnerOrLoserSource(source, byId) {
  const ref = byId[source.matchId];
  if (!ref) return "";
  return source.kind === "winner" ? (ref.winner || "") : resolveLegacySource(source, ref);
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

  const autoWinner = autoWinnerForMatch(match, match.scoreHome, match.scoreAway);
  if (autoWinner) {
    match.winner = autoWinner;
    return true;
  }

  return false;
}

function propagateWinners(state) {
  const byId = Object.fromEntries(state.matches.map((match) => [match.id, { ...match }]));

  for (const match of state.matches) {
    const current = byId[match.id];
    const previousHome = current.home;
    const previousAway = current.away;

    current.home = resolveSource(current.homeSource, byId, state.groups);
    current.away = resolveSource(current.awaySource, byId, state.groups);

    const participantsChanged = previousHome !== current.home || previousAway !== current.away;

    if (participantsChanged) {
      clearMatchResult(current);
    }

    if (applyAutomaticWinner(current)) {
      continue;
    }

    if (current.winner && current.winner !== current.home && current.winner !== current.away) {
      current.winner = "";
    }
  }

  return {
    ...state,
    matches: state.matches.map((match) => byId[match.id])
  };
}

function sanitizeTournament(tournament) {
  if (!tournament || !Array.isArray(tournament.matches)) return null;

  return {
    ...tournament,
    bracketSize: Number(tournament.bracketSize) || 0,
    totalPlayers: Number(tournament.totalPlayers) || 0,
    totalRounds: Number(tournament.totalRounds) || 0,
    byeCount: Number(tournament.byeCount) || 0,
    matches: tournament.matches.map((match) => ({
      ...match,
      home: match.home || "",
      away: match.away || "",
      scoreHome: match.scoreHome ?? "",
      scoreAway: match.scoreAway ?? "",
      winner: match.winner || ""
    }))
  };
}

function getSnapshotSignature(snapshot) {
  if (!snapshot) return "";

  return JSON.stringify({
    groupCount: snapshot.groupCount,
    playersPerGroup: snapshot.playersPerGroup,
    groups: snapshot.groups.map((group) => [...group.rankedPlayers])
  });
}

function getSnapshotProgress(snapshot) {
  if (!snapshot?.tournament?.matches) return 0;

  return snapshot.tournament.matches.reduce((count, match) => {
    if (match.winner) return count + 2;
    if (match.scoreHome !== "" || match.scoreAway !== "") return count + 1;
    return count;
  }, 0);
}

function chooseInitialSnapshot(sharedSnapshot, storedSnapshot, options = {}) {
  if (options.preferShared) {
    return sharedSnapshot || storedSnapshot || sanitizeSnapshot(null);
  }

  if (sharedSnapshot && storedSnapshot) {
    if (getSnapshotSignature(sharedSnapshot) !== getSnapshotSignature(storedSnapshot)) {
      return sharedSnapshot;
    }

    return getSnapshotProgress(storedSnapshot) > getSnapshotProgress(sharedSnapshot) ? storedSnapshot : sharedSnapshot;
  }

  return sharedSnapshot || storedSnapshot || sanitizeSnapshot(null);
}

function buildCompactSnapshot(payload) {
  return {
    version: 2,
    groupCount: payload.groupCount,
    playersPerGroup: payload.playersPerGroup,
    groups: payload.groups.map((group) => [...group.rankedPlayers]),
    results: payload.tournament
      ? payload.tournament.matches.map((match) => [match.id, match.scoreHome ?? "", match.scoreAway ?? "", match.winner || ""])
      : null
  };
}

function restoreCompactSnapshot(snapshot) {
  const groupCount = Math.min(8, Math.max(2, Number(snapshot.groupCount) || 2));
  const playersPerGroup = Math.min(16, Math.max(4, Number(snapshot.playersPerGroup) || 4));
  const groups = resizeGroups(
    Array.isArray(snapshot.groups)
      ? snapshot.groups.map((rankedPlayers, index) => ({ id: groupName(index), rankedPlayers }))
      : makeInitialGroups(groupCount, playersPerGroup),
    groupCount,
    playersPerGroup
  );

  let tournament = null;
  if (Array.isArray(snapshot.results)) {
    const generated = generateTournament(groups);
    const resultsById = new Map(snapshot.results.map(([id, scoreHome, scoreAway, winner]) => [id, { scoreHome, scoreAway, winner }]));

    tournament = propagateWinners({
      ...generated,
      matches: generated.matches.map((match) => {
        const saved = resultsById.get(match.id);
        if (!saved) return match;
        return {
          ...match,
          scoreHome: normalizeScore(saved.scoreHome),
          scoreAway: normalizeScore(saved.scoreAway),
          winner: saved.winner || ""
        };
      })
    });
  }

  return { groupCount, playersPerGroup, groups, tournament };
}

function sanitizeSnapshot(snapshot) {
  const fallback = {
    groupCount: 2,
    playersPerGroup: 4,
    groups: makeInitialGroups(2, 4),
    tournament: null
  };

  if (!snapshot || typeof snapshot !== "object") return fallback;

  if (snapshot.version === 2 && Array.isArray(snapshot.groups) && !snapshot.groups[0]?.rankedPlayers) {
    return restoreCompactSnapshot(snapshot);
  }

  const groupCount = Math.min(8, Math.max(2, Number(snapshot.groupCount) || fallback.groupCount));
  const playersPerGroup = Math.min(16, Math.max(4, Number(snapshot.playersPerGroup) || fallback.playersPerGroup));
  const groups = resizeGroups(Array.isArray(snapshot.groups) ? snapshot.groups : fallback.groups, groupCount, playersPerGroup);

  return {
    groupCount,
    playersPerGroup,
    groups,
    tournament: sanitizeTournament(snapshot.tournament)
  };
}

function encodeSnapshotPayload(payload) {
  return encodeURIComponent(JSON.stringify(buildCompactSnapshot(payload)));
}

function decodeSnapshotPayload(value) {
  return sanitizeSnapshot(JSON.parse(decodeURIComponent(value)));
}

function readSnapshot(storageKey) {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    return sanitizeSnapshot(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeSnapshot(storageKey, payload) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(buildCompactSnapshot(payload)));
    return true;
  } catch {
    return false;
  }
}

function encodeSnapshot(payload) {
  return encodeSnapshotPayload(payload);
}

function decodeSnapshot(encoded) {
  try {
    return decodeSnapshotPayload(encoded);
  } catch {
    return null;
  }
}

function readSharedSnapshot() {
  const encoded = getHashParams().get("state") || getSearchParams().get("state");
  return encoded ? decodeSnapshot(encoded) : null;
}

function loadInitialSnapshot(storageKey, options = {}) {
  const sharedSnapshot = readSharedSnapshot();
  const storedSnapshot = readSnapshot(storageKey);
  return chooseInitialSnapshot(sharedSnapshot, storedSnapshot, options);
}

function buildStateUrl(payload, options = {}) {
  const nextUrl = new URL(window.location.href);

  if (options.view && options.view !== "app") {
    nextUrl.searchParams.set("view", options.view);
  } else {
    nextUrl.searchParams.delete("view");
  }

  nextUrl.searchParams.delete("state");

  const hashParams = getHashParams();
  hashParams.set("state", encodeSnapshot(payload));
  nextUrl.hash = hashParams.toString();

  return nextUrl.toString();
}

function syncUrlState(payload) {
  const nextUrl = buildStateUrl(payload, { view: getViewMode() });
  window.history.replaceState(null, "", nextUrl);
}


function shortenName(value, maxLength = 22) {
  const text = value || "TBD";
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}


function renderBracketToPng(tournament) {
  if (!tournament) return "";

  const groupedMatches = tournament.matches.reduce((acc, match) => {
    acc[match.round] = acc[match.round] || [];
    acc[match.round].push(match);
    return acc;
  }, {});

  const rounds = Object.keys(groupedMatches)
    .map(Number)
    .sort((a, b) => a - b);

  if (!rounds.length) return "";

  const scale = 2;
  const padding = 24;
  const titleHeight = 38;
  const roundWidth = 280;
  const matchWidth = 236;
  const matchHeight = 98;
  const matchGap = 20;
  const roundGap = 26;
  const maxMatches = Math.max(...rounds.map((round) => groupedMatches[round].length));
  const width = padding * 2 + rounds.length * roundWidth + Math.max(0, rounds.length - 1) * roundGap;
  const height = padding * 2 + titleHeight + maxMatches * matchHeight + Math.max(0, maxMatches - 1) * matchGap;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;

  const context = canvas.getContext("2d");
  if (!context) return "";

  context.scale(scale, scale);
  context.fillStyle = "#f4f6fb";
  context.fillRect(0, 0, width, height);

  const layoutsById = new Map();

  rounds.forEach((round, roundIndex) => {
    const x = padding + roundIndex * (roundWidth + roundGap);
    const matches = groupedMatches[round];

    matches.forEach((match, matchIndex) => {
      const y = padding + titleHeight + matchIndex * (matchHeight + matchGap);
      layoutsById.set(match.id, { x, y });
    });
  });

  const drawConnector = (fromMatchId, targetX, targetY) => {
    const source = layoutsById.get(fromMatchId);
    if (!source) return;

    const fromX = source.x + matchWidth;
    const fromY = source.y + matchHeight / 2;
    const elbowX = fromX + (targetX - fromX) * 0.48;

    context.beginPath();
    context.moveTo(fromX, fromY);
    context.lineTo(elbowX, fromY);
    context.lineTo(elbowX, targetY);
    context.lineTo(targetX, targetY);
    context.stroke();
  };

  context.strokeStyle = "#a9b4c8";
  context.lineWidth = 1.5;

  rounds.forEach((round) => {
    groupedMatches[round].forEach((match) => {
      const layout = layoutsById.get(match.id);
      if (!layout) return;
      const targetX = layout.x;
      const homeTargetY = layout.y + 36;
      const awayTargetY = layout.y + 64;

      if (match.homeSource?.kind === "winner") {
        drawConnector(match.homeSource.matchId, targetX, homeTargetY);
      }

      if (match.awaySource?.kind === "winner") {
        drawConnector(match.awaySource.matchId, targetX, awayTargetY);
      }
    });
  });

  rounds.forEach((round, roundIndex) => {
    const x = padding + roundIndex * (roundWidth + roundGap);
    const matches = groupedMatches[round];

    context.fillStyle = "#1f2a44";
    context.font = "700 16px Arial";
    context.fillText(matches[0]?.roundName || `Round ${round}`, x, padding + 16);

    matches.forEach((match, matchIndex) => {
      const y = padding + titleHeight + matchIndex * (matchHeight + matchGap);
      const isBye = Boolean((match.home && !match.away) || (!match.home && match.away));

      context.fillStyle = "#ffffff";
      context.strokeStyle = "#d6deed";
      context.lineWidth = 1;
      context.fillRect(x, y, matchWidth, matchHeight);
      context.strokeRect(x, y, matchWidth, matchHeight);

      context.fillStyle = "#5a6782";
      context.font = "12px Arial";
      context.fillText(`${match.label} (${match.id})`, x + 10, y + 16);

      if (isBye) {
        context.fillStyle = "#1b6ff2";
        context.font = "bold 11px Arial";
        context.fillText("BYE", x + matchWidth - 35, y + 16);
      }

      const lines = [
        { name: match.home || "TBD", score: match.scoreHome, winner: match.winner === match.home },
        { name: match.away || "TBD", score: match.scoreAway, winner: match.winner === match.away }
      ];

      lines.forEach((line, lineIndex) => {
        const lineY = y + 38 + lineIndex * 26;
        context.fillStyle = line.winner ? "#e7f9ef" : "#f5f7fb";
        context.fillRect(x + 10, lineY - 12, matchWidth - 20, 20);

        context.fillStyle = line.winner ? "#0f6a42" : "#1f2a44";
        context.font = `${line.winner ? "bold" : "normal"} 12px Arial`;
        context.fillText(shortenName(line.name), x + 16, lineY + 2);

        context.textAlign = "right";
        context.fillText(line.score === "" ? "-" : String(line.score), x + matchWidth - 16, lineY + 2);
        context.textAlign = "left";
      });
    });
  });

  return canvas.toDataURL("image/png");
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

export default function App() {
  const storageKey = getStorageKey();
  const viewMode = getViewMode();
  const imageMode = viewMode === "image";
  const readOnly = getFlag("readonly");
  const initialSnapshot = useMemo(
    () => loadInitialSnapshot(storageKey, { preferShared: imageMode || readOnly }),
    [imageMode, readOnly, storageKey]
  );

  const [groupCount, setGroupCount] = useState(initialSnapshot.groupCount);
  const [playersPerGroup, setPlayersPerGroup] = useState(initialSnapshot.playersPerGroup);
  const [groups, setGroups] = useState(initialSnapshot.groups);
  const [tournament, setTournament] = useState(
    initialSnapshot.tournament
      ? propagateWinners({ ...initialSnapshot.tournament, groups: initialSnapshot.groups })
      : null
  );
  const [saveMsg, setSaveMsg] = useState("");
  const [shareMsg, setShareMsg] = useState("");
  const [pngUrl, setPngUrl] = useState("");


  const configInitializedRef = useRef(false);
  const fileInputRef = useRef(null);

  const payload = useMemo(
    () => ({ groupCount, playersPerGroup, groups, tournament }),
    [groupCount, playersPerGroup, groups, tournament]
  );

  const shareUrl = useMemo(() => buildStateUrl(payload), [payload]);
  const pngPageUrl = useMemo(() => buildStateUrl(payload, { view: "image" }), [payload]);

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

  const applySnapshot = (snapshot) => {
    const next = sanitizeSnapshot(snapshot);
    setGroupCount(next.groupCount);
    setPlayersPerGroup(next.playersPerGroup);
    setGroups(next.groups);
    setTournament(next.tournament ? propagateWinners({ ...next.tournament, groups: next.groups }) : null);
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
    setTournament((current) => (current ? propagateWinners({ ...current, groups }) : current));
  }, [groups]);

  useEffect(() => {
    writeSnapshot(storageKey, payload);
    syncUrlState(payload);
  }, [storageKey, payload]);

  // Regenerate PNG immediately when tournament changes (live update)
  useEffect(() => {
    if (!tournament) {
      setPngUrl("");
      return;
    }
    // Generate PNG with a timestamp-based hash to ensure unique data URLs for browser refresh
    const png = renderBracketToPng(tournament);
    setPngUrl(png);
  }, [tournament]);

  const updatePlayer = (groupIndex, playerIndex, value) => {
    if (readOnly) return;
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
    if (readOnly || !tournament) return;
    const copy = structuredClone(tournament);
    const match = copy.matches.find((candidate) => candidate.id === matchId);
    if (!match) return;
    match.scoreHome = normalizeScore(scoreHome);
    match.scoreAway = normalizeScore(scoreAway);
    match.winner = winner || autoWinnerForMatch(match, match.scoreHome, match.scoreAway);
    setTournament(propagateWinners({ ...copy, groups }));
  };

  const updateMatchScores = (matchId, scoreHome, scoreAway) => {
    if (readOnly || !tournament) return;
    const copy = structuredClone(tournament);
    const match = copy.matches.find((candidate) => candidate.id === matchId);
    if (!match) return;
    match.scoreHome = normalizeScore(scoreHome);
    match.scoreAway = normalizeScore(scoreAway);
    match.winner = autoWinnerForMatch(match, match.scoreHome, match.scoreAway);
    setTournament(propagateWinners({ ...copy, groups }));
  };

  const onSave = () => {
    const ok = writeSnapshot(storageKey, payload);
    syncUrlState(payload);
    setTemporaryMessage(setSaveMsg, ok ? "Saved in this browser and in the URL." : "Could not save locally.");
  };

  const onCopyShareLink = async () => {
    try {
      await copyText(shareUrl);
      setTemporaryMessage(setShareMsg, "Share link copied.");
    } catch {
      setTemporaryMessage(setShareMsg, "Clipboard access is not available in this browser.");
    }
  };

  const onExportJson = () => {
    downloadText("playoff-state.json", JSON.stringify(buildCompactSnapshot(payload), null, 2), "application/json");
    setTemporaryMessage(setSaveMsg, "JSON backup downloaded.");
  };

  const onImportJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const raw = await file.text();
      applySnapshot(JSON.parse(raw));
      setTemporaryMessage(setSaveMsg, "JSON backup imported.");
    } catch {
      setTemporaryMessage(setSaveMsg, "Could not import that JSON file.");
    }
  };

  const onCopyPngPageLink = async () => {
    if (!tournament) return;
    try {
      await copyText(pngPageUrl);
      setTemporaryMessage(setShareMsg, "PNG page link copied.");
    } catch {
      setTemporaryMessage(setShareMsg, "Clipboard access is not available in this browser.");
    }
  };

  const onDownloadPng = () => {
    if (!pngUrl) return;
    const link = document.createElement("a");
    link.href = pngUrl;
    link.download = "playoff-tree.png";
    link.click();
  };

  return (
    <div className={`container${imageMode ? " embed-mode" : ""}`}>
      {!imageMode && (
        <>
          <h2>Table Tennis Playoff Generator</h2>
          <p className="intro">
            The bracket now uses a seeded knockout model: better group-stage placements receive later entry via byes,
            while the lowest remaining placements are paired first, usually against the same finishing place from another group.
          </p>
        </>
      )}

      {!imageMode && (
        <div className="info-panel">
          <strong>Persistence note:</strong> the app stores data locally and mirrors the current state into the URL, so shared links remain
          valid after redeploys on GitHub Pages.
        </div>
      )}

      {!imageMode && (
        <div className="config">
          <label>
            Group count{" "}
            <input
              type="number"
              min={2}
              max={8}
              value={groupCount}
              disabled={readOnly}
              onChange={(event) => setGroupCount(Math.min(8, Math.max(2, Number(event.target.value) || 2)))}
            />
          </label>
          <label>
            Players per group{" "}
            <input
              type="number"
              min={4}
              max={16}
              value={playersPerGroup}
              disabled={readOnly}
              onChange={(event) => setPlayersPerGroup(Math.min(16, Math.max(4, Number(event.target.value) || 4)))}
            />
          </label>
        </div>
      )}

      {!imageMode && (
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
                      disabled={readOnly}
                      placeholder={`${group.id}${playerIndex + 1}`}
                      onChange={(event) => updatePlayer(groupIndex, playerIndex, event.target.value)}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {!imageMode && (
        <>
          <div className="actions">
            <button onClick={onGenerate} disabled={readOnly}>Generate Playoff Tree</button>
            <button onClick={onSave}>Save in browser</button>
            <button onClick={onCopyShareLink}>Copy live share link</button>
            <button onClick={onCopyPngPageLink} disabled={!tournament}>Copy PNG page link</button>
            <button onClick={onExportJson}>Download JSON backup</button>
            <button onClick={() => fileInputRef.current?.click()}>Import JSON backup</button>
            <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={onImportJson} />
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
            <label>
              <span>PNG page link</span>
              <input type="text" readOnly value={pngPageUrl} />
            </label>
          </div>
        </>
      )}

      {tournament && (
        <>
          {!imageMode && (
            <div className="summary-bar">
              <span><strong>Players:</strong> {tournament.totalPlayers}</span>
              <span><strong>Bracket size:</strong> {tournament.bracketSize}</span>
              <span><strong>Auto-byes:</strong> {tournament.byeCount}</span>
            </div>
          )}

          {!imageMode && <div className="actions secondary-actions"><button onClick={onDownloadPng} disabled={!pngUrl}>Download PNG snapshot</button></div>}

          {!imageMode && (
            <>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0 }}>Playoff</h3>
              </div>

              <div className="rounds">
                {Object.keys(groupedMatches)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map((round) => (
                    <div className="round" key={round}>
                      <h4>{groupedMatches[round][0]?.roundName || `Round ${round}`}</h4>
                      {groupedMatches[round].map((match) => {
                        const isBye = Boolean((match.home && !match.away) || (!match.home && match.away));

                        return (
                          <div className="match" key={match.id}>
                            <div className="match-title">
                              {match.label} ({match.id})
                              {isBye ? <span className="bye-badge">BYE</span> : null}
                            </div>
                            <div className="line">
                              <button
                                className={match.winner === match.home ? "winner" : ""}
                                onClick={() => setWinner(match.id, match.home, match.scoreHome, match.scoreAway)}
                                disabled={!match.home || readOnly || isBye}
                              >
                                {match.home || "TBD"}
                              </button>
                              <input
                                type="number"
                                value={match.scoreHome}
                                disabled={readOnly || isBye}
                                onChange={(event) => updateMatchScores(match.id, event.target.value, match.scoreAway)}
                              />
                            </div>
                            <div className="line">
                              <button
                                className={match.winner === match.away ? "winner" : ""}
                                onClick={() => setWinner(match.id, match.away, match.scoreHome, match.scoreAway)}
                                disabled={!match.away || readOnly || isBye}
                              >
                                {match.away || "TBD"}
                              </button>
                              <input
                                type="number"
                                value={match.scoreAway}
                                disabled={readOnly || isBye}
                                onChange={(event) => updateMatchScores(match.id, match.scoreHome, event.target.value)}
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

          </>
        )}

        {pngUrl && (
        <div className="png-preview">
          {!imageMode && <h3>PNG Snapshot Preview</h3>}
          <img src={pngUrl} alt="Generated playoff bracket preview" />
        </div>
      )}
    </div>
  );
}








