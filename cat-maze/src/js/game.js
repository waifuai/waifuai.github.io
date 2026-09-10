import * as state from './state.js';
import * as dom from './dom.js';
import * as audio from './audio.js';
import { loadLevel, advanceLevel } from './level.js';
import { initializeGame } from './game-initializer.js';
import { movePlayer } from './player-movement.js';

// Re-export functions for backward compatibility with other modules
export { initializeGame } from './game-initializer.js';
export { movePlayer } from './player-movement.js';

// Game functions are now imported from their respective modules

// Player movement is now handled by the player-movement module

// Ice sliding is now handled by the ice-sliding module