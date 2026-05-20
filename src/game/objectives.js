// Objectifs propres à chaque équipe.
// Chaque objectif requiert la ressource de l'équipe + celle d'UNE équipe partenaire.
// → coopération obligatoire, mais partenaires différents selon l'équipe.

const TEAM_OBJECTIVES = {

  batisseurs: [
    {
      id: 'bat_cabane',
      name: 'Cabane de survie',
      emoji: '🏠',
      description: 'Construire un abri solide pour mettre l\'équipe à l\'abri des intempéries.',
      requiredResources: [
        { teamId: 'batisseurs',  label: 'Bois', emoji: '🪵' },
        { teamId: 'guerisseurs', label: 'Eau',  emoji: '💧' },
      ],
    },
    {
      id: 'bat_pont',
      name: 'Pont de lianes',
      emoji: '🌉',
      description: 'Franchir le ravin avec un pont rudimentaire pour accéder à de nouvelles zones.',
      requiredResources: [
        { teamId: 'batisseurs',   label: 'Bois',  emoji: '🪵' },
        { teamId: 'explorateurs', label: 'Plans', emoji: '📐' },
      ],
    },
    {
      id: 'bat_tour',
      name: 'Tour de guet',
      emoji: '🛖',
      description: 'Ériger une structure surélevée pour surveiller les environs et signaler les dangers.',
      requiredResources: [
        { teamId: 'batisseurs', label: 'Bois',       emoji: '🪵' },
        { teamId: 'chasseurs',  label: 'Nourriture', emoji: '🍖' },
      ],
    },
  ],

  explorateurs: [
    {
      id: 'exp_carte',
      name: 'Carte du territoire',
      emoji: '🗺️',
      description: 'Cartographier l\'île pour identifier les ressources et les zones dangereuses.',
      requiredResources: [
        { teamId: 'explorateurs', label: 'Plans', emoji: '📐' },
        { teamId: 'batisseurs',   label: 'Bois',  emoji: '🪵' },
      ],
    },
    {
      id: 'exp_sentiers',
      name: 'Sentiers balisés',
      emoji: '🪧',
      description: 'Marquer des chemins sécurisés à travers la jungle pour faciliter les déplacements.',
      requiredResources: [
        { teamId: 'explorateurs', label: 'Plans', emoji: '📐' },
        { teamId: 'guerisseurs',  label: 'Eau',   emoji: '💧' },
      ],
    },
    {
      id: 'exp_cache',
      name: 'Cache de ravitaillement',
      emoji: '📦',
      description: 'Dissimuler des réserves stratégiques accessibles en cas de pénurie.',
      requiredResources: [
        { teamId: 'explorateurs', label: 'Plans',      emoji: '📐' },
        { teamId: 'chasseurs',    label: 'Nourriture', emoji: '🍖' },
      ],
    },
  ],

  chasseurs: [
    {
      id: 'cha_festin',
      name: 'Festin du camp',
      emoji: '🍲',
      description: 'Préparer un repas collectif pour remonter le moral de toute la tribu.',
      requiredResources: [
        { teamId: 'chasseurs',   label: 'Nourriture', emoji: '🍖' },
        { teamId: 'guerisseurs', label: 'Eau',        emoji: '💧' },
      ],
    },
    {
      id: 'cha_reserves',
      name: 'Réserves hivernales',
      emoji: '🏺',
      description: 'Constituer des stocks de nourriture séchée pour tenir plusieurs jours.',
      requiredResources: [
        { teamId: 'chasseurs',  label: 'Nourriture', emoji: '🍖' },
        { teamId: 'batisseurs', label: 'Bois',       emoji: '🪵' },
      ],
    },
    {
      id: 'cha_piege',
      name: 'Piège à gibier',
      emoji: '🪤',
      description: 'Poser des pièges efficaces pour assurer un approvisionnement régulier.',
      requiredResources: [
        { teamId: 'chasseurs',    label: 'Nourriture', emoji: '🍖' },
        { teamId: 'explorateurs', label: 'Plans',      emoji: '📐' },
      ],
    },
  ],

  guerisseurs: [
    {
      id: 'gue_source',
      name: 'Source purifiée',
      emoji: '💦',
      description: 'Aménager une source d\'eau potable et sécurisée pour tout le camp.',
      requiredResources: [
        { teamId: 'guerisseurs',  label: 'Eau',   emoji: '💧' },
        { teamId: 'explorateurs', label: 'Plans', emoji: '📐' },
      ],
    },
    {
      id: 'gue_infirmerie',
      name: 'Infirmerie de camp',
      emoji: '⛺',
      description: 'Aménager un espace de soins pour traiter les blessures et maladies.',
      requiredResources: [
        { teamId: 'guerisseurs', label: 'Eau',  emoji: '💧' },
        { teamId: 'batisseurs',  label: 'Bois', emoji: '🪵' },
      ],
    },
    {
      id: 'gue_medecines',
      name: 'Provisions médicinales',
      emoji: '🌿',
      description: 'Récolter et préparer des plantes médicinales pour soigner les naufragés.',
      requiredResources: [
        { teamId: 'guerisseurs', label: 'Eau',        emoji: '💧' },
        { teamId: 'chasseurs',   label: 'Nourriture', emoji: '🍖' },
      ],
    },
  ],
};

// Assigne à chaque joueur les 3 objectifs de son équipe
function assignObjectives(players) {
  players.forEach(player => {
    const teamObjs = TEAM_OBJECTIVES[player.team] || [];
    player.objectives = teamObjs.map(tpl => {
      const contributions = {};
      tpl.requiredResources.forEach(r => {
        contributions[r.teamId] = r.teamId === player.team ? 'self' : null;
      });
      return {
        ...tpl,
        status: 'pending',
        contributions,
        helpRequested: {},
      };
    });
  });
}

// Retourne true si toutes les ressources sont disponibles
function canComplete(obj) {
  return Object.values(obj.contributions).every(v => v !== null);
}

module.exports = { TEAM_OBJECTIVES, assignObjectives, canComplete };
