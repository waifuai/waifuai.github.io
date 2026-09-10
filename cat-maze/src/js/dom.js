import * as state from './state.js';
import { EMOJI_MAP } from './config.js';

// --- DOM Elements ---
export const gameBoard = document.getElementById('game-board');
export const gameContainer = document.getElementById('game-container');
export const gameSection = document.getElementById('game-section');
export const gameArea = document.getElementById('game-area');
export const levelStatus = document.getElementById('level-status');
export const fishesStatus = document.getElementById('fishes-status');
export const keysStatus = document.getElementById('keys-status');
export const bootsStatus = document.getElementById('boots-status');
export const messageBox = document.getElementById('message-box');
export const levelMenuContainer = document.getElementById('level-menu');
export const btnResetView = document.getElementById('btn-reset-view');
export const btnToggleMapView = document.getElementById('btn-toggle-map-view');
export const controlsContainer = document.getElementById('controls');
export const levelSidebar = document.getElementById('level-sidebar');
export const btnZoomIn = document.getElementById('btn-zoom-in');
export const btnZoomOut = document.getElementById('btn-zoom-out');

// --- Tutorial Elements ---
export const tutorialOverlay = document.getElementById('tutorial-overlay');
export const tutorialContent = document.getElementById('tutorial-content');
export const tutorialStep = document.getElementById('tutorial-step');
export const tutorialPrevBtn = document.getElementById('tutorial-prev');
export const tutorialNextBtn = document.getElementById('tutorial-next');
export const tutorialSkipBtn = document.getElementById('tutorial-skip');

// --- Editor Elements ---
export const editorContainer = document.getElementById('editor-container');
export const editorToolbar = document.getElementById('editor-toolbar');
export const editorRowsInput = document.getElementById('editor-rows');
export const editorColsInput = document.getElementById('editor-cols');
export const editorResizeButton = document.getElementById('editor-resize');
export const editorExportButton = document.getElementById('editor-export');
export const editorLoadCurrentButton = document.getElementById('editor-load-current');
export const toggleEditorButton = document.getElementById('toggle-editor');
export const showTutorialButton = document.getElementById('show-tutorial');
export const editorBrushIndicator = document.getElementById('editor-brush-indicator');

// Check for missing elements and warn in console
const checkElements = () => {
    const elementMap = {
        gameBoard, gameContainer, gameSection, gameArea, levelStatus, fishesStatus, keysStatus, bootsStatus,
        messageBox, levelMenuContainer, btnResetView, btnToggleMapView, controlsContainer,
        levelSidebar, editorContainer, editorToolbar, editorRowsInput, editorColsInput,
        editorResizeButton, editorExportButton, editorLoadCurrentButton, toggleEditorButton,
        showTutorialButton, editorBrushIndicator, btnZoomIn, btnZoomOut, tutorialOverlay, tutorialContent,
        tutorialStep, tutorialPrevBtn, tutorialNextBtn, tutorialSkipBtn
    };
    
    for (const [name, element] of Object.entries(elementMap)) {
        if (!element) {
            console.warn(`DOM element '${name}' not found!`);
        }
    }
};

// Run element check on load
checkElements();

// --- Update Status Display ---
export function updateStatus() {
    if (state.isEditorMode) return;

    if (levelStatus) levelStatus.textContent = `Level: ${state.currentLevelIndex + 1}`;
    if (fishesStatus) fishesStatus.textContent = `Fishes: ${state.inventory.fishes} / ${state.totalFishes}`;

    let keysStr = `Keys: ${EMOJI_MAP.KEY_RED}(${state.inventory.keys.red})`;
    if (state.inventory.keys.blue > 0) keysStr += ` ${EMOJI_MAP.KEY_BLUE}(${state.inventory.keys.blue})`;
    if (state.inventory.keys.yellow > 0) keysStr += ` ${EMOJI_MAP.KEY_YELLOW}(${state.inventory.keys.yellow})`;
    if (state.inventory.keys.green > 0) keysStr += ` ${EMOJI_MAP.KEY_GREEN}(${state.inventory.keys.green})`;
    if (keysStatus) keysStatus.textContent = keysStr;

    let bootsStr = "Boots: ";
    if (state.inventory.boots.water) bootsStr += `${EMOJI_MAP.BOOTS_WATER} `;
    if (state.inventory.boots.fire) bootsStr += `${EMOJI_MAP.BOOTS_FIRE} `;
    if (!state.inventory.boots.water && !state.inventory.boots.fire) bootsStr += "None";
    if (bootsStatus) bootsStatus.textContent = bootsStr;
}

// --- Set Message Box Text ---
export function setMessage(msg) {
    if (messageBox) messageBox.textContent = msg;
}

// --- Game Board Setup ---
export function setupGameBoard(rows, cols) {
    if (!gameBoard) {
        console.error("Game board element not found!");
        return;
    }
    
    gameBoard.innerHTML = '';
    gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    gameBoard.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    gameBoard.style.aspectRatio = `${cols} / ${rows}`;

    // Clear any existing transform
    gameBoard.style.transform = '';

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tile = document.createElement('div');
            tile.id = `tile-${x}-${y}`;
            tile.classList.add('tile');
            tile.dataset.x = x;
            tile.dataset.y = y;
            gameBoard.appendChild(tile);
        }
    }
}

// --- Rendering ---
export function renderGame() {
    if (!gameBoard) {
        console.error("Game board element not found for rendering!");
        return;
    }
    
    const isEditor = state.isEditorMode;
    const gridData = isEditor ? state.editorGridData : state.currentLevelData;
    const playerVisible = !isEditor && !state.gameWon && !state.gameLost;

    if (!gridData || gridData.length === 0) {
        console.warn("No grid data available for rendering!");
        return;
    }

    const rows = gridData.length;
    const cols = gridData[0].length;

    // Render tiles
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const tileElement = document.getElementById(`tile-${x}-${y}`);
            if (!tileElement) continue;

            tileElement.className = 'tile'; // Reset classes
            if (isEditor) tileElement.classList.add('editor-mode');
            tileElement.textContent = ''; // Clear previous content

            let tileType = (gridData[y] && gridData[y][x]) ? gridData[y][x] : '0';
            let emoji = '';
            let tileClass = '';

            // Store the tile type as a data attribute for editor mode
            tileElement.dataset.tileType = tileType;

            // Determine emoji and class based on tile type
            switch (tileType) {
                case '0': tileClass = 'empty'; emoji = EMOJI_MAP.EMPTY; break;
                case '1': tileClass = 'wall'; emoji = EMOJI_MAP.WALL; break;
                case '2': tileClass = 'fish'; emoji = EMOJI_MAP.CHIP; break;
                case '3': tileClass = 'water'; emoji = EMOJI_MAP.WATER; break;
                case '4': tileClass = 'fire'; emoji = EMOJI_MAP.FIRE; break;
                case '5': tileClass = 'key-red'; emoji = EMOJI_MAP.KEY_RED; break;
                case '6': tileClass = 'door-red'; emoji = EMOJI_MAP.DOOR_RED; break;
                case '7': tileClass = 'exit'; emoji = EMOJI_MAP.EXIT; break;
                case '8': tileClass = 'ice'; emoji = EMOJI_MAP.ICE; break;
                case '9': tileClass = 'boots-water'; emoji = EMOJI_MAP.BOOTS_WATER; break;
                case 'A': tileClass = 'boots-fire'; emoji = EMOJI_MAP.BOOTS_FIRE; break;
                // New color-coded mechanics
                case 'B': tileClass = 'key-blue'; emoji = EMOJI_MAP.KEY_BLUE; break;
                case 'C': tileClass = 'door-blue'; emoji = EMOJI_MAP.DOOR_BLUE; break;
                case 'D': tileClass = 'key-yellow'; emoji = EMOJI_MAP.KEY_YELLOW; break;
                case 'E': tileClass = 'door-yellow'; emoji = EMOJI_MAP.DOOR_YELLOW; break;
                case 'F': tileClass = 'key-green'; emoji = EMOJI_MAP.KEY_GREEN; break;
                case 'G': tileClass = 'door-green'; emoji = EMOJI_MAP.DOOR_GREEN; break;
                case 'P':
                    tileClass = isEditor ? 'player-start' : 'empty';
                    emoji = isEditor ? EMOJI_MAP.PLAYER : EMOJI_MAP.EMPTY;
                    break;
                default: tileClass = 'empty'; emoji = EMOJI_MAP.EMPTY; break;
            }

            if (tileClass) tileElement.classList.add(tileClass);
            tileElement.innerHTML = `<span class="emoji-content">${emoji}</span>`;

            // Render player on top if applicable
            if (playerVisible && x === state.playerPos.x && y === state.playerPos.y) {
                tileElement.classList.add('player');
                tileElement.innerHTML = `<span class="emoji-content">${EMOJI_MAP.PLAYER}</span>`;
            }
        }
    }
    
    // Apply transform after rendering
    updateBoardTransform();
}

// --- Calculate and Apply Board Transform ---
function updateBoardTransform() {
    if (!gameBoard || !gameContainer) {
        console.error("Game board or container not available for transform!");
        return;
    }

    const containerRect = gameContainer.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height - 
        (document.getElementById('status-area')?.offsetHeight || 0) -
        (document.getElementById('message-box')?.offsetHeight || 0) -
        (document.getElementById('bottom-controls')?.offsetHeight || 0) - 40;

    // Get board natural dimensions
    const boardRect = gameBoard.getBoundingClientRect();
    const boardWidth = gameBoard.offsetWidth || boardRect.width;
    const boardHeight = gameBoard.offsetHeight || boardRect.height;

    if (!boardWidth || !boardHeight || !containerWidth || !containerHeight) {
        // Retry after a short delay if dimensions aren't ready
        setTimeout(() => updateBoardTransform(), 50);
        return;
    }

    let finalTranslateX = 0;
    let finalTranslateY = 0;
    let finalScale = 1;

    if (state.isEditorMode) {
        // Editor Mode: Use manual pan/zoom only
        finalScale = state.zoomLevel;
        finalTranslateX = state.panOffset.x;
        finalTranslateY = state.panOffset.y;
    } else if (state.mapViewMode) {
        // Full Map View Mode: Fit entire board to container
        const scaleX = containerWidth / boardWidth;
        const scaleY = containerHeight / boardHeight;
        
        // Use the smaller scale to ensure entire board fits, with some padding
        finalScale = Math.min(scaleX, scaleY) * 0.95;
        finalScale = Math.max(finalScale, 0.1); // Ensure minimum scale

        // Center the scaled board in the container
        const scaledBoardWidth = boardWidth * finalScale;
        const scaledBoardHeight = boardHeight * finalScale;
        
        finalTranslateX = (containerWidth - scaledBoardWidth) / 2;
        finalTranslateY = (containerHeight - scaledBoardHeight) / 2;
        
        // Update state to match the calculated values
        state.setZoomLevel(finalScale);
        state.setPanOffset(finalTranslateX, finalTranslateY);
    } else {
        // Player-Centered View Mode: Use manual pan/zoom with optional player centering
        finalScale = state.zoomLevel;
        finalTranslateX = state.panOffset.x;
        finalTranslateY = state.panOffset.y;

        // Optionally center on player if they're visible
        if (!state.gameWon && !state.gameLost && state.playerPos) {
            const playerTile = document.getElementById(`tile-${state.playerPos.x}-${state.playerPos.y}`);
            if (playerTile) {
                const tileRect = playerTile.getBoundingClientRect();
                const boardRect = gameBoard.getBoundingClientRect();
                
                // Calculate tile position relative to board
                const tileX = playerTile.offsetLeft;
                const tileY = playerTile.offsetTop;
                const tileWidth = playerTile.offsetWidth;
                const tileHeight = playerTile.offsetHeight;

                // Calculate centering offset
                const playerCenterX = containerWidth / 2 - (tileX + tileWidth / 2) * finalScale;
                const playerCenterY = containerHeight / 2 - (tileY + tileHeight / 2) * finalScale;

                finalTranslateX += playerCenterX;
                finalTranslateY += playerCenterY;
            }
        }
    }

    // Apply the transform
    gameBoard.style.transform = `translate(${finalTranslateX}px, ${finalTranslateY}px) scale(${finalScale})`;
}