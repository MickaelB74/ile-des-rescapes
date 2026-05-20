const express = require('express');
const router = express.Router();
const gm = require('../game/gameManager');

// Vérifie si un code de partie est valide avant que le joueur ne tente de rejoindre
router.get('/check/:code', (req, res) => {
  const game = gm.getGame(req.params.code.toUpperCase());
  if (!game) return res.json({ exists: false });
  res.json({ exists: true, status: game.status });
});

module.exports = router;
