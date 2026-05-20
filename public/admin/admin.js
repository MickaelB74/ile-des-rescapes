/* ── Init ─────────────────────────────────────────────────── */
const socket = io();

const TEAMS = {
  batisseurs:   { name: 'Bâtisseurs',   emoji: '🏗️', color: '#c8732a', resource: '🪵 Bois'       },
  explorateurs: { name: 'Explorateurs', emoji: '🗺️', color: '#3a7a9a', resource: '📐 Plans'      },
  chasseurs:    { name: 'Chasseurs',    emoji: '🏹', color: '#4a7a3a', resource: '🍖 Nourriture' },
  guerisseurs:  { name: 'Guérisseurs',  emoji: '⚕️', color: '#c8a82a', resource: '💧 Eau'        },
};

const PHASE_META = {
  1: { name: 'Phase 1 — Équipes',        label: 'Phase 2 : Réorganisation', duration: '2 min' },
  2: { name: 'Phase 2 — Réorganisation', label: 'Phase 3 : Construction',   duration: '5 min' },
  3: { name: 'Phase 3 — Construction',   label: 'Phase 4 : Débriefing',     duration: '8 min' },
  4: { name: 'Phase 4 — Débriefing',     label: 'Terminer',                 duration: '—'     },
};

/* ── State ────────────────────────────────────────────────── */
const state = {
  code: null,
  phase: 0,
  players: new Map(), // socketId → player
};

/* ── DOM refs ─────────────────────────────────────────────── */
const viewLobby  = document.getElementById('view-lobby');
const viewGame   = document.getElementById('view-game');
const topbarPhase = document.getElementById('topbar-phase');

// Lobby
const lobbyCreateArea  = document.getElementById('lobby-create-area');
const lobbyGameArea    = document.getElementById('lobby-game-area');
const lobbyPlayersCard = document.getElementById('lobby-players-card');
const lobbyStatus      = document.getElementById('lobby-status');
const lobbyCode        = document.getElementById('lobby-code');
const lobbyLink        = document.getElementById('lobby-link');
const lobbyPlayerList  = document.getElementById('lobby-player-list');
const lobbyPlayerCount = document.getElementById('lobby-player-count');
const lobbyEmpty       = document.getElementById('lobby-empty');
const btnCreate        = document.getElementById('btn-create');
const btnCopyCode      = document.getElementById('btn-copy-code');
const btnCopyLink      = document.getElementById('btn-copy-link');
const btnStartPhase1   = document.getElementById('btn-start-phase1');
const btnDestroy       = document.getElementById('btn-destroy');

// Game
const phaseInfoTitle   = document.getElementById('phase-card-title');
const phaseInfoBody    = document.getElementById('phase-card-body');
const playerGrid       = document.getElementById('player-grid');
const gridEmpty        = document.getElementById('grid-empty');
const gamePlayerCount  = document.getElementById('game-player-count');
const btnNextPhase     = document.getElementById('btn-next-phase');
const btnAbort         = document.getElementById('btn-abort');
const playersColTitle  = document.getElementById('players-col-title');

// Tableau Phase 3
const boardP3          = document.getElementById('board-p3');
const boardColumns     = document.getElementById('board-columns');
const boardScore       = document.getElementById('board-score');
const boardFill        = document.getElementById('board-fill');

/* ── Helpers ──────────────────────────────────────────────── */
function showView(name) {
  viewLobby.classList.toggle('hidden', name !== 'lobby');
  viewGame.classList.toggle('hidden',  name !== 'game');
}

function copy(text, btn, restore) {
  navigator.clipboard.writeText(text).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copié';
    setTimeout(() => { btn.textContent = restore || orig; }, 2000);
  });
}

function avatarColor(name) {
  const colors = ['#c8732a','#3a7a9a','#4a7a3a','#c8a82a','#8b5e3c','#6b4226'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

/* ── Lobby logic ──────────────────────────────────────────── */
btnCreate.addEventListener('click', () => {
  btnCreate.disabled = true;
  socket.emit('admin:create-game', (res) => {
    btnCreate.disabled = false;
    if (res.error) { alert(res.error); return; }
    state.code = res.code;

    lobbyCode.textContent = res.code;
    lobbyLink.textContent = `${location.origin}/player?code=${res.code}`;
    lobbyCreateArea.classList.add('hidden');
    lobbyGameArea.classList.remove('hidden');
    lobbyPlayersCard.classList.remove('hidden');
    lobbyStatus.classList.remove('hidden');
  });
});

btnCopyCode.addEventListener('click',  () => copy(state.code, btnCopyCode, '📋 Copier'));
btnCopyLink.addEventListener('click',  () => copy(lobbyLink.textContent, btnCopyLink, 'Copier'));

btnStartPhase1.addEventListener('click', () => {
  btnStartPhase1.disabled = true;
  socket.emit('admin:next-phase', (res) => {
    if (res?.error) { btnStartPhase1.disabled = false; alert(res.error); }
  });
});

btnDestroy.addEventListener('click', () => {
  if (!confirm('Annuler la partie et déconnecter tous les joueurs ?')) return;
  socket.emit('admin:destroy-game', { code: state.code });
  resetToLobby();
});

function updateLobbyPlayers(players) {
  state.players = new Map(players.map(p => [p.socketId, p]));
  const n = players.filter(p => p.connected !== false).length;
  lobbyPlayerCount.textContent = n;
  lobbyEmpty.classList.toggle('hidden', n > 0);
  btnStartPhase1.disabled = n === 0;
  lobbyPlayerList.innerHTML = players.map(p => `
    <li>
      <div class="row gap-sm">
        <span class="status-dot online"></span>
        <span class="fw-bold" style="font-size:.88rem">${p.name}</span>
      </div>
      <button class="btn btn-danger-soft btn-sm" onclick="kickPlayer('${p.socketId}')">✕</button>
    </li>
  `).join('');
}

function resetToLobby() {
  state.code = null;
  state.phase = 0;
  state.players.clear();
  lobbyCreateArea.classList.remove('hidden');
  lobbyGameArea.classList.add('hidden');
  lobbyPlayersCard.classList.add('hidden');
  lobbyStatus.classList.add('hidden');
  topbarPhase.classList.add('hidden');
  showView('lobby');
}

window.kickPlayer = (id) => {
  socket.emit('admin:kick-player', { code: state.code, playerSocketId: id });
};

/* ── Game / Phase logic ───────────────────────────────────── */
function enterGame({ phase, phaseEndAt, players }) {
  state.phase = phase;
  state.players = new Map(players.map(p => [p.socketId, p]));

  showView('game');
  updateTopbarPhase(phase);
  updatePhasePanel(phase);
  setPhase3View(phase === 3);
  if (phase === 3) renderBoardP3(); else renderPlayerGrid();


  const meta = PHASE_META[phase];
  if (meta) {
    btnNextPhase.textContent = phase === 4 ? '🏁 Terminer la partie' : `⏭️ ${meta.label}`;
    btnNextPhase.disabled = false;
  }
}

function updateTopbarPhase(phase) {
  const meta = PHASE_META[phase];
  if (meta) {
    topbarPhase.textContent = meta.name;
    topbarPhase.classList.remove('hidden');
  }
}

function updatePhasePanel(phase) {
  const meta = PHASE_META[phase];
  phaseInfoTitle.textContent = meta?.name || `Phase ${phase}`;

  const players = [...state.players.values()];
  const connected = players.filter(p => p.connected !== false);

  if (phase === 1 || phase === 2) {
    const chosen = players.filter(p => p.team).length;
    const teamCounts = {};
    players.forEach(p => { if (p.team) teamCounts[p.team] = (teamCounts[p.team] || 0) + 1; });
    const total = connected.length || 1;

    let html = `
      <div class="phase-stat">
        <span class="phase-stat-label">Équipe choisie</span>
        <span class="phase-stat-value">${chosen} / ${connected.length}</span>
      </div>`;

    if (phase === 2) {
      html += `<p class="text-xs text-muted mt-md" style="margin-bottom:.5rem">Doublons à éviter :</p>`;
    }

    html += `<div style="margin-top:.5rem">`;
    Object.entries(TEAMS).forEach(([id, t]) => {
      const n = teamCounts[id] || 0;
      const pct = Math.round((n / total) * 100);
      const warn = phase === 2 && n > 1;
      html += `
        <div class="team-dist-row">
          <span style="width:14px;text-align:center">${t.emoji}</span>
          <span style="width:80px;font-size:.75rem;color:${warn ? 'var(--danger)' : 'var(--text-muted)'}">${t.name}</span>
          <div class="team-dist-bar">
            <div class="team-dist-fill" style="width:${pct}%;background:${t.color}"></div>
          </div>
          <span style="font-size:.75rem;min-width:18px;text-align:right;${warn ? 'color:var(--danger);font-weight:700' : 'color:var(--text-muted)'}">${n}${warn ? ' ⚠️' : ''}</span>
        </div>`;
    });
    html += `</div>`;
    phaseInfoBody.innerHTML = html;

  } else if (phase === 3) {
    const total = players.reduce((s, p) => s + (p.objectives?.length || 0), 0);
    const done  = players.reduce((s, p) => s + (p.objectives?.filter(o => o.status === 'completed').length || 0), 0);
    // helpRequested est maintenant un objet {teamId: true}
    const helps = players.reduce((s, p) => s + (p.objectives?.reduce((t, o) =>
      t + (o.status !== 'completed' ? Object.values(o.helpRequested || {}).filter(Boolean).length : 0), 0) || 0), 0);

    phaseInfoBody.innerHTML = `
      <div class="phase-stat">
        <span class="phase-stat-label">Objectifs complétés</span>
        <span class="phase-stat-value" style="color:var(--accent)">${done} / ${total}</span>
      </div>
      <div class="phase-stat">
        <span class="phase-stat-label">Demandes d'aide actives</span>
        <span class="phase-stat-value" style="color:${helps > 0 ? 'var(--danger)' : 'var(--text-muted)'}">${helps}</span>
      </div>`;

  } else if (phase === 4) {
    const total = players.reduce((s, p) => s + (p.objectives?.length || 0), 0);
    const done  = players.reduce((s, p) => s + (p.objectives?.filter(o => o.status === 'completed').length || 0), 0);
    phaseInfoBody.innerHTML = `
      <p class="text-center" style="font-size:2rem;margin:.5rem 0">🎉</p>
      <div class="phase-stat">
        <span class="phase-stat-label">Score final</span>
        <span class="phase-stat-value" style="color:var(--accent)">${done} / ${total} objectifs</span>
      </div>`;
  }
}

/* ── Tableau Phase 3 ──────────────────────────────────────── */
function renderBoardP3() {
  const players = [...state.players.values()];
  const total = players.reduce((s, p) => s + (p.objectives?.length || 0), 0);
  const done  = players.reduce((s, p) => s + (p.objectives?.filter(o => o.status === 'completed').length || 0), 0);

  boardScore.textContent = `${done} / ${total}`;
  boardFill.style.width  = total > 0 ? `${Math.round(done / total * 100)}%` : '0%';

  boardColumns.innerHTML = players.map(p => {
    const t     = TEAMS[p.team];
    const color = avatarColor(p.name);
    const objs  = p.objectives || [];

    const tiles = objs.map(o => {
      const isDone   = o.status === 'completed';
      const allRes   = Object.values(o.contributions || {}).every(v => v !== null);
      const hasHelp  = Object.values(o.helpRequested || {}).some(Boolean);
      const stCls    = isDone ? 'st-done' : allRes ? 'st-ready' : hasHelp ? 'st-help' : 'st-pending';
      const stLabel  = isDone ? '✓ Construit' : allRes ? '▶ Prêt à construire' : hasHelp ? '🆘 Aide demandée' : '○ En attente';
      const resIcons = (o.requiredResources || []).map(r => {
        const got = (o.contributions || {})[r.teamId] != null;
        return `<span class="board-res-dot ${got ? 'got' : ''}" title="${r.label}">${r.emoji}</span>`;
      }).join('');
      return `
        <div class="board-obj-tile ${stCls}">
          <span class="board-obj-icon">${o.emoji}</span>
          <div class="board-obj-info">
            <div class="board-obj-name">${o.name}</div>
            <div class="board-obj-label">${stLabel}</div>
            <div class="board-obj-res">${resIcons}</div>
          </div>
          ${isDone && o.completionOrder ? `<span class="board-order-badge">#${o.completionOrder}</span>` : ''}
        </div>`;
    }).join('');

    return `
      <div class="board-col">
        <div class="board-col-header">
          <div class="board-col-avatar" style="background:${color}">${p.name.charAt(0).toUpperCase()}</div>
          <div>
            <div class="board-col-name">${p.name}</div>
            ${t ? `<div class="board-col-team" style="color:${t.color}">${t.emoji} ${t.name} — ${t.resource}</div>` : '<div class="board-col-team">—</div>'}
          </div>
        </div>
        ${tiles || '<p style="font-size:.75rem;color:var(--text-muted);padding:.25rem 0">Objectifs en attente…</p>'}
      </div>`;
  }).join('');
}

function setPhase3View(isP3) {
  playerGrid.classList.toggle('hidden', isP3);
  gridEmpty.classList.toggle('hidden', true);
  boardP3.classList.toggle('hidden', !isP3);
  playersColTitle.textContent = isP3 ? '🏕️ Progression du camp' : '👥 Joueurs';
}

/* ── Player grid rendering ────────────────────────────────── */
function renderPlayerGrid() {
  const players = [...state.players.values()];
  const n = players.length;
  gamePlayerCount.textContent = `${n} joueur${n > 1 ? 's' : ''}`;
  gridEmpty.classList.toggle('hidden', n > 0);

  // Diff: update existing cards, add new, remove old
  const existing = new Set([...playerGrid.querySelectorAll('[data-sid]')].map(el => el.dataset.sid));
  const current  = new Set(players.map(p => p.socketId));

  existing.forEach(sid => { if (!current.has(sid)) playerGrid.querySelector(`[data-sid="${sid}"]`)?.remove(); });
  players.forEach(p => {
    const existing = playerGrid.querySelector(`[data-sid="${p.socketId}"]`);
    const html = buildPlayerCard(p);
    if (existing) existing.outerHTML = html;
    else playerGrid.insertAdjacentHTML('beforeend', html);
  });
}

function buildPlayerCard(p) {
  const color = avatarColor(p.name);
  const initial = p.name.charAt(0).toUpperCase();
  const connected = p.connected !== false;

  let body = '';
  if (state.phase === 1 || state.phase === 2) {
    if (p.team && TEAMS[p.team]) {
      const t = TEAMS[p.team];
      body = `<div class="team-chip" style="background:${t.color}22;color:${t.color};border-color:${t.color}44">${t.emoji} ${t.name}</div>`;
    } else {
      body = `<span class="team-pending">En attente de choix…</span>`;
    }
  } else if (state.phase === 3) {
    const objs = p.objectives || [];
    if (objs.length) {
      const doneCount = objs.filter(o => o.status === 'completed').length;
      const rows = objs.map(o => {
        const done    = o.status === 'completed';
        const allRes  = Object.values(o.contributions || {}).every(v => v !== null);
        const hasHelp = Object.values(o.helpRequested || {}).some(Boolean);
        const cls  = done ? 'done' : allRes ? 'inProgress' : hasHelp ? 'help' : '';
        const icon = done ? '✓' : allRes ? '▶' : hasHelp ? '🆘' : '○';
        const resIcons = (o.requiredResources || []).map(r => {
          const got = (o.contributions || {})[r.teamId] !== null && (o.contributions || {})[r.teamId] !== undefined;
          return `<span class="obj-res-dot ${got ? 'got' : ''}" title="${r.label}">${r.emoji}</span>`;
        }).join('');
        return `
          <div class="obj-detail-row ${cls}">
            <span class="obj-detail-icon">${o.emoji}</span>
            <span class="obj-detail-name">${o.name}</span>
            <span class="obj-detail-res">${resIcons}</span>
            <span class="obj-detail-status">${icon}</span>
          </div>`;
      }).join('');
      body = `
        <div class="obj-detail-summary">${doneCount}/${objs.length} complété${doneCount > 1 ? 's' : ''}</div>
        <div class="obj-detail-list">${rows}</div>`;
    }
  } else if (state.phase === 4 && p.team && TEAMS[p.team]) {
    const t = TEAMS[p.team];
    body = `<div class="team-chip" style="background:${t.color}22;color:${t.color};border-color:${t.color}44">${t.emoji} ${t.name} — ${t.resource}</div>`;
  }

  return `
    <div class="player-card ${connected ? '' : 'disconnected'}" data-sid="${p.socketId}">
      <div class="player-card-header">
        <div class="player-avatar" style="background:${color}">${initial}</div>
        <div class="row gap-sm" style="flex:1;min-width:0">
          <span class="status-dot ${connected ? 'online' : 'offline'}"></span>
          <span class="player-card-name">${p.name}</span>
        </div>
        ${state.phase === 0 ? `<button class="btn btn-danger-soft btn-sm" onclick="kickPlayer('${p.socketId}')">✕</button>` : ''}
      </div>
      <div class="player-card-body">${body}</div>
    </div>`;
}

btnNextPhase.addEventListener('click', () => {
  if (state.phase === 4) { resetToLobby(); return; }
  btnNextPhase.disabled = true;
  socket.emit('admin:next-phase', (res) => {
    if (res?.error) { btnNextPhase.disabled = false; alert(res.error); }
  });
});

btnAbort.addEventListener('click', () => {
  if (!confirm('Arrêter la partie en cours et revenir au lobby ?')) return;
  socket.emit('admin:destroy-game', { code: state.code });
  resetToLobby();
});

/* ── Socket events ────────────────────────────────────────── */
socket.on('admin:players-updated', ({ players }) => {
  if (state.phase === 0) {
    updateLobbyPlayers(players);
  } else {
    state.players = new Map(players.map(p => [p.socketId, p]));
    if (state.phase === 3) renderBoardP3(); else renderPlayerGrid();
    updatePhasePanel(state.phase);
  }
});

socket.on('admin:player-state', ({ player }) => {
  state.players.set(player.socketId, player);
  if (state.phase === 3) {
    renderBoardP3();
  } else {
    const card = playerGrid.querySelector(`[data-sid="${player.socketId}"]`);
    if (card) card.outerHTML = buildPlayerCard(player);
  }
  updatePhasePanel(state.phase);
});

socket.on('game:phase-changed', (data) => {
  enterGame(data);
});

socket.on('game:admin-disconnected', () => {
  resetToLobby();
});
