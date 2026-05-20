const { generateUniqueName } = require('../utils/nameGenerator');
const TEAMS = require('./teams');
const { assignObjectives, canComplete } = require('./objectives');

// Pas de chrono — l'admin contrôle manuellement les transitions
const PHASE_NAMES = {
  0: 'Lobby',
  1: 'Sélection des équipes',
  2: 'Réorganisation',
  3: 'Construction du camp',
  4: 'Débriefing',
};

const games = new Map();

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return games.has(code) ? generateGameCode() : code;
}

function createGame(adminSocketId) {
  const code = generateGameCode();
  games.set(code, {
    code,
    adminSocketId,
    phase: 0,
    phaseEndAt: null,
    completionOrder: 0,
    players: new Map(),
    createdAt: new Date(),
  });
  return games.get(code);
}

function getGame(code) { return games.get(code) || null; }

function getGameByAdmin(adminSocketId) {
  for (const g of games.values()) {
    if (g.adminSocketId === adminSocketId) return g;
  }
  return null;
}

function joinGame(code, socketId) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable. Vérifiez le code.' };
  if (game.phase !== 0) return { error: 'La partie a déjà commencé.' };
  const usedNames = new Set([...game.players.values()].map(p => p.name));
  const name = generateUniqueName(usedNames);
  game.players.set(socketId, {
    name, socketId, connected: true, team: null, objectives: [], joinedAt: new Date(),
  });
  return { player: game.players.get(socketId), game };
}

function removePlayer(code, socketId) {
  const game = games.get(code);
  if (!game) return null;
  const player = game.players.get(socketId);
  if (!player) return null;
  if (game.phase === 0) game.players.delete(socketId);
  else player.connected = false;
  return player;
}

function setPlayerTeam(code, socketId, teamId) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable.' };
  if (game.phase !== 1 && game.phase !== 2) return { error: 'Sélection non disponible.' };
  const player = game.players.get(socketId);
  if (!player) return { error: 'Joueur introuvable.' };
  if (!TEAMS.find(t => t.id === teamId)) return { error: 'Équipe invalide.' };
  player.team = teamId;
  return { player };
}

function startPhase(code, phase) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable.' };
  if (phase < 1 || phase > 4) return { error: 'Phase invalide.' };
  game.phase = phase;
  game.phaseEndAt = null;
  if (phase === 3) {
    assignObjectives([...game.players.values()].filter(p => p.connected));
  }
  return { game };
}

// Marque la demande d'aide pour une ressource spécifique.
// Règle : une seule demande active par teamId à la fois (toutes objectives confondues).
function requestHelp(code, socketId, objectiveId, teamId) {
  const game = games.get(code);
  if (!game) return null;
  const player = game.players.get(socketId);
  if (!player) return null;
  const obj = player.objectives.find(o => o.id === objectiveId);
  if (!obj || !(teamId in obj.contributions)) return null;
  if (obj.contributions[teamId] !== null) return null; // déjà fourni

  // 1 seule demande active à la fois — vérification GLOBALE sur tous les joueurs
  const anyActive = [...game.players.values()].some(p =>
    p.objectives.some(o =>
      Object.keys(o.helpRequested || {}).some(tid =>
        o.helpRequested[tid] === true &&
        (o.contributions || {})[tid] === null
      )
    )
  );
  if (anyActive) return { error: 'Une aide est déjà en cours. Aidez d\'abord avant d\'en demander une autre.' };

  obj.helpRequested[teamId] = true;
  return { player, obj };
}

// Un joueur contribue sa ressource à l'objectif d'un autre.
// teamId est dérivé de l'équipe du helper — le client n'a pas besoin de le préciser.
function contributeResource(code, helperSocketId, targetSocketId, objectiveId) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable.' };
  const helper = game.players.get(helperSocketId);
  const target = game.players.get(targetSocketId);
  if (!helper || !target) return { error: 'Joueur introuvable.' };

  const teamId = helper.team;
  if (!teamId) return { error: 'Vous n\'avez pas d\'équipe assignée.' };

  const obj = target.objectives.find(o => o.id === objectiveId);
  if (!obj) return { error: 'Objectif introuvable.' };
  if (!(teamId in obj.contributions)) return { error: 'Votre ressource n\'est pas requise pour cet objectif.' };
  if (obj.contributions[teamId] !== null) return { error: 'Cette ressource a déjà été fournie.' };

  obj.contributions[teamId] = helperSocketId;
  delete obj.helpRequested[teamId];
  return { target, obj, teamId };
}

// Complete uniquement si toutes les ressources sont disponibles
function completeObjective(code, socketId, objectiveId) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable.' };
  const player = game.players.get(socketId);
  if (!player) return { error: 'Joueur introuvable.' };
  const obj = player.objectives.find(o => o.id === objectiveId);
  if (!obj) return { error: 'Objectif introuvable.' };
  if (!canComplete(obj)) return { error: 'Ressources manquantes — demandez de l\'aide.' };
  obj.status = 'completed';
  obj.completionOrder = ++game.completionOrder;
  return { player, obj };
}

function getPlayers(code) {
  const game = games.get(code);
  return game ? [...game.players.values()] : [];
}

function deleteGame(code) { games.delete(code); }

module.exports = {
  createGame, getGame, getGameByAdmin,
  joinGame, removePlayer,
  setPlayerTeam, startPhase,
  requestHelp, contributeResource, completeObjective,
  getPlayers, deleteGame,
  TEAMS, PHASE_NAMES,
};
