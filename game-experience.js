(() => {
  'use strict';

  const app = window.App;
  if (!app || app.gameExperiencePatched) return;
  app.gameExperiencePatched = true;

  const originalInit = app.init.bind(app);
  app.init = async function initWithGameExperience(...args) {
    // An async function runs synchronously until its first await. The official
    // controllers are therefore connected before the vault initialization waits.
    const pending = originalInit(...args);
    const enhancements = [
      ['FARM', window.setupGameFarm],
      ['Hub', window.setupGameHub],
      ['Lucky Wheel', window.setupGameWheel],
      ['Dice', window.setupGameDice],
      ['Mines', window.setupGameMines],
      ['Crash', window.setupGameCrash],
      ['Coin Flip', window.setupGameFlip]
    ];
    for (const [name, setup] of enhancements) {
      if (typeof setup !== 'function') continue;
      try { setup(app); }
      catch (error) { console.error(`FITIA ${name} presentation could not be initialized.`, error); }
    }
    app.gameVisibility.apply();
    return pending;
  };
})();
