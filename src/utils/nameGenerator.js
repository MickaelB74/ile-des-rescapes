function generateUniqueName(usedNames) {
  let n = 1;
  while (usedNames.has(`Équipe ${n}`)) n++;
  return `Équipe ${n}`;
}

module.exports = { generateUniqueName };
