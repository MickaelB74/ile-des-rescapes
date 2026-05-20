const gm = require('../game/gameManager');

function setupSocketHandlers(io) {
  io.on('connection', (socket) => {
    // --- ADMIN ---

    socket.on('admin:create-game', (callback) => {
      // Supprime une éventuelle partie précédente de cet admin
      const existing = gm.getGameByAdmin(socket.id);
      if (existing) {
        io.to(`game:${existing.code}`).emit('game:admin-disconnected');
        gm.deleteGame(existing.code);
      }

      const game = gm.createGame(socket.id);
      socket.join(`game:${game.code}`);
      socket.join(`admin:${game.code}`);
      socket.data.adminGameCode = game.code;

      console.log(`[Game] Créée : ${game.code} (admin: ${socket.id})`);
      callback({ code: game.code });
    });

    socket.on('admin:start-game', ({ code }, callback) => {
      const game = gm.getGame(code);
      if (!game || game.adminSocketId !== socket.id) return callback({ error: 'Non autorisé.' });

      const result = gm.startGame(code);
      if (result.error) return callback({ error: result.error });

      io.to(`game:${code}`).emit('game:started', {
        players: gm.getPlayers(code),
      });

      console.log(`[Game] Lancée : ${code} (${result.game.players.size} joueurs)`);
      callback({ success: true });
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

    // --- PLAYER ---

    socket.on('player:join', ({ code }, callback) => {
      const result = gm.joinGame(code, socket.id);
      if (result.error) return callback({ error: result.error });

      socket.join(`game:${code}`);
      socket.data.playerGameCode = code;

      // Notifie l'admin de la mise à jour de la liste
      io.to(`admin:${code}`).emit('admin:players-updated', {
        players: gm.getPlayers(code),
      });

      console.log(`[Player] Rejoint ${code} : "${result.player.name}" (${socket.id})`);
      callback({ name: result.player.name, code });
    });

    // --- DÉCONNEXION ---

    socket.on('disconnect', () => {
      // Retrait d'un joueur
      const playerCode = socket.data.playerGameCode;
      if (playerCode) {
        const player = gm.removePlayer(playerCode, socket.id);
        if (player) {
          io.to(`admin:${playerCode}`).emit('admin:players-updated', {
            players: gm.getPlayers(playerCode),
          });
        }
      }

      // Déconnexion d'un admin
      const adminCode = socket.data.adminGameCode;
      if (adminCode) {
        io.to(`game:${adminCode}`).emit('game:admin-disconnected');
        gm.deleteGame(adminCode);
        console.log(`[Game] Admin déconnecté, partie ${adminCode} supprimée.`);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
