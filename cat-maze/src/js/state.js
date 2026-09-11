// --- Game State ---
export let currentLevelIndex = 0;
export let playerPos = { x: 0, y: 0 };
export let inventory = {
    fishes: 0,
    keys: { red: 0, blue: 0, yellow: 0, green: 0 /* future colors */ },
    boots: { water: false, fire: false /* suction: false etc. */ }
};
export let totalFishes = 0;
export let gameWon = false;
export let gameLost = false;
export let audioStarted = false;
export let currentLevelData = [];
export let isLoadingLevel = false;
export let levelsLoaded = false; // Keep track if level index is loaded
export let isEditorMode = false; // Flag for editor mode
export let editorBrush = '0'; // Currently selected tile type for editor painting
export let editorGridData = []; // Data for the editor grid
export let zoomLevel = 1.0; // Default zoom level (1 = 100%)
export let panOffset = { x: 0, y: 0 }; // Manual pan offset (in pixels)
export let isDragging = false; // Is the user currently dragging the map?
export let dragStart = { x: 0, y: 0, initialPanX: 0, initialPanY: 0 }; // Starting position and initial pan for drag calculation
export let mapViewMode = true; // true = full-map view (DEFAULT), false = player-centered
export let tutorialCompleted = false; // Track if tutorial has been completed
export let showTutorial = false; // Track if tutorial should be shown

// Function to reset state for a new level
export function resetLevelState() {
    inventory.fishes = 0;
    inventory.keys.red = 0;
    inventory.keys.blue = 0;
    inventory.keys.yellow = 0;
    inventory.keys.green = 0;
    inventory.boots.water = false;
    inventory.boots.fire = false;
    gameWon = false;
    gameLost = false;
    totalFishes = 0;
    currentLevelData = [];
    // Don't reset currentLevelIndex here, it's managed by level loading
    // Don't reset audioStarted or levelsLoaded
}

// Functions to update state (optional, but good practice)
export function setPlayerPos(x, y) {
    playerPos.x = x;
    playerPos.y = y;
}

// Function to reset zoom, pan AND view mode to defaults
export function resetView() {
    zoomLevel = 1.0; // Reset zoom level to default
    panOffset = { x: 0, y: 0 }; // Reset pan to center
    mapViewMode = true; // Reset to default (full-map view)
    
    console.log("View reset to defaults");
}

export function setCurrentLevelIndex(index) {
    currentLevelIndex = index;
}

export function setInventory(newInventory) {
    inventory = { ...newInventory };
}

export function setTotalFishes(count) {
    totalFishes = count;
}

export function setGameWon(status) {
    gameWon = status;
}

export function setGameLost(status) {
    gameLost = status;
}

export function setAudioStarted(status) {
    audioStarted = status;
}

export function setCurrentLevelData(data) {
    try {
        currentLevelData = JSON.parse(JSON.stringify(data)); // Deep copy
    } catch (error) {
        console.error("Failed to deep copy level data:", error);
        currentLevelData = Array.isArray(data) ? [...data] : data; // Fallback to shallow copy
    }
}

export function setIsLoadingLevel(status) {
    isLoadingLevel = status;
}

export function setLevelsLoaded(status) {
    levelsLoaded = status;
}

export function setIsEditorMode(status) {
    isEditorMode = status;
}

export function setEditorBrush(tileType) {
    editorBrush = tileType;
}

export function setEditorGridData(data) {
    try {
        editorGridData = JSON.parse(JSON.stringify(data)); // Deep copy
    } catch (error) {
        console.error("Failed to deep copy editor grid data:", error);
        editorGridData = Array.isArray(data) ? [...data] : data; // Fallback to shallow copy
    }
}

export function setZoomLevel(level) {
    // Clamp zoom level to sensible limits (allow small scales for huge levels)
    zoomLevel = Math.max(0.05, Math.min(level, 5.0));
}

export function setPanOffset(x, y) {
    panOffset.x = x;
    panOffset.y = y;
}

export function setIsDragging(status) {
    isDragging = status;
}

export function setDragStart(x, y, initialPanX, initialPanY) {
    dragStart.x = x;
    dragStart.y = y;
    dragStart.initialPanX = initialPanX;
    dragStart.initialPanY = initialPanY;
}

export function setMapViewMode(status) {
    mapViewMode = status;
}

export function setTutorialCompleted(status) {
    tutorialCompleted = status;
    if (status) {
        localStorage.setItem('catMazeTutorialCompleted', 'true');
    }
}

export function setShowTutorial(status) {
    showTutorial = status;
}

export function checkTutorialStatus() {
    const completed = localStorage.getItem('catMazeTutorialCompleted');
    tutorialCompleted = completed === 'true';
    return tutorialCompleted;
}