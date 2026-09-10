// game-constants.js
// Shared constants for the Cat Maze game

// Tile codes used in level data
const TILE_CODES = {
    EMPTY: '0',
    WALL: '1',
    FISH: '2', // CHIP in config.js
    WATER: '3',
    FIRE: '4',
    KEY_RED: '5',
    DOOR_RED: '6',
    EXIT: '7',
    ICE: '8',
    BOOTS_WATER: '9',
    BOOTS_FIRE: 'A',
    // New color-coded mechanics
    KEY_BLUE: 'B',
    DOOR_BLUE: 'C',
    KEY_YELLOW: 'D',
    DOOR_YELLOW: 'E',
    KEY_GREEN: 'F',
    DOOR_GREEN: 'G',
    PLAYER: 'P' // Player start position marker in raw level files
};

// Game configuration constants
const GAME_CONSTANTS = {
    MAX_SLIDE_STEPS: 100, // Safety limit for ice sliding
    SLIDE_INTERVAL: 150, // Milliseconds between slide steps
};

// Export constants for use in other modules
export { TILE_CODES, GAME_CONSTANTS };