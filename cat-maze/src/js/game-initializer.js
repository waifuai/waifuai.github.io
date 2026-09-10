// game-initializer.js
// Handles game initialization and level setup

import * as state from './state.js';
import * as dom from './dom.js';
import * as audio from './audio.js';
import { TILE_CODES } from './game-constants.js';
import { trackError } from './analytics.js';

/**
 * Initializes the game with the provided level map data
 * @param {array} levelMapData - The 2D array representing the level grid
 */
export function initializeGame(levelMapData) {
    if (state.isEditorMode) return; // Don't initialize game if in editor mode

    state.resetLevelState(); // Reset state variables for the level
    state.setCurrentLevelData(levelMapData); // Store the deep copy

    // Ensure level data is valid before proceeding
    if (!state.currentLevelData || state.currentLevelData.length === 0 || !state.currentLevelData[0] || state.currentLevelData[0].length === 0) {
        console.error("Invalid level data provided to initializeGame:", levelMapData);
        dom.setMessage("Error: Invalid level data!");
        trackError('invalid_level', state.currentLevelIndex + 1);
        state.setIsLoadingLevel(false); // Prevent getting stuck
        return;
    }

    const rows = state.currentLevelData.length;
    const cols = state.currentLevelData[0].length;

    // Find player start position and count fishes
    let fishCount = 0;
    let startPos = null;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            if (state.currentLevelData[y][x] === TILE_CODES.PLAYER) {
                startPos = { x, y };
                state.currentLevelData[y][x] = TILE_CODES.EMPTY; // Replace player start with empty tile
            } else if (state.currentLevelData[y][x] === TILE_CODES.FISH) {
                fishCount++;
            }
        }
    }

    if (!startPos) {
        console.error("Player start position 'P' not found in level data!");
        dom.setMessage("Error: Player start not found!");
        trackError('invalid_level', state.currentLevelIndex + 1);
        state.setIsLoadingLevel(false); // Prevent getting stuck in loading state
        return;
    }

    state.setPlayerPos(startPos.x, startPos.y);
    state.setTotalFishes(fishCount);

    // Pass dimensions to setupGameBoard
    dom.setupGameBoard(rows, cols);
    dom.renderGame();
    dom.updateStatus();
    dom.gameBoard.style.borderColor = '#555'; // Reset border color

    const message = state.audioStarted ? `Level ${state.currentLevelIndex + 1} started!` : `Level ${state.currentLevelIndex + 1}. Click or press key for sound.`;
    dom.setMessage(message);
}