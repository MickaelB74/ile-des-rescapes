const socket = io();
let gameCode = null;

// ── DOM refs ────────────────────────────────────────────────
const sLobby    = document.getElementById('section-lobby');
const sGame     = document.getElementById('section-game');
const sStarted  = document.getElementById('section-started');

const btnCreate  = document.getElementById('btn-create');
const btnStart   = document.getElementById('btn-start');
const btnDestroy = document.getElementById('btn-destroy');
const btnCopy    = document.getElementById('btn-copy');
const btnCopyUrl = document.getElementById('btn-copy-url');
const btnNewGame = document.getElementById('btn-new-game');

const codeValue    = document.getElementById('game-code-value');
const playerUrl    = document.getElementById('player-url');
const playerList   = document.getElementById('player-list');
const playerCount  = document.getElementById('player-count');
const emptyState   = document.getElementById('empty-state');
const statusBadge  = document.getElementById('status-badge');
const startedCount = document.getElementById('started-count');
const startedList  = document.getElementById('started-list');
const alertGame    = document.getElementById('alert-game');

// ── Helpers ─────────────────────────────────────────────────
function show(section) {
  [sLobby, sGame, sStarted].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}

function setAlert(msg, type = 'error') {
  alertGame.className = `alert alert-${type}`;
  alertGame.textContent = msg;
  alertGame.classList.remove('hidden');
  setTimeout(() => alertGame.classList.add('hidden'), 4000);
}

function renderPlayers(players) {
  const n = players.length;
  playerCount.textContent = `${n} joueur${n > 1 ? 's' : ''} connecté${n > 1 ? 's' : ''}`;
  emptyState.classList.toggle('hidden', n > 0);

  playerList.innerHTML = players
    .map(p => `
      <li class="player-item">
        <span class="player-name">⚓ ${p.name}</span>
        <button class="btn btn-ghost" onclick="kickPlayer('${p.socketId}')">Expulser</button>
      </li>
    `)
    .join('');

  btnStart.disabled = n === 0;
}

function copyToClipboard(text, btn, label) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = '✓ Copié !';
    setTimeout(() => { btn.textContent = label; }, 2000);
  });
}

// ── Actions ─────────────────────────────────────────────────
btnCreate.addEventListener('click', () => {
  btnCreate.disabled = true;
  socket.emit('admin:create-game', (res) => {
    btnCreate.disabled = false;
    if (res.error) { alert(res.error); return; }

    gameCode = res.code;
    codeValue.textContent = gameCode;

    // Compose l'URL joueur
    const url = `${location.origin}/player?code=${gameCode}`;
    playerUrl.textContent = url;

    renderPlayers([]);
    show(sGame);
  });
});

btnStart.addEventListener('click', () => {
  if (!gameCode) return;
  btnStart.disabled = true;
  socket.emit('admin:start-game', { code: gameCode }, (res) => {
    if (res.error) {
      btnStart.disabled = false;
      setAlert(res.error);
    }
    // succès géré via l'événement 'game:started'
  });
});

btnDestroy.addEventListener('click', () => {
  if (!confirm('Supprimer la partie et déconnecter tous les joueurs ?')) return;
  socket.emit('admin:destroy-game', { code: gameCode });
  gameCode = null;
  show(sLobby);
});

btnNewGame.addEventListener('click', () => {
  gameCode = null;
  show(sLobby);
});

btnCopy.addEventListener('click', () => copyToClipboard(gameCode, btnCopy, '📋 Copier'));
btnCopyUrl.addEventListener('click', () => copyToClipboard(playerUrl.textContent, btnCopyUrl, 'Copier'));

window.kickPlayer = (playerSocketId) => {
  socket.emit('admin:kick-player', { code: gameCode, playerSocketId });
};

// ── Socket events ────────────────────────────────────────────
socket.on('admin:players-updated', ({ players }) => {
  renderPlayers(players);
});

socket.on('game:started', ({ players }) => {
  startedCount.textContent = players.length;
  startedList.innerHTML = players
    .map(p => `<li class="player-item"><span class="player-name">🌊 ${p.name}</span></li>`)
    .join('');

  statusBadge.className = 'badge started';
  statusBadge.innerHTML = '<span class="dot"></span> En cours';
  show(sStarted);
});
