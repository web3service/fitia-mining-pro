// Configuration partagée de la visibilité éditoriale des jeux du Hub.
// Ce réglage est uniquement visuel : il ne modifie aucune règle ni aucun service de jeu.
(function exposeGameVisibilityConfig(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FitiaGameVisibilityConfig = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, () => {
  'use strict';

  const GAMES = Object.freeze([
    Object.freeze({ id: 'wheel', name: 'Lucky Wheel', logo: 'assets/lucky-wheel.svg' }),
    Object.freeze({ id: 'dice', name: 'FITA Dice 3D', logo: 'assets/dice.svg' }),
    Object.freeze({ id: 'mines', name: 'FITA Mines 3D', logo: 'assets/mines.svg' }),
    Object.freeze({ id: 'crash', name: 'FITA Crash', logo: 'assets/crash.svg' }),
    Object.freeze({ id: 'coin-flip', name: 'Coin Flip 3D', logo: 'assets/coin-flip.svg' })
  ]);
  const GAME_IDS = Object.freeze(GAMES.map((game) => game.id));
  const GAME_ID_SET = new Set(GAME_IDS);

  function normalizeManifest(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.hiddenGames)) return null;
    if (raw.hiddenGames.length > GAME_IDS.length) return null;
    const hidden = new Set();
    for (const gameId of raw.hiddenGames) {
      if (typeof gameId !== 'string' || !GAME_ID_SET.has(gameId) || hidden.has(gameId)) return null;
      hidden.add(gameId);
    }
    return { hiddenGames: GAME_IDS.filter((gameId) => hidden.has(gameId)) };
  }

  return { GAMES, GAME_IDS, normalizeManifest };
});
