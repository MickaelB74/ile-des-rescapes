// Chaque objectif nécessite des ressources de 2 équipes différentes.
// Un joueur possède automatiquement la ressource de sa propre équipe.
// Pour les autres, il DOIT recevoir la contribution d'un joueur de l'équipe concernée.
const POOL = [
  {
    id: 'shelter',
    name: 'Abri principal',
    emoji: '🏕️',
    description: '[Placeholder] Construire un abri solide capable d\'abriter toute l\'équipe.',
    requiredResources: [
      { teamId: 'batisseurs',  label: 'Bois',     emoji: '🪵' },
      { teamId: 'strateges',   label: 'Outils',   emoji: '🔧' },
    ],
  },
  {
    id: 'fire',
    name: 'Foyer central',
    emoji: '🔥',
    description: '[Placeholder] Allumer et entretenir un feu de camp pour cuisiner et se réchauffer.',
    requiredResources: [
      { teamId: 'batisseurs',  label: 'Bois',        emoji: '🪵' },
      { teamId: 'chasseurs',   label: 'Nourriture',  emoji: '🍖' },
    ],
  },
  {
    id: 'water',
    name: 'Réserve d\'eau',
    emoji: '💧',
    description: '[Placeholder] Collecter et stocker 20 litres d\'eau potable.',
    requiredResources: [
      { teamId: 'guerisseurs', label: 'Eau',    emoji: '💧' },
      { teamId: 'strateges',   label: 'Outils', emoji: '🔧' },
    ],
  },
  {
    id: 'food',
    name: 'Stock alimentaire',
    emoji: '🍖',
    description: '[Placeholder] Constituer des provisions pour 3 jours de survie.',
    requiredResources: [
      { teamId: 'chasseurs',   label: 'Nourriture', emoji: '🍖' },
      { teamId: 'explorateurs',label: 'Plans',      emoji: '📐' },
    ],
  },
  {
    id: 'signal',
    name: 'Signal de détresse',
    emoji: '🆘',
    description: '[Placeholder] Préparer un signal visible depuis les airs.',
    requiredResources: [
      { teamId: 'explorateurs', label: 'Plans',  emoji: '📐' },
      { teamId: 'strateges',    label: 'Outils', emoji: '🔧' },
    ],
  },
  {
    id: 'watchtower',
    name: 'Tour de guet',
    emoji: '🛖',
    description: '[Placeholder] Ériger une structure surélevée pour surveiller les environs.',
    requiredResources: [
      { teamId: 'batisseurs',   label: 'Bois',  emoji: '🪵' },
      { teamId: 'explorateurs', label: 'Plans', emoji: '📐' },
    ],
  },
  {
    id: 'garden',
    name: 'Jardin médicinal',
    emoji: '🌿',
    description: '[Placeholder] Cultiver des plantes médicinales pour soigner le groupe.',
    requiredResources: [
      { teamId: 'guerisseurs', label: 'Eau',        emoji: '💧' },
      { teamId: 'chasseurs',   label: 'Nourriture', emoji: '🍖' },
    ],
  },
  {
    id: 'palisade',
    name: 'Palissade défensive',
    emoji: '🛡️',
    description: '[Placeholder] Construire une enceinte pour protéger le camp.',
    requiredResources: [
      { teamId: 'batisseurs',  label: 'Bois', emoji: '🪵' },
      { teamId: 'guerisseurs', label: 'Eau',  emoji: '💧' },
    ],
  },
];

// Initialise les objectifs d'un joueur en fonction de son équipe
function assignObjectives(players) {
  const shuffled = [...POOL].sort(() => Math.random() - 0.5);

  players.forEach((player, i) => {
    player.objectives = [0, 1, 2].map(j => {
      const tpl = shuffled[(i * 3 + j) % shuffled.length];

      // contributions : teamId → null (manquant) ou 'self' (le joueur l'a) ou socketId (reçu)
      const contributions = {};
      tpl.requiredResources.forEach(r => {
        contributions[r.teamId] = r.teamId === player.team ? 'self' : null;
      });

      return {
        ...tpl,
        status: 'pending',       // pending | completed
        contributions,
        helpRequested: {},        // teamId → true  (demande envoyée)
      };
    });
  });
}

// Retourne true si toutes les ressources sont disponibles
function canComplete(obj) {
  return Object.values(obj.contributions).every(v => v !== null);
}

module.exports = { POOL, assignObjectives, canComplete };
