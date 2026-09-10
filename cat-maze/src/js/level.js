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

    // --- Set Emoji Scale based on Level --- 
    let emojiScale = 1.0; // Default scale
    const levelNum = levelIndex + 1;
    if (levelNum >= 1 && levelNum <= 4) {
        emojiScale = 2.5;
    } else if (levelNum >= 5 && levelNum <= 9) {
        emojiScale = 2.0;
    } else if (levelNum >= 10 && levelNum <= 20) { 
        emojiScale = 1.0;
    }
    // No longer have levels > 20 that need smaller scale or 'large-level' class
    document.documentElement.style.setProperty('--emoji-scale', emojiScale);
    // --- End Emoji Scale --- 

    // Remove large-level class if it was ever added, as it's no longer used
    if (dom.gameBoard) {
        dom.gameBoard.classList.remove('large-level');
    }

    if (!levelMapData) {
        state.setIsLoadingLevel(false);
        return; // Error message already set by fetchLevelData
    }

    if (!state.levelsLoaded) {
        trackEvent('game_started');
    }
    trackEvent('level_loaded', { level: levelNum });

    state.setCurrentLevelIndex(levelIndex);
    initializeGame(levelMapData); // Pass the map data directly

    // Reset view to ensure full map fits on screen
    state.resetView();
    
    // Clear any existing transform before measuring for a clean state
    if (dom.gameBoard) {
        dom.gameBoard.style.transform = '';
    }

    // Short delay to allow message to display before clearing loading flag
    setTimeout(() => {
        state.setIsLoadingLevel(false);
        // Set levelsLoaded flag after the first successful load
        if (!state.levelsLoaded) {
            state.setLevelsLoaded(true);
            createLevelMenu(); // Create menu once levels are confirmed loadable
        }
        
        // Re-render after a longer delay to ensure proper fit
        setTimeout(() => {
            state.setMapViewMode(true); // Force full map view mode
            dom.renderGame();
        }, 150);
    }, 150);
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