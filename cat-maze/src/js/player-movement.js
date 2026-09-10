// player-movement.js
// Handles player movement and tile interactions

import * as state from './state.js';
import * as dom from './dom.js';
import * as audio from './audio.js';
import { TILE_CODES } from './game-constants.js';
import { handleIceSlide } from './ice-sliding.js';
import { advanceLevel } from './level.js';

/**
 * Moves the player in the specified direction
 * @param {number} dx - Change in x direction (-1, 0, or 1)
 * @param {number} dy - Change in y direction (-1, 0, or 1)
 */
export function movePlayer(dx, dy) {
    // Prevent movement if game is won, lost, loading OR IN EDITOR MODE
    if (state.gameWon || state.gameLost || state.isLoadingLevel || state.isEditorMode) return;
    // Add a check for valid level data length, crucial before accessing it
    if (!state.currentLevelData || state.currentLevelData.length === 0 || !state.currentLevelData[0]) {
        console.error("Cannot move player, level data is invalid.");
        return;
    }

    audio.startAudio(); // Ensure audio is started on first interaction

    const nextX = state.playerPos.x + dx;
    const nextY = state.playerPos.y + dy;

    // Boundary check
    if (nextX < 0 || nextX >= state.currentLevelData[0].length || nextY < 0 || nextY >= state.currentLevelData.length) {
        dom.setMessage("Can't move outside the area!");
        audio.playSound(audio.wallSynth, 'C2', '16n');
        return;
    }

    const targetTile = state.currentLevelData[nextY][nextX];
    let canMove = false;
    let message = "";
    let justWonLevel = false;
    let collectedItem = false; // Flag if an item was collected

    // Create temporary copies of state for modification within the switch
    let tempInventory = JSON.parse(JSON.stringify(state.inventory));
    // Use a shallow copy for level data; modifications will be directly on state.currentLevelData
    // If move fails, no change is made. If it succeeds, changes are kept.
    let tempLevelData = state.currentLevelData;

    switch (targetTile) {
        case TILE_CODES.EMPTY: // Empty
            canMove = true;
            message = "Moved.";
            // Play move sound only if actually moving to empty tile, not just starting slide
            audio.playSound(audio.moveSynth, 'C4', '16n');
            break;
        case TILE_CODES.WALL: // Wall
            canMove = false; message = "Meow! A wall."; audio.playSound(audio.wallSynth, 'E2', '16n'); break;
        case TILE_CODES.FISH: // Fish
            canMove = true; tempInventory.fishes++; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Got a fish!"; audio.playSound(audio.collectSynth, 'G4', '8n'); audio.playSound(audio.collectSynth, 'C5', '8n', '0.1'); collectedItem = true; break;
        case TILE_CODES.WATER: // Water
            if (tempInventory.boots.water) {
                canMove = true; message = "Splashed safely with flippers!"; audio.playSound(audio.moveSynth, 'A4', '16n');
            } else {
                canMove = false; message = "Need flippers to cross water!"; audio.playSound(audio.lockedSynth, 'F#3', '8n');
            }
            break;
        case TILE_CODES.FIRE: // Fire
            if (tempInventory.boots.fire) {
                canMove = true; message = "Walked on fire safely with boots!"; audio.playSound(audio.moveSynth, 'B4', '16n');
            } else {
                canMove = false; message = "Need fire boots to cross fire!"; audio.playSound(audio.lockedSynth, 'A3', '8n');
            }
            break;
        case TILE_CODES.KEY_RED: // Red Key
            canMove = true; tempInventory.keys.red++; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Found a red key!"; audio.playSound(audio.collectSynth, 'E5', '8n'); collectedItem = true; break;
        case TILE_CODES.DOOR_RED: // Red Door
            if (tempInventory.keys.red > 0) {
                canMove = true; tempInventory.keys.red--; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Unlocked the red door!"; audio.playSound(audio.unlockSynth, 'C4', '4n'); audio.playSound(audio.unlockSynth, 'G4', '4n', '0.1');
            } else {
                canMove = false; message = "Need a red key!"; audio.playSound(audio.lockedSynth, 'F#3', '8n');
            }
            break;
        case TILE_CODES.EXIT: // Exit
            if (tempInventory.fishes >= state.totalFishes) {
                canMove = true;
                // Don't set gameWon here, advanceLevel handles overall win state
                justWonLevel = true;
                message = `Level ${state.currentLevelIndex + 1} Complete!`;
            } else {
                canMove = false;
                const needed = state.totalFishes - tempInventory.fishes;
                message = `Need ${needed} more fish${needed !== 1 ? 'es' : ''} to exit!`;
                audio.playSound(audio.lockedSynth, 'A3', '8n');
            }
            break;
        case TILE_CODES.ICE: // Ice
            canMove = false; // Movement itself doesn't happen here, slide logic takes over
            message = "Whoosh! Sliding on ice!";
            audio.playSound(audio.iceSynth, '16n'); // Play ice sound immediately
            handleIceSlide(state.playerPos.x, state.playerPos.y, dx, dy); // Pass STARTING position and direction
            return; // Exit movePlayer early, handleIceSlide takes over
        case TILE_CODES.BOOTS_WATER: // Water Boots (Flippers)
            canMove = true; tempInventory.boots.water = true; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Got flippers!"; audio.playSound(audio.bootSynth, 'A4', '8n'); collectedItem = true; break;
        case TILE_CODES.BOOTS_FIRE: // Fire Boots
            canMove = true; tempInventory.boots.fire = true; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Got fire boots!"; audio.playSound(audio.bootSynth, 'B4', '8n'); collectedItem = true; break;
        // New color-coded mechanics
        case TILE_CODES.KEY_BLUE: // Blue Key
            canMove = true; tempInventory.keys.blue++; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Found a blue key!"; audio.playSound(audio.collectSynth, 'E4', '8n'); collectedItem = true; break;
        case TILE_CODES.DOOR_BLUE: // Blue Door
            if (tempInventory.keys.blue > 0) {
                canMove = true; tempInventory.keys.blue--; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Unlocked the blue door!"; audio.playSound(audio.unlockSynth, 'D4', '4n'); audio.playSound(audio.unlockSynth, 'A4', '4n', '0.1');
            } else {
                canMove = false; message = "Need a blue key!"; audio.playSound(audio.lockedSynth, 'F#2', '8n');
            }
            break;
        case TILE_CODES.KEY_YELLOW: // Yellow Key
            canMove = true; tempInventory.keys.yellow++; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Found a yellow key!"; audio.playSound(audio.collectSynth, 'F#4', '8n'); collectedItem = true; break;
        case TILE_CODES.DOOR_YELLOW: // Yellow Door
            if (tempInventory.keys.yellow > 0) {
                canMove = true; tempInventory.keys.yellow--; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Unlocked the yellow door!"; audio.playSound(audio.unlockSynth, 'E4', '4n'); audio.playSound(audio.unlockSynth, 'B4', '4n', '0.1');
            } else {
                canMove = false; message = "Need a yellow key!"; audio.playSound(audio.lockedSynth, 'G#2', '8n');
            }
            break;
        case TILE_CODES.KEY_GREEN: // Green Key
            canMove = true; tempInventory.keys.green++; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Found a green key!"; audio.playSound(audio.collectSynth, 'G#4', '8n'); collectedItem = true; break;
        case TILE_CODES.DOOR_GREEN: // Green Door
            if (tempInventory.keys.green > 0) {
                canMove = true; tempInventory.keys.green--; tempLevelData[nextY][nextX] = TILE_CODES.EMPTY; message = "Unlocked the green door!"; audio.playSound(audio.unlockSynth, 'F4', '4n'); audio.playSound(audio.unlockSynth, 'C5', '4n', '0.1');
            } else {
                canMove = false; message = "Need a green key!"; audio.playSound(audio.lockedSynth, 'A#2', '8n');
            }
            break;
        default:
            canMove = false; message = "Unknown tile!"; audio.playSound(audio.wallSynth, 'D2', '16n'); break;
    }

    if (canMove) {
        state.setPlayerPos(nextX, nextY);
        // Commit changes to state only if movement was successful
        state.setInventory(tempInventory);
        // state.setCurrentLevelData(tempLevelData); // No need to set, tempLevelData IS state.currentLevelData

        if (!justWonLevel) { // Only render immediately if not winning
            dom.renderGame();
        }
        dom.updateStatus();
    }
    dom.setMessage(message);

    if (justWonLevel) {
        dom.gameBoard.style.borderColor = 'gold';
        // Call advanceLevel to play success tone and go to next level
        advanceLevel();
    } else if (state.gameLost) {
        // Handle game over state visually and audibly (sound already played)
        dom.gameBoard.style.borderColor = 'red';
        dom.setMessage(message + " (Press 'R' to restart)");
        // Movement is already blocked by the check at the function start
    }
}