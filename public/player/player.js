/* ── Init ─────────────────────────────────────────────────── */
const socket = io();
const timer  = new GameTimer(
  document.getElementById('timer-value'),
  document.getElementById('timer-label')
);

const TEAMS = [
  { id: 'batisseurs',   name: 'Les Bâtisseurs',   emoji: '🏗️', color: '#c8732a',
    image: '/img/batisseurs.png',
    tagline: 'Avec nos mains et notre ingéniosité, nous construirons plus qu\'un abri : nous construirons un avenir.',
    resource: { id: 'bois',       label: 'Bois',       emoji: '🪵' },
    advantage: 'Construisent 2× plus vite',
    disadvantage: 'Consomment 2× plus de nourriture' },
  { id: 'explorateurs', name: 'Les Explorateurs', emoji: '🗺️', color: '#3a7a9a',
    image: '/img/explorateurs.png',
    tagline: 'Observer, comprendre, mesurer : c\'est ainsi que nous trouvons notre chemin et traçons notre avenir.',
    resource: { id: 'plans',      label: 'Plans',      emoji: '📐' },
    advantage: 'Trouvent des raccourcis et ressources cachées',
    disadvantage: 'Peu efficaces s\'ils restent au camp' },
  { id: 'chasseurs',    name: 'Les Chasseurs',    emoji: '🏹', color: '#4a7a3a',
    image: '/img/chasseurs.png',
    tagline: 'Traquer, récolter, survivre : nous assurons notre subsistance pour que le groupe puisse tenir.',
    resource: { id: 'nourriture', label: 'Nourriture', emoji: '🍖' },
    advantage: 'Assurent la subsistance de tout le groupe',
    disadvantage: 'Mauvais en construction' },
  { id: 'guerisseurs',  name: 'Les Guérisseurs',  emoji: '⚕️', color: '#c8a82a',
    image: '/img/guerisseurs.png',
    tagline: 'Soigner, apaiser, protéger : nous cultivons la vie et veillons à l\'équilibre de notre communauté.',
    resource: { id: 'eau',        label: 'Eau',        emoji: '💧' },
    advantage: 'Soignent et maintiennent le moral à 100 %',
    disadvantage: 'Ne peuvent pas travailler seuls' },
];

const OBJ_IMAGES = {
  bat_cabane:     '/img/cabane_de_survie.png',
  bat_pont:       '/img/pont_de_liane.png',
  bat_tour:       '/img/tour_de_guet.png',
  exp_carte:      '/img/carte_du_territoire.png',
  exp_sentiers:   '/img/santiers_balisé.png',
  exp_cache:      '/img/cache_de_ravitaillement.png',
  cha_festin:     '/img/festin_du_camp.png',
  cha_reserves:   '/img/reserves_hivernales.png',
  cha_piege:      '/img/piege_a_gibier.png',
  gue_source:     '/img/source_purifiée.png',
  gue_infirmerie: '/img/infirmerie_de_camp.png',
  gue_medecines:  '/img/provisions_medicinales.png',
};

/* ── Player state ─────────────────────────────────────────── */
const me = { name: null, team: null, objectives: [] };
let allPlayers = [];   // Vue globale du camp
// Demandes d'aide reçues : Map<`${fromId}:${objId}` → item>
const helpRequests = new Map();

/* ── DOM ──────────────────────────────────────────────────── */
const views = {
  join: document.getElementById('view-join'),
  waiting: document.getElementById('view-waiting'),
  phase1: document.getElementById('view-phase1'),
  phase2: document.getElementById('view-phase2'),
  phase3: document.getElementById('view-phase3'),
  phase4: document.getElementById('view-phase4'),
  kicked: document.getElementById('view-kicked'),
  cancelled: document.getElementById('view-cancelled'),
};
const inputCode       = document.getElementById('input-code');
const btnJoin         = document.getElementById('btn-join');
const joinError       = document.getElementById('join-error');
const waitingName     = document.getElementById('waiting-name');
const playerChip      = document.getElementById('player-name-chip');
const p1YourTeam      = document.getElementById('p1-your-team');
const p2YourTeam      = document.getElementById('p2-your-team');
const teamGrid        = document.getElementById('team-grid');
const teamGrid2       = document.getElementById('team-grid-2');
const objectivesGrid  = document.getElementById('objectives-grid');
const helpPanel       = document.getElementById('help-panel');
const helpRequests_   = document.getElementById('help-requests');
const overlayTimerEnd = document.getElementById('overlay-timer-end');
const debriefName     = document.getElementById('debrief-name');
const debriefTeam     = document.getElementById('debrief-team');

/* ── Helpers ──────────────────────────────────────────────── */
function showView(name) {
  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[name]?.classList.remove('hidden');
}
function showError(msg) { joinError.textContent = msg; joinError.classList.remove('hidden'); }
function clearError()   { joinError.classList.add('hidden'); }

function resetToJoin() {
  me.name = null; me.team = null; me.objectives = [];
  allPlayers = [];
  helpRequests.clear();
  inputCode.value = '';
  clearError();
  playerChip.classList.add('hidden');
  timer.clear();
  overlayTimerEnd.classList.add('hidden');
  showView('join');
}

function canComplete(obj) {
  return Object.values(obj.contributions || {}).every(v => v !== null);
}

// Vérifie si une demande d'aide est déjà active (1 seule autorisée à la fois, toutes équipes confondues)
function hasAnyActiveRequest() {
  return me.objectives.some(o =>
    Object.keys(o.helpRequested || {}).some(tid =>
      o.helpRequested[tid] === true &&
      (o.contributions || {})[tid] === null
    )
  );
}

/* ── Timer end → overlay ──────────────────────────────────── */
document.getElementById('timer-value').addEventListener('timer-end', () => {
  const activePhases = ['phase1', 'phase2', 'phase3'];
  const inPhase = activePhases.some(v => !views[v].classList.contains('hidden'));
  if (inPhase) overlayTimerEnd.classList.remove('hidden');
});

/* ── Pre-fill code from URL ───────────────────────────────── */
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) inputCode.value = urlCode.toUpperCase().slice(0, 6);

/* ── Join ─────────────────────────────────────────────────── */
inputCode.addEventListener('input', () => { inputCode.value = inputCode.value.toUpperCase(); clearError(); });
inputCode.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

btnJoin.addEventListener('click', () => {
  const code = inputCode.value.trim().toUpperCase();
  if (code.length < 4) { showError('Entrez un code valide (ex : AB34CD).'); return; }
  btnJoin.disabled = true;
  btnJoin.textContent = 'Connexion…';
  socket.emit('player:join', { code }, (res) => {
    btnJoin.disabled = false;
    btnJoin.textContent = '⛵ Rejoindre l\'île';
    if (res.error) { showError(res.error); return; }
    me.name = res.player.name;
    waitingName.textContent = me.name;
    playerChip.textContent  = `⚓ ${me.name}`;
    playerChip.classList.remove('hidden');
    showView('waiting');
  });
});

document.getElementById('btn-back-kicked').addEventListener('click', resetToJoin);
document.getElementById('btn-back-cancel').addEventListener('click', resetToJoin);

/* ── Phase dispatch ───────────────────────────────────────── */
function handlePhaseChange({ phase, phaseEndAt, players }) {
  overlayTimerEnd.classList.add('hidden');
  allPlayers = players;
  const myData = players.find(p => p.socketId === socket.id);
  if (myData) { me.team = myData.team; me.objectives = myData.objectives || []; }

  if (phaseEndAt) { timer.start(phaseEndAt); timer.setLabel('Temps restant'); }
  else            { timer.clear(phase === 4 ? '—' : '--:--'); timer.setLabel(phase === 4 ? 'Terminé' : 'Temps'); }

  if (phase === 1) renderPhase1();
  else if (phase === 2) renderPhase2();
  else if (phase === 3) renderPhase3();
  else if (phase === 4) renderPhase4();
}

/* ── Phase 1 & 2 : sélection d'équipe ────────────────────── */
function renderTeamGrid(container, yourTeamEl, phase) {
  container.innerHTML = TEAMS.map(t => {
    const sel = me.team === t.id;
    return `
      <div class="team-card-wrap ${sel ? 'selected' : ''}"
           style="${sel ? `border-color:${t.color}` : ''}">
        <!-- Zone flip : clic sur l'image retourne la carte -->
        <div class="team-card-flip" onclick="flipTeamCard(this)">
          <div class="team-card-inner">
            <!-- Face avant : image -->
            <div class="team-card-face team-card-front">
              <img src="${t.image}" alt="${t.name}" loading="lazy" />
              ${sel ? '<div class="team-card-chosen-overlay"><div class="team-card-chosen-badge">✓ Choisi</div></div>' : ''}
            </div>
            <!-- Face arrière : infos -->
            <div class="team-card-face team-card-back">
              <!-- Bandeau coloré : nom de l'équipe -->
              <div class="team-back-header" style="background:${t.color}1a; border-bottom:2px solid ${t.color}44">
                <div class="team-card-name" style="color:${t.color}">${t.emoji} ${t.name}</div>
              </div>
              <!-- Corps : citation/description -->
              <div class="team-back-body">
                <p class="team-card-tagline">${t.tagline}</p>
              </div>
              <!-- Pied : ressource + avantages/inconvénients -->
              <div class="team-back-footer">
                <div class="res-provided">
                  <span class="res-provided-label">Ressource</span>
                  <span class="res-chip res-have">${t.resource.emoji} ${t.resource.label}</span>
                </div>
                <ul class="team-card-pros"><li>${t.advantage}</li></ul>
                <ul class="team-card-cons"><li>${t.disadvantage}</li></ul>
              </div>
            </div>
          </div>
        </div>
        <p class="team-card-hint">↩ cliquer pour retourner</p>
        <!-- Bouton toujours visible sous la carte -->
        <div class="team-card-actions">
          <button class="btn ${sel ? 'btn-success' : 'btn-primary'}" style="width:100%"
            onclick="selectTeam('${t.id}',${phase})">
            ${sel ? '✓ Équipe choisie' : 'Choisir'}
          </button>
        </div>
      </div>`;
  }).join('');
  updateYourTeamChip(yourTeamEl);
}

function updateYourTeamChip(el) {
  const t = TEAMS.find(t => t.id === me.team);
  if (!t) { el.classList.add('hidden'); return; }
  el.innerHTML = `<div class="team-chip" style="background:${t.color}22;color:${t.color};border:1px solid ${t.color}44">${t.emoji} ${t.name} — ${t.resource.emoji} ${t.resource.label}</div>`;
  el.classList.remove('hidden');
}

window.flipTeamCard = (flipEl) => {
  flipEl.classList.toggle('flipped');
  const hint = flipEl.closest('.team-card-wrap')?.querySelector('.team-card-hint');
  if (hint) hint.style.opacity = flipEl.classList.contains('flipped') ? '0' : '0.7';
};

function renderPhase1() { renderTeamGrid(teamGrid,  p1YourTeam, 1); showView('phase1'); }
function renderPhase2() { renderTeamGrid(teamGrid2, p2YourTeam, 2); showView('phase2'); }

window.selectTeam = (teamId, phase) => {
  socket.emit('player:select-team', { teamId }, (res) => {
    if (res?.error) return;
    me.team = teamId;
    if (phase === 1) renderTeamGrid(teamGrid,  p1YourTeam, 1);
    else             renderTeamGrid(teamGrid2, p2YourTeam, 2);
  });
};

/* ── Phase 3 : construction ───────────────────────────────── */
function renderPhase3() {
  renderObjectives();
  showView('phase3');
}

function renderObjectives() {
  objectivesGrid.innerHTML = me.objectives.map(obj => {
    const done  = obj.status === 'completed';
    const ready = !done && canComplete(obj);

    // Chips par ressource
    const anyActive = hasAnyActiveRequest();
    const resChips = (obj.requiredResources || []).map(r => {
      const contrib = (obj.contributions || {})[r.teamId];
      const alreadyRequested = (obj.helpRequested || {})[r.teamId];

      if (contrib !== null && contrib !== undefined) {
        const who = contrib === 'self' ? 'Vous avez' : 'Reçu ✓';
        return `<span class="res-chip res-have">${r.emoji} ${r.label} — ${who}</span>`;
      }
      if (alreadyRequested) {
        return `<span class="res-chip res-waiting">${r.emoji} ${r.label} — ⏳ Aide en attente</span>`;
      }
      if (anyActive) {
        return `<span class="res-chip res-blocked">${r.emoji} ${r.label}</span>`;
      }
      return `
        <div class="res-chip res-need">
          <span>${r.emoji} ${r.label} — Manquant</span>
          <button class="res-ask-btn" onclick="askHelp('${obj.id}','${r.teamId}')">Demander de l'aide</button>
        </div>`;
    }).join('');

    let actionBtn = '';
    if (!done && ready) {
      actionBtn = `<button class="btn btn-success" onclick="completeObj('${obj.id}')">🔨 Construire</button>`;
    } else if (!done) {
      actionBtn = `<button class="btn btn-secondary" disabled>⏳ En attente de ressources</button>`;
    }

    const objImg = OBJ_IMAGES[obj.id] || '';
    return `
      <div class="obj-card ${done ? 'done' : ready ? 'ready' : ''}" data-obj="${obj.id}">
        ${objImg ? `<div class="obj-card-art">
          <img src="${objImg}" alt="${obj.name}" loading="lazy" />
          ${done ? '<div class="obj-art-overlay"><span>✓ Construit</span></div>' : ''}
        </div>` : ''}
        <div class="obj-card-body">
          <div class="obj-card-top">
            <span class="obj-emoji">${obj.emoji}</span>
            <div class="obj-card-info">
              <div class="obj-name">${obj.name}</div>
              <div class="obj-desc">${obj.description}</div>
            </div>
          </div>
          <div class="res-row">${resChips}</div>
          ${done ? `<span class="chip chip-active" style="align-self:flex-start">✓ Complété</span>` : ''}
          ${actionBtn}
        </div>
      </div>`;
  }).join('');
}

window.askHelp = (objectiveId, teamId) => {
  socket.emit('player:request-help', { objectiveId, teamId }, (res) => {
    if (res?.error) { alert(res.error); return; }
    const obj = me.objectives.find(o => o.id === objectiveId);
    if (obj) {
      if (!obj.helpRequested) obj.helpRequested = {};
      obj.helpRequested[teamId] = true;
      renderObjectives();
    }
  });
};

window.completeObj = (objectiveId) => {
  socket.emit('player:complete-objective', { objectiveId }, (res) => {
    if (res?.error) { alert(res.error); return; }
    const obj = me.objectives.find(o => o.id === objectiveId);
    if (obj) { obj.status = 'completed'; renderObjectives(); renderGlobalCamp(); }
  });
};

window.contribute = (targetSocketId, objectiveId, btn) => {
  btn.disabled = true;
  btn.textContent = '…';
  // Pas de teamId — le serveur le détermine depuis l'équipe du helper
  socket.emit('player:contribute', { targetSocketId, objectiveId }, (res) => {
    if (res?.error) {
      btn.disabled = false;
      btn.textContent = 'Aider';
      // Affiche l'erreur brièvement sous le bouton
      const item = btn.closest('.help-request-item');
      let errEl = item?.querySelector('.help-err');
      if (!errEl) {
        errEl = document.createElement('p');
        errEl.className = 'help-err text-xs';
        errEl.style.color = 'var(--danger)';
        item?.appendChild(errEl);
      }
      errEl.textContent = res.error;
      setTimeout(() => errEl?.remove(), 3000);
      return;
    }
    // Succès : retire la demande du panel
    const key = `${targetSocketId}:${objectiveId}`;
    helpRequests.delete(key);
    renderHelpPanel();
  });
};

/* ── Barre d'aide (Phase 3) ───────────────────────────────── */
function renderHelpPanel() {
  const requests = [...helpRequests.values()];
  if (requests.length === 0) { helpPanel.classList.add('hidden'); return; }
  helpPanel.classList.remove('hidden');

  helpRequests_.innerHTML = requests.map(h => `
    <div class="help-request-item">
      <span><strong>${h.fromName}</strong> — ${h.objectiveEmoji} ${h.objectiveName}</span>
      <button class="btn btn-success btn-sm btn-auto"
        onclick="contribute('${h.fromSocketId}','${h.objectiveId}',this)">
        Aider
      </button>
    </div>`).join('');
}

/* ── Vue globale du camp ──────────────────────────────────── */
function renderGlobalCamp() {
  if (!allPlayers.length) { globalCampList.innerHTML = '<p class="text-muted text-sm text-center" style="padding:1rem">En attente des données…</p>'; return; }

  globalCampList.innerHTML = allPlayers.map(p => {
    const isMe = p.socketId === socket.id;
    const t = TEAMS.find(t => t.id === p.team);
    const objs = p.objectives || [];

    const totalObjs = objs.length;
    const doneObjs  = objs.filter(o => o.status === 'completed').length;
    const readyObjs = objs.filter(o => o.status !== 'completed' && canComplete(o)).length;

    const objRows = objs.map(o => {
      const done  = o.status === 'completed';
      const ready = !done && canComplete(o);
      const hasHelp = Object.values(o.helpRequested || {}).some(Boolean);
      const resIcons = (o.requiredResources || []).map(r => {
        const c = (o.contributions || {})[r.teamId];
        return c !== null && c !== undefined
          ? `<span class="camp-res camp-res-have" title="${r.label}">${r.emoji}</span>`
          : `<span class="camp-res camp-res-miss" title="${r.label}">${r.emoji}</span>`;
      }).join('');

      const statusCls  = done ? 'camp-obj-done' : ready ? 'camp-obj-ready' : hasHelp ? 'camp-obj-help' : '';
      const statusIcon = done ? '✓' : ready ? '▶' : hasHelp ? '🆘' : '○';

      return `
        <div class="camp-obj-row ${statusCls}">
          <span class="camp-obj-icon">${o.emoji}</span>
          <span class="camp-obj-name">${o.name}</span>
          <span class="camp-obj-res">${resIcons}</span>
          <span class="camp-obj-status">${statusIcon}</span>
        </div>`;
    }).join('');

    return `
      <div class="camp-player ${isMe ? 'camp-player-me' : ''}">
        <div class="camp-player-header">
          <div class="row gap-sm">
            ${t ? `<span style="color:${t.color}">${t.emoji}</span>` : ''}
            <span class="fw-bold text-sm">${p.name}</span>
            ${isMe ? '<span class="chip chip-phase" style="font-size:.65rem">Vous</span>' : ''}
          </div>
          <span class="camp-progress">${doneObjs}/${totalObjs}
            ${readyObjs > 0 ? `<span class="camp-ready-badge">+${readyObjs} prêt${readyObjs > 1 ? 's' : ''}</span>` : ''}
          </span>
        </div>
        <div class="camp-obj-list">${objRows || '<p class="text-xs text-muted" style="padding:.25rem 0">Objectifs en cours d\'assignation…</p>'}</div>
      </div>`;
  }).join('');
}

/* ── Phase 4 : débriefing ─────────────────────────────────── */
function renderPhase4() {
  debriefName.textContent = me.name || '';
  const t = TEAMS.find(t => t.id === me.team);
  debriefTeam.innerHTML = t
    ? `<div class="team-chip" style="font-size:1rem;padding:.5rem 1rem;background:${t.color}22;color:${t.color};border:1px solid ${t.color}44;border-radius:8px;display:inline-flex;gap:.5rem;align-items:center">${t.emoji} ${t.name} — ${t.resource.emoji} ${t.resource.label}</div>`
    : '<span class="text-muted text-sm">Aucune équipe choisie</span>';
  showView('phase4');
}

/* ── Socket events ────────────────────────────────────────── */
socket.on('game:phase-changed', handlePhaseChange);

socket.on('player:help-needed', (h) => {
  if (h.fromSocketId === socket.id) return; // Ne pas afficher sa propre demande
  const key = `${h.fromSocketId}:${h.objectiveId}`;
  helpRequests.set(key, h);
  if (!views.phase3.classList.contains('hidden')) renderHelpPanel();
});

socket.on('player:contribution-received', ({ objectiveId, teamId, helperName }) => {
  const obj = me.objectives.find(o => o.id === objectiveId);
  if (obj && obj.contributions) {
    obj.contributions[teamId] = 'received';
    delete obj.helpRequested?.[teamId];
    renderObjectives();
    renderGlobalCamp();
  }
});

// Mise à jour globale du camp (après chaque contribution ou complétion)
socket.on('game:players-update', ({ players }) => {
  allPlayers = players;
  const myData = players.find(p => p.socketId === socket.id);
  if (myData) {
    me.objectives = myData.objectives || [];
    me.team = myData.team;
  }
  if (!views.phase3.classList.contains('hidden')) {
    renderObjectives();
    renderHelpPanel();
  }
});

socket.on('player:kicked',           () => { timer.clear(); showView('kicked');    });
socket.on('game:admin-disconnected', () => { timer.clear(); showView('cancelled'); });
