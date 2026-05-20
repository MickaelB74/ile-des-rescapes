const adjectives = [
  'Brave', 'Audacieux', 'Téméraire', 'Vaillant', 'Intrépide',
  'Rusé', 'Agile', 'Furtif', 'Tenace', 'Farouche',
  'Sauvage', 'Féroce', 'Mystérieux', 'Impétueux', 'Ardent',
  'Vigilant', 'Stoïque', 'Courageux', 'Opiniâtre', 'Implacable',
];

const nouns = [
  'Naufragé', 'Corsaire', 'Explorateur', 'Survivant', 'Aventurier',
  'Matelot', 'Chasseur', 'Navigateur', 'Pionnier', 'Flibustier',
  'Robinson', 'Trappeur', 'Éclaireur', 'Baroudeur', 'Boucanier',
  'Nomade', 'Vagabond', 'Loup de Mer', 'Pêcheur', 'Insulaire',
];

function generateName() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj} ${noun}`;
}

function generateUniqueName(usedNames) {
  let name;
  let attempts = 0;
  do {
    name = generateName();
    attempts++;
  } while (usedNames.has(name) && attempts < 100);

  // Si toutes les combinaisons sont épuisées, on numérote
  if (usedNames.has(name)) {
    name = `${name} ${usedNames.size + 1}`;
  }

  return name;
}

module.exports = { generateUniqueName };
