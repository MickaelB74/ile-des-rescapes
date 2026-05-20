const { generateUniqueName } = require('../utils/nameGenerator');

// Stockage en mémoire — une Map par partie active
const games = new Map();

function generateGameCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return games.has(code) ? generateGameCode() : code;
}

function createGame(adminSocketId) {
  const code = generateGameCode();
  games.set(code, {
    code,
    adminSocketId,
    status: 'waiting', // 'waiting' | 'started' | 'ended'
    players: new Map(), // socketId → { name, socketId, joinedAt }
    createdAt: new Date(),
  });
  return games.get(code);
}

function getGame(code) {
  return games.get(code) || null;
}

function getGameByAdmin(adminSocketId) {
  for (const game of games.values()) {
    if (game.adminSocketId === adminSocketId) return game;
  }
  return null;
}

function joinGame(code, playerSocketId) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable. Vérifiez le code.' };
  if (game.status !== 'waiting') return { error: 'La partie a déjà commencé.' };

  const usedNames = new Set([...game.players.values()].map((p) => p.name));
  const name = generateUniqueName(usedNames);

  game.players.set(playerSocketId, { name, socketId: playerSocketId, joinedAt: new Date() });
  return { player: game.players.get(playerSocketId), game };
}

function removePlayer(code, playerSocketId) {
  const game = games.get(code);
  if (!game) return null;
  const player = game.players.get(playerSocketId);
  game.players.delete(playerSocketId);
  return player || null;
}

function startGame(code) {
  const game = games.get(code);
  if (!game) return { error: 'Partie introuvable.' };
  if (game.status !== 'waiting') return { error: 'La partie ne peut pas être lancée dans cet état.' };
  game.status = 'started';
  return { game };
}

function deleteGame(code) {
  games.delete(code);
}

function getPlayers(code) {
  const game = games.get(code);
  if (!game) return [];
  return [...game.players.values()];
}

module.exports = { createGame, getGame, getGameByAdmin, joinGame, removePlayer, startGame, deleteGame, getPlayers };
