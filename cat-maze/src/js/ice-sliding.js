// ice-sliding.js
// Handles ice sliding mechanics and interactions

import * as state from './state.js';
import * as dom from './dom.js';
import * as audio from './audio.js';
import { TILE_CODES, GAME_CONSTANTS } from './game-constants.js';
import { advanceLevel } from './level.js';

/**
 * Handles the ice sliding sequence when player moves onto ice
 * @param {number} startX - Starting X position before sliding
 * @param {number} startY - Starting Y position before sliding
 * @param {number} dx - Direction of slide horizontally
 * @param {number} dy - Direction of slide vertically
 */
function handleIceSlide(startX, startY, dx, dy) {
    if (state.isEditorMode) return; // Prevent sliding in editor mode
    // Add a check for valid level data length
    if (!state.currentLevelData || state.currentLevelData.length === 0 || !state.currentLevelData[0]) {
        console.error("Cannot slide, level data is invalid.");
        return;
    }

    // The player is currently at startX, startY.
    // The slide attempts to move to the first ice tile at startX + dx, startY + dy
    let nextSlideX = startX + dx;
    let nextSlideY = startY + dy;
    let slideInterval;
    let slideStep = 0;
    let visitedPositions = new Set(); // Track visited positions to prevent infinite loops

    // Add current position to visited set
    visitedPositions.add(`${startX},${startY}`);

    // Immediately update position to the first ice tile if it's valid ice
    if (nextSlideX >= 0 && nextSlideX < state.currentLevelData[0].length &&
        nextSlideY >= 0 && nextSlideY < state.currentLevelData.length &&
        state.currentLevelData[nextSlideY][nextSlideX] === TILE_CODES.ICE) {

        state.setPlayerPos(nextSlideX, nextSlideY);
        dom.renderGame(); // Show player on the first ice tile
        dom.updateStatus();
        dom.setMessage("Sliding..."); // Initial sliding message

        // Add this position to visited set
        visitedPositions.add(`${nextSlideX},${nextSlideY}`);
    } else {
        // We didn't even enter the ice tile (e.g., slid into a wall immediately)
        dom.setMessage("Stopped immediately!");
        audio.playSound(audio.wallSynth, 'E2', '16n');
        // Player position remains startX, startY
        dom.renderGame();
        dom.updateStatus();
        return; // No slide happens
    }

    const slide = () => {
        // Safety check to prevent infinite or excessive slides
        if (slideStep >= GAME_CONSTANTS.MAX_SLIDE_STEPS) {
            clearInterval(slideInterval);
            dom.setMessage("Slide ended (safety limit reached).");
            return;
        }

        // At the start of interval, player is on (nextSlideX, nextSlideY) which is ice
        const currentX = nextSlideX; // Where the player is now
        const currentY = nextSlideY;

        const targetX = currentX + dx; // Where the player tries to slide next
        const targetY = currentY + dy;

        // Check for loop by seeing if we've visited this position before
        const targetPosKey = `${targetX},${targetY}`;
        if (visitedPositions.has(targetPosKey)) {
            clearInterval(slideInterval);
            dom.setMessage("Slide stopped (loop detected).");
            return;
        }

        // Check boundaries
        if (targetX < 0 || targetX >= state.currentLevelData[0].length || targetY < 0 || targetY >= state.currentLevelData.length) {
            clearInterval(slideInterval);
            // Final position is the last valid tile (currentX, currentY)
            dom.setMessage("Stopped at the edge!");
            audio.playSound(audio.wallSynth, 'C2', '16n');
            // No position update needed here, already on currentX, currentY
            return;
        }

        const targetTile = state.currentLevelData[targetY][targetX];

        // Check for stopping conditions (Walls, Doors, etc.)
        // Add other non-ice, non-empty tiles that should stop sliding immediately
        if (targetTile === TILE_CODES.WALL || targetTile === TILE_CODES.DOOR_RED /* Add other stoppers */
            || (targetTile === TILE_CODES.WATER && !state.inventory.boots.water)
            || (targetTile === TILE_CODES.FIRE && !state.inventory.boots.fire)) {
            clearInterval(slideInterval);
            // Final position is the last valid tile (currentX, currentY)
            if (targetTile === TILE_CODES.WATER && !state.inventory.boots.water) {
                dom.setMessage("Stopped before water. Need flippers!");
                audio.playSound(audio.lockedSynth, 'F#3', '8n');
            } else if (targetTile === TILE_CODES.FIRE && !state.inventory.boots.fire) {
                dom.setMessage("Stopped before fire. Need fire boots!");
                audio.playSound(audio.lockedSynth, 'A3', '8n');
            } else {
                dom.setMessage("Stopped by an obstacle!");
                audio.playSound(audio.wallSynth, 'E2', '16n');
            }
            return;
        }

        // Move to the next tile in the slide sequence
        nextSlideX = targetX;
        nextSlideY = targetY;
        state.setPlayerPos(nextSlideX, nextSlideY); // Update player position visually during slide

        // Add this position to visited set
        visitedPositions.add(targetPosKey);

        let interactionMessage = "";
        let interactionSound = null;
        let soundNote = 'C4';
        let collectedItem = false;
        let tempInventory = JSON.parse(JSON.stringify(state.inventory)); // Get current inventory for interaction check

        // Handle interactions on the tile *during* the slide
        const tileLandedOn = state.currentLevelData[nextSlideY][nextSlideX]; // Tile we just landed on
        switch (tileLandedOn) {
            case TILE_CODES.FISH: // Fish
                tempInventory.fishes++; state.currentLevelData[nextSlideY][nextSlideX] = TILE_CODES.EMPTY; interactionMessage = " (Got a fish!)"; interactionSound = audio.collectSynth; soundNote = 'G4'; collectedItem = true; break;
            case TILE_CODES.KEY_RED: // Red Key
                tempInventory.keys.red++; state.currentLevelData[nextSlideY][nextSlideX] = TILE_CODES.EMPTY; interactionMessage = " (Got a red key!)"; interactionSound = audio.collectSynth; soundNote = 'E5'; collectedItem = true; break;
            case TILE_CODES.BOOTS_WATER: // Water Boots
                tempInventory.boots.water = true; state.currentLevelData[nextSlideY][nextSlideX] = TILE_CODES.EMPTY; interactionMessage = " (Got flippers!)"; interactionSound = audio.bootSynth; soundNote = 'A4'; collectedItem = true; break;
            case TILE_CODES.BOOTS_FIRE: // Fire Boots
                tempInventory.boots.fire = true; state.currentLevelData[nextSlideY][nextSlideX] = TILE_CODES.EMPTY; interactionMessage = " (Got fire boots!)"; interactionSound = audio.bootSynth; soundNote = 'B4'; collectedItem = true; break;
            // Add cases for other collectibles or interactables on ice path
        }

        // Commit inventory changes if an item was collected during the slide
        if (collectedItem) {
            state.setInventory(tempInventory);
            dom.updateStatus(); // Update status immediately after collection
        }

        dom.renderGame(); // Render each step of the slide

        if (interactionSound) {
            audio.playSound(interactionSound, soundNote, '8n');
        }

        // If the tile we landed on is NOT ice, stop sliding after this move
        if (tileLandedOn !== TILE_CODES.ICE) {
            clearInterval(slideInterval);
            dom.setMessage("Stopped sliding." + interactionMessage);
            // Check for hazards *after* stopping on a non-ice tile
            if (tileLandedOn === TILE_CODES.WATER && !state.inventory.boots.water) { // Check committed inventory
                // Revert to previous safe tile and stop
                state.setPlayerPos(currentX, currentY);
                dom.renderGame();
                dom.setMessage("Stopped before water. Need flippers!");
                audio.playSound(audio.lockedSynth, 'F#3', '8n');
                dom.gameBoard.style.borderColor = '#555';
            } else if (tileLandedOn === TILE_CODES.FIRE && !state.inventory.boots.fire) { // Check committed inventory
                // Revert to previous safe tile and stop
                state.setPlayerPos(currentX, currentY);
                dom.renderGame();
                dom.setMessage("Stopped before fire. Need fire boots!");
                audio.playSound(audio.lockedSynth, 'A3', '8n');
                dom.gameBoard.style.borderColor = '#555';
            } else if (tileLandedOn === TILE_CODES.EXIT) { // Check for exit after stopping
                if (state.inventory.fishes >= state.totalFishes) { // Check committed inventory
                    // Don't set gameWon here, advanceLevel handles it
                    dom.setMessage(`Level ${state.currentLevelIndex + 1} Complete!`);
                    dom.gameBoard.style.borderColor = 'gold';
                    // Call advanceLevel to play success tone and go to next level
                    advanceLevel();
                } else {
                    const needed = state.totalFishes - state.inventory.fishes;
                    dom.setMessage(`Stopped at exit! Need ${needed} more fish${needed !== 1 ? 'es' : ''}!`);
                    audio.playSound(audio.lockedSynth, 'A3', '8n');
                }
            } else if (tileLandedOn === TILE_CODES.EMPTY && interactionMessage === "") { // Stopped on empty tile
                audio.playSound(audio.moveSynth, 'C4', '16n'); // Play regular step sound
            }
            return;
        }

        // Continue sliding - play sound periodically
        slideStep++;
        if (slideStep % 2 === 0) { // Play sound every other step to avoid spamming
            audio.playSound(audio.iceSynth, '16n'); // Duration only
        }
    };

    // Start the sliding interval
    slideInterval = setInterval(slide, GAME_CONSTANTS.SLIDE_INTERVAL); // Adjust speed as needed
}

// Export the function for use in other modules
export { handleIceSlide };