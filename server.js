require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const adminRoutes = require('./src/routes/admin');
const playerRoutes = require('./src/routes/player');
const { setupSocketHandlers } = require('./src/socket/handlers');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/admin', adminRoutes);
app.use('/api/player', playerRoutes);

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/player/index.html'));
});

app.get('/', (req, res) => {
  res.redirect('/player');
});

setupSocketHandlers(io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n🏝️  L'Île des Rescapés`);
  console.log(`────────────────────────────────`);
  console.log(`  Serveur   : http://localhost:${PORT}`);
  console.log(`  Admin     : http://localhost:${PORT}/admin`);
  console.log(`  Joueurs   : http://localhost:${PORT}/player`);
  console.log(`────────────────────────────────\n`);
});
