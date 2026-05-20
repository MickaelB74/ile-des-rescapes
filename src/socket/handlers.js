const gm = require('../game/gameManager');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {

    // ── ADMIN ──────────────────────────────────────────────

    socket.on('admin:create-game', (callback) => {
      const existing = gm.getGameByAdmin(socket.id);
      if (existing) {
        io.to(`game:${existing.code}`).emit('game:admin-disconnected');
        gm.deleteGame(existing.code);
      }
      const game = gm.createGame(socket.id);
      socket.join(`game:${game.code}`);
      socket.join(`admin:${game.code}`);
      socket.data.adminGameCode = game.code;
      console.log(`[Game] Créée : ${game.code}`);
      callback({ code: game.code });
    });

    socket.on('admin:next-phase', (callback) => {
      const game = gm.getGameByAdmin(socket.id);
      if (!game) return callback?.({ error: 'Aucune partie active.' });
      const next = game.phase + 1;
      if (next > 4) return callback?.({ error: 'Dernière phase atteinte.' });
      const result = gm.startPhase(game.code, next);
      if (result.error) return callback?.({ error: result.error });
      const players = gm.getPlayers(game.code);
      const payload = { phase: result.game.phase, phaseEndAt: result.game.phaseEndAt, players };
      io.to(`game:${game.code}`).emit('game:phase-changed', payload);
      console.log(`[Game] Phase ${next} : ${game.code}`);
      callback?.({ success: true });
    });

    socket.on('admin:kick-player', ({ code, playerSocketId }) => {
      const game = gm.getGame(code);
      if (!game || game.adminSocketId !== socket.id) return;
      const player = gm.removePlayer(code, playerSocketId);
      if (player) {
        io.to(playerSocketId).emit('player:kicked');
        io.to(`admin:${code}`).emit('admin:players-updated', { players: gm.getPlayers(code) });
      }
    });

    socket.on('admin:destroy-game', ({ code }) => {
      const game = gm.getGame(code);
      if (!game || game.adminSocketId !== socket.id) return;
      io.to(`game:${code}`).emit('game:admin-disconnected');
      gm.deleteGame(code);
      socket.data.adminGameCode = null;
      console.log(`[Game] Supprimée : ${code}`);
    });

    // ── PLAYER ────────────────────────────────────────────

    socket.on('player:join', ({ code }, callback) => {
      const result = gm.joinGame(code, socket.id);
      if (result.error) return callback({ error: result.error });
      socket.join(`game:${code}`);
      socket.data.playerGameCode = code;
      io.to(`admin:${code}`).emit('admin:players-updated', { players: gm.getPlayers(code) });
      console.log(`[Player] Rejoint ${code} : "${result.player.name}"`);
      callback({ player: result.player, code });
    });

    socket.on('player:select-team', ({ teamId }, callback) => {
      const code = socket.data.playerGameCode;
      if (!code) return callback?.({ error: 'Non connecté à une partie.' });
      const result = gm.setPlayerTeam(code, socket.id, teamId);
      if (result.error) return callback?.({ error: result.error });
      io.to(`admin:${code}`).emit('admin:player-state', { player: result.player });
      callback?.({ success: true });
    });

    // Demande d'aide : broadcast anonyme (pas de teamId exposé)
    socket.on('player:request-help', ({ objectiveId, teamId }, callback) => {
      const code = socket.data.playerGameCode;
      if (!code) return;
      const result = gm.requestHelp(code, socket.id, objectiveId, teamId);
      if (!result) return callback?.({ error: 'Impossible de faire cette demande.' });
      if (result.error) return callback?.({ error: result.error });

      // Pas de neededTeamId ni resourceLabel dans le broadcast — tous les joueurs reçoivent
      io.to(`game:${code}`).emit('player:help-needed', {
        fromSocketId: socket.id,
        fromName: result.player.name,
        objectiveId,
        objectiveName: result.obj.name,
        objectiveEmoji: result.obj.emoji,
      });

      io.to(`admin:${code}`).emit('admin:player-state', { player: result.player });
      callback?.({ success: true });
    });

    // Contribution : le serveur détermine la ressource fournie depuis l'équipe du helper
    socket.on('player:contribute', ({ targetSocketId, objectiveId }, callback) => {
      const code = socket.data.playerGameCode;
      if (!code) return;
      const result = gm.contributeResource(code, socket.id, targetSocketId, objectiveId);
      if (result.error) return callback?.({ error: result.error });

      const helper = gm.getGame(code)?.players.get(socket.id);
      const resInfo = result.obj.requiredResources.find(r => r.teamId === result.teamId);

      // Notifie le bénéficiaire
      io.to(targetSocketId).emit('player:contribution-received', {
        objectiveId,
        teamId: result.teamId,
        helperName: helper?.name || '?',
        resourceLabel: resInfo?.label || result.teamId,
        resourceEmoji: resInfo?.emoji || '?',
      });

      // Met à jour l'admin
      io.to(`admin:${code}`).emit('admin:player-state', { player: result.target });

      // Broadcast l'état global à tous les joueurs
      io.to(`game:${code}`).emit('game:players-update', { players: gm.getPlayers(code) });

      // Notifie tous les joueurs que la demande d'aide est résolue → disparaît du panneau
      io.to(`game:${code}`).emit('player:help-fulfilled', {
        fromSocketId: targetSocketId,
        objectiveId,
      });

      callback?.({ success: true });
    });

    // Terminer un objectif (bloqué si ressources manquantes)
    socket.on('player:complete-objective', ({ objectiveId }, callback) => {
      const code = socket.data.playerGameCode;
      if (!code) return;
      const result = gm.completeObjective(code, socket.id, objectiveId);
      if (result.error) return callback?.({ error: result.error });

      io.to(`admin:${code}`).emit('admin:player-state', { player: result.player });

      // Broadcast l'état global à tous les joueurs
      io.to(`game:${code}`).emit('game:players-update', { players: gm.getPlayers(code) });

      callback?.({ success: true, objective: result.obj });
    });

    // ── DISCONNECT ────────────────────────────────────────

    socket.on('disconnect', () => {
      const playerCode = socket.data.playerGameCode;
      if (playerCode) {
        const player = gm.removePlayer(playerCode, socket.id);
        if (player) {
          io.to(`admin:${playerCode}`).emit('admin:players-updated', { players: gm.getPlayers(playerCode) });
        }
      }
      const adminCode = socket.data.adminGameCode;
      if (adminCode) {
        io.to(`game:${adminCode}`).emit('game:admin-disconnected');
        gm.deleteGame(adminCode);
        console.log(`[Game] Admin déco, partie ${adminCode} supprimée.`);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
