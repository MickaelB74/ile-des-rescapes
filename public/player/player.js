const socket = io();
let playerName = null;

// ── DOM refs ────────────────────────────────────────────────
const sJoin      = document.getElementById('section-join');
const sWaiting   = document.getElementById('section-waiting');
const sStarted   = document.getElementById('section-started');
const sKicked    = document.getElementById('section-kicked');
const sCancelled = document.getElementById('section-cancelled');

const inputCode   = document.getElementById('input-code');
const btnJoin     = document.getElementById('btn-join');
const joinError   = document.getElementById('join-error');
const waitingName = document.getElementById('waiting-name');
const startedName = document.getElementById('started-name');
const btnBack     = document.getElementById('btn-back');
const btnBackCancel = document.getElementById('btn-back-cancel');

// ── Helpers ─────────────────────────────────────────────────
function show(section) {
  [sJoin, sWaiting, sStarted, sKicked, sCancelled].forEach(s => s.classList.add('hidden'));
  section.classList.remove('hidden');
}

function showError(msg) {
  joinError.textContent = msg;
  joinError.classList.remove('hidden');
}
function clearError() { joinError.classList.add('hidden'); }

function resetToJoin() {
  playerName = null;
  inputCode.value = '';
  clearError();
  show(sJoin);
}

// Pré-rempli le code depuis l'URL si présent (?code=XXXXXX)
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) inputCode.value = urlCode.toUpperCase().slice(0, 6);

// ── Événements UI ───────────────────────────────────────────
inputCode.addEventListener('input', () => {
  inputCode.value = inputCode.value.toUpperCase();
  clearError();
});
inputCode.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnJoin.click(); });

btnJoin.addEventListener('click', () => {
  const code = inputCode.value.trim().toUpperCase();
  if (code.length < 4) { showError('Veuillez entrer un code valide (ex : AB34CD).'); return; }

  btnJoin.disabled = true;
  btnJoin.textContent = 'Connexion…';

  socket.emit('player:join', { code }, (res) => {
    btnJoin.disabled = false;
    btnJoin.textContent = '⛵ Rejoindre l\'île';

    if (res.error) { showError(res.error); return; }

    playerName = res.name;
    waitingName.textContent = playerName;
    startedName.textContent = playerName;
    show(sWaiting);
  });
});

btnBack.addEventListener('click', resetToJoin);
btnBackCancel.addEventListener('click', resetToJoin);

// ── Socket events ────────────────────────────────────────────
socket.on('game:started', () => { show(sStarted); });
socket.on('player:kicked', () => { show(sKicked); });
socket.on('game:admin-disconnected', () => { show(sCancelled); });
