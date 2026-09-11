import * as state from './state.js';
import * as dom from './dom.js';
import * as audio from './audio.js';
import { TOTAL_LEVELS } from './config.js';
import { initializeGame } from './game.js';
import { trackEvent, trackError } from './analytics.js';

// --- Level Loading ---
async function fetchLevelData(levelIndex) {
    if (levelIndex < 0 || levelIndex >= TOTAL_LEVELS) {
        console.error(`Invalid level index: ${levelIndex}`);
        return null;
    }

    const levelNum = levelIndex + 1;
    const filename = `zlevel-${levelNum.toString().padStart(2, '0')}.json`;
    dom.setMessage(`Loading ${filename}...`);
    try {
        const response = await fetch(`src/levels/${filename}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const levelMapData = await response.json();
        console.log(`Level ${levelNum} loaded successfully.`);
        return levelMapData;
    } catch (error) {
        console.error(`Failed to load ${filename}:`, error);
        dom.setMessage(`Error loading Level ${levelNum}. Please check file exists and refresh.`);
        trackError('level_load', levelNum);
        return null; // Indicate failure
    }
}

export async function loadLevel(levelIndex) {
    if (state.isLoadingLevel) {
        console.warn(`Cannot load level while another level is loading.`);
        return;
    }
    
    if (levelIndex < 0 || levelIndex >= TOTAL_LEVELS) {
        console.warn(`Cannot load level ${levelIndex + 1}. Valid range is 1-${TOTAL_LEVELS}.`);
        dom.setMessage(`Invalid level number: ${levelIndex + 1}. Valid range is 1-${TOTAL_LEVELS}.`);
        return;
    }

    state.setIsLoadingLevel(true);
    dom.setMessage(`Loading Level ${levelIndex + 1}...`);

    const levelMapData = await fetchLevelData(levelIndex);

    if (!levelMapData) {
        state.setIsLoadingLevel(false);
        return; // Error message already set by fetchLevelData
    }

    if (!state.levelsLoaded) {
        trackEvent('game_started');
    }
    trackEvent('level_loaded', { level: levelNum });

    state.setCurrentLevelIndex(levelIndex);
    state.resetView(); // Reset view to full map mode
    initializeGame(levelMapData); // Pass the map data directly

    // Short delay to allow level message to display and level menu initialization
    setTimeout(() => {
        state.setIsLoadingLevel(false);
        // Set levelsLoaded flag after the first successful load
        if (!state.levelsLoaded) {
            state.setLevelsLoaded(true);
            createLevelMenu(); // Create menu once levels are confirmed loadable
        }
        dom.renderGame();
    }, 50);
}


// --- Go to Next Level or End Game ---
export function advanceLevel() {
     audio.playSound(audio.levelCompleteSynth, 'C5', '1n');
     trackEvent('level_completed', { level: state.currentLevelIndex + 1 });
     const nextLevelIndex = state.currentLevelIndex + 1;
     if (nextLevelIndex < TOTAL_LEVELS) {
         dom.setMessage(`Level ${state.currentLevelIndex + 1} complete! Loading next level...`);
         setTimeout(() => {
             loadLevel(nextLevelIndex);
         }, 1500);
     } else {
         dom.setMessage(`Purrfect! You beat all ${TOTAL_LEVELS} levels! Game Over!`);
         dom.gameBoard.style.borderColor = 'lime';
         audio.playSound(audio.winSynth, 'C4', '1n');
         audio.playSound(audio.winSynth, 'E4', '1n', '+0.2');
         audio.playSound(audio.winSynth, 'G4', '1n', '+0.4');
         audio.playSound(audio.winSynth, 'C5', '1n', '+0.6');
         state.setGameWon(true); // Set overall game won state
         trackEvent('game_completed', { total_levels: TOTAL_LEVELS });
         // Optionally disable controls or show a final screen
     }
}

// --- Level Menu ---
export function createLevelMenu() {
    // No need to check levelsLoaded here, called after first successful load
    if (!dom.levelMenuContainer) {
        console.error("Level menu container not found!");
        return;
    }
    
    dom.levelMenuContainer.innerHTML = ''; // Clear existing buttons
    
    for (let i = 0; i < TOTAL_LEVELS; i++) {
        const button = document.createElement('button');
        const levelNum = i + 1;
        button.textContent = `Level ${levelNum}`;
        button.onclick = () => {
            audio.startAudio(); // Ensure audio context is ready
            if (!state.isLoadingLevel && i !== state.currentLevelIndex) {
                loadLevel(i);
            } else if (i === state.currentLevelIndex) {
                dom.setMessage(`You are already on Level ${levelNum}.`);
            }
        };
        dom.levelMenuContainer.appendChild(button);
    }
}