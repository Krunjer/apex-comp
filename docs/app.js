/*
  Static GitHub Pages version of apex_team_comp.py
  - Reroll all
  - Reroll player 1/2/3
  - No duplicate legends within a team
  - No player gets the same legend twice in a row
*/

function buildLegendPool() {
  return {
    Assault: ["Bangalore", "Fuse", "Ash", "Mad Maggie", "Ballistic"],
    Skirmisher: ["Pathfinder", "Wraith", "Octane", "Revenant", "Horizon", "Alter"],
    Recon: ["Bloodhound", "Crypto", "Valkyrie", "Seer", "Vantage", "Sparrow"],
    Support: ["Gibraltar", "Lifeline", "Mirage", "Loba", "Newcastle", "Conduit"],
    Controller: ["Caustic", "Wattson", "Rampart", "Catalyst"],
  };
}

function makeEqualCategoryWeights(categories) {
  const w = {};
  for (const c of categories) w[c] = 1.0;
  return w;
}

function makeEqualLegendWeights(pool) {
  const w = {};
  for (const [cat, legends] of Object.entries(pool)) {
    w[cat] = {};
    for (const l of legends) w[cat][l] = 1.0;
  }
  return w;
}

function weightedChoice(items, weights) {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) throw new Error("Weights sum to 0.");

  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function pickSinglePlayerAssignment({
  player,
  pool,
  categories,
  categoryWeightsList,
  legendWeights,
  takenLegends,
  bannedLegendForPlayer,
}) {
  for (let attempt = 0; attempt < 500; attempt++) {
    const category = weightedChoice(categories, categoryWeightsList);
    const available = pool[category].filter(
      (l) => !takenLegends.has(l) && l !== bannedLegendForPlayer,
    );
    if (available.length === 0) continue;

    const lwMap = legendWeights[category] || {};
    let lw = available.map((l) => lwMap[l] ?? 0.0);
    const sum = lw.reduce((a, b) => a + b, 0);
    if (sum <= 0) lw = available.map(() => 1.0);

    const legend = weightedChoice(available, lw);
    return { legend, category };
  }
  throw new Error(`Failed to reroll legend for ${player}.`);
}

function pickTeamComp({ playerNames, pool, categoryWeights, legendWeights, previousLegendsByPlayer }) {
  if (playerNames.length !== 3) {
    throw new Error("This script currently expects exactly 3 player names.");
  }

  const allLegends = Object.values(pool).flat();
  const uniqueCount = new Set(allLegends).size;
  if (uniqueCount < playerNames.length) {
    throw new Error("Not enough unique legends in the pool for all players.");
  }

  const categories = Object.keys(pool);
  const catW = categories.map((c) => categoryWeights[c] ?? 0.0);
  if (catW.reduce((a, b) => a + b, 0) <= 0) {
    throw new Error("Category weights sum to 0.");
  }

  const assigned = new Set();
  const results = [];

  for (const player of playerNames) {
    const banned = previousLegendsByPlayer?.[player] ?? null;
    const { legend, category } = pickSinglePlayerAssignment({
      player,
      pool,
      categories,
      categoryWeightsList: catW,
      legendWeights,
      takenLegends: assigned,
      bannedLegendForPlayer: banned,
    });

    assigned.add(legend);
    results.push({ player, legend, category });
  }

  return results;
}

const state = {
  players: [
    { name: "Endai", legend: null, category: null, rerollLegend: null, rerollCategory: null, color: "#e7e7e7" },
    { name: "Blazed", legend: null, category: null, rerollLegend: null, rerollCategory: null, color: "#e7e7e7" },
    { name: "Joebert", legend: null, category: null, rerollLegend: null, rerollCategory: null, color: "#e7e7e7" },
  ],
  pool: buildLegendPool(),
  lastLegendByIndex: [null, null, null],
  rerollAllCount: 0,
  rerollCountByIndex: [0, 0, 0],
  rerollUsedSinceAllByIndex: [false, false, false],
};
state.categoryWeights = makeEqualCategoryWeights(Object.keys(state.pool));
state.legendWeights = makeEqualLegendWeights(state.pool);

function render() {
  const output = document.getElementById("output");

  const counterAllEl = document.getElementById("counterAll");
  if (counterAllEl) counterAllEl.textContent = String(state.rerollAllCount);

  const rows = state.players
    .map((p, i) => {
      const legend = p.legend ?? "—";
      const category = p.category ?? "—";
      const rerollLegend = p.rerollLegend;
      const rerollText = rerollLegend ? rerollLegend : "Reroll Available";
      const rerollClass = rerollLegend ? "rerollLegend" : "rerollLegend rerollAvailable";
      const safeName = (p.name ?? "").replace(/"/g, "&quot;");
      const color = p.color ?? "#e7e7e7";
      const counter = state.rerollCountByIndex[i] ?? 0;
      return `
        <div class="row" id="row${i}" style="--rowColor: ${color}">
          <div class="playerWrap">
            <input
              class="colorInput"
              id="color${i}"
              type="color"
              value="${color}"
              aria-label="Player ${i + 1} color"
              title="Choose row color"
            />
            <button class="rerollBtn" id="reroll${i}" type="button" aria-label="Reroll player ${i + 1}">↻<span class="btnCount">${counter}</span></button>
            <input
              class="nameInput"
              id="name${i}"
              type="text"
              value="${safeName}"
              aria-label="Player ${i + 1} name"
            />
          </div>
          <div>
            <div class="legendRow">
              <div class="legend">${legend}</div>
              <div class="${rerollClass}">${rerollText}</div>
              <div class="legendSpacer" aria-hidden="true"></div>
            </div>
            <div class="cat">${category}</div>
          </div>
        </div>
      `;
    })
    .join("");

  output.innerHTML = rows;

  for (let i = 0; i < state.players.length; i++) {
    const nameEl = document.getElementById(`name${i}`);
    const rerollEl = document.getElementById(`reroll${i}`);
    const colorEl = document.getElementById(`color${i}`);
    const rowEl = document.getElementById(`row${i}`);

    const locked = state.rerollUsedSinceAllByIndex[i] === true;
    rerollEl.disabled = locked;
    rerollEl.title = locked ? "Locked until you press Reroll All" : "Reroll this player";

    nameEl.addEventListener("input", () => {
      state.players[i].name = nameEl.value;
    });
    rerollEl.addEventListener("click", () => {
      if (state.rerollUsedSinceAllByIndex[i] === true) return;
      state.rerollUsedSinceAllByIndex[i] = true;
      state.rerollCountByIndex[i] = (state.rerollCountByIndex[i] ?? 0) + 1;
      rerollOne(i);
    });

    colorEl.addEventListener("input", () => {
      state.players[i].color = colorEl.value;
      rowEl.style.setProperty("--rowColor", colorEl.value);
    });
  }
}

function rerollAll() {
  state.rerollUsedSinceAllByIndex = state.players.map(() => false);

  const categories = Object.keys(state.pool);
  const catW = categories.map((c) => state.categoryWeights[c] ?? 0.0);
  if (catW.reduce((a, b) => a + b, 0) <= 0) throw new Error("Category weights sum to 0.");

  const assigned = new Set();
  for (let i = 0; i < state.players.length; i++) {
    const banned = state.lastLegendByIndex[i];
    const { legend, category } = pickSinglePlayerAssignment({
      player: state.players[i].name || `Player ${i + 1}`,
      pool: state.pool,
      categories,
      categoryWeightsList: catW,
      legendWeights: state.legendWeights,
      takenLegends: assigned,
      bannedLegendForPlayer: banned,
    });

    assigned.add(legend);
    state.players[i].legend = legend;
    state.players[i].category = category;
    state.players[i].rerollLegend = null;
    state.players[i].rerollCategory = null;
    state.lastLegendByIndex[i] = legend;
  }

  render();
}

function rerollOne(index) {
  if (index < 0 || index >= state.players.length) return;

  const categories = Object.keys(state.pool);
  const catW = categories.map((c) => state.categoryWeights[c] ?? 0.0);

  const taken = new Set(
    state.players
      .filter((_, i) => i !== index)
      .flatMap((p) => [p.legend, p.rerollLegend])
      .filter(Boolean),
  );

  const baseLegend = state.players[index].legend;
  if (baseLegend) taken.add(baseLegend);
  const banned = baseLegend ?? null;

  const { legend, category } = pickSinglePlayerAssignment({
    player: state.players[index].name || `Player ${index + 1}`,
    pool: state.pool,
    categories,
    categoryWeightsList: catW,
    legendWeights: state.legendWeights,
    takenLegends: taken,
    bannedLegendForPlayer: banned,
  });

  state.players[index].rerollLegend = legend;
  state.players[index].rerollCategory = category;
  render();
}

document.getElementById("rerollAll").addEventListener("click", () => {
  state.rerollAllCount += 1;
  rerollAll();
});

const settingsToggle = document.getElementById("settingsToggle");
if (settingsToggle) {
  settingsToggle.addEventListener("change", () => {
    document.body.classList.toggle("settings", settingsToggle.checked);
  });
}

rerollAll();
