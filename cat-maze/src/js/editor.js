import * as state from './state.js';
import * as dom from './dom.js';
import { EMOJI_MAP, TOTAL_LEVELS } from './config.js';
import { trackEvent } from './analytics.js';

// --- Editor State ---
let editorRows = 10; 
let editorCols = 10; 

// --- Helper function to fetch pristine level data ---
async function fetchPristineLevelData(levelIndex) {
    if (levelIndex < 0 || levelIndex >= TOTAL_LEVELS) {
        console.error(`Invalid level index for editor fetch: ${levelIndex}`);
        return null;
    }
    const levelNum = levelIndex + 1;
    const filename = `zlevel-${levelNum.toString().padStart(2, '0')}.json`;
    try {
        const response = await fetch(`src/levels/${filename}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Failed to load ${filename} for editor:`, error);
        return null;
    }
}

// --- Grid Creation ---
function createNewGrid(rows, cols) {
    const newGrid = [];
    for (let y = 0; y < rows; y++) {
        newGrid[y] = [];
        for (let x = 0; x < cols; x++) {
            newGrid[y][x] = '0';
        }
    }
    state.setEditorGridData(newGrid); 
}

// --- Setup and Render Helper ---
function setupEditorGridAndRender() {
    if (!state.editorGridData || state.editorGridData.length === 0) {
        console.warn("setupEditorGridAndRender called with empty editorGridData. Creating default.");
        const r = parseInt(dom.editorRowsInput.value, 10) || 10;
        const c = parseInt(dom.editorColsInput.value, 10) || 10;
        createNewGrid(r, c);
    }

    editorRows = state.editorGridData.length;
    editorCols = state.editorGridData[0].length;
    dom.editorRowsInput.value = editorRows;
    dom.editorColsInput.value = editorCols;
    
    dom.setupGameBoard(editorRows, editorCols);
    selectTool(state.editorBrush); 
    state.setPanOffset(0, 0);
    dom.renderGame(); 
}

// --- Initialization ---
export async function initializeEditor() {
    console.log("Initializing editor...");
    dom.setMessage("Initializing editor...");

    let messageSet = false;

    if (!state.editorGridData || state.editorGridData.length === 0) { 
        if (state.currentLevelIndex !== null && state.levelsLoaded && typeof state.currentLevelIndex === 'number') {
            const pristineData = await fetchPristineLevelData(state.currentLevelIndex);
            if (pristineData) {
                state.setEditorGridData(JSON.parse(JSON.stringify(pristineData))); 
                dom.setMessage("Editor: Current game level loaded.");
                messageSet = true;
            } else {
                createNewGrid(parseInt(dom.editorRowsInput.value, 10) || 10, parseInt(dom.editorColsInput.value, 10) || 10);
                dom.setMessage("Editor: New grid created (failed to load game level).");
                messageSet = true;
            }
        } else {
            createNewGrid(parseInt(dom.editorRowsInput.value, 10) || 10, parseInt(dom.editorColsInput.value, 10) || 10);
            dom.setMessage("Editor: New grid created.");
            messageSet = true;
        }
    } else {
        dom.setMessage("Editor: Existing session loaded.");
        messageSet = true;
    }
    
    setupEditorGridAndRender();
    
    if (!messageSet) { 
        dom.setMessage("Editor ready. Select a brush and click tiles to paint.");
    }
}

// --- Event Handlers ---
export function handleEditorClick(event) {
    if (!state.isEditorMode) return;

    const tileElement = event.target.closest('.tile');
    if (!tileElement) return;

    const x = parseInt(tileElement.dataset.x, 10);
    const y = parseInt(tileElement.dataset.y, 10);

    if (isNaN(x) || isNaN(y) || !state.editorGridData[y] || state.editorGridData[y][x] === undefined) {
        console.error("Invalid tile coordinates clicked:", x, y);
        return;
    }

    const brush = state.editorBrush;

    if (brush === 'P') {
        for (let r = 0; r < state.editorGridData.length; r++) {
            for (let c = 0; c < state.editorGridData[r].length; c++) {
                if (state.editorGridData[r][c] === 'P') {
                    state.editorGridData[r][c] = '0'; 
                }
            }
        }
    }
    state.editorGridData[y][x] = brush;
    dom.renderGame(); 
}

export function handleToolbarClick(event) {
    const button = event.target.closest('.tool-button');
    if (button && button.dataset.tile !== undefined) {
        selectTool(button.dataset.tile);
    }
}

function selectTool(tileType) {
    state.setEditorBrush(tileType);
    const buttons = dom.editorToolbar.querySelectorAll('.tool-button');
    buttons.forEach(btn => {
        if (btn.dataset.tile === tileType) {
            btn.classList.add('selected');
            dom.editorBrushIndicator.textContent = `Selected: ${btn.textContent}`;
        } else {
            btn.classList.remove('selected');
        }
    });
}

// --- Load/Export ---

export async function loadCurrentGameLevelIntoEditor() {
    if (state.currentLevelIndex !== null && state.levelsLoaded && typeof state.currentLevelIndex === 'number') {
        dom.setMessage("Loading current game level into editor...");
        const pristineData = await fetchPristineLevelData(state.currentLevelIndex);
        if (pristineData) {
            state.setEditorGridData(JSON.parse(JSON.stringify(pristineData))); 
            setupEditorGridAndRender(); 
            dom.setMessage("Editor: Current game level loaded.");
        } else {
            dom.setMessage("Editor: Failed to fetch current game level data.");
        }
    } else {
        dom.setMessage("Editor: No game level active to load.");
    }
}

export async function exportLevelJSON() { 
    if (!state.editorGridData || state.editorGridData.length === 0) {
        dom.setMessage("Editor grid is empty. Nothing to export.");
        return;
    }

    let playerCount = 0;
    for (let r = 0; r < state.editorGridData.length; r++) {
        for (let c = 0; c < state.editorGridData[r].length; c++) {
            if (state.editorGridData[r][c] === 'P') {
                playerCount++;
            }
        }
    }

    if (playerCount !== 1) {
        dom.setMessage(`Error: Level must have exactly one Player Start ('P'). Found ${playerCount}.`);
        return;
    }

    const jsonString = JSON.stringify(state.editorGridData, null, 2); 

    console.log("--- Exporting Level JSON ---");
    console.log(jsonString);
    console.log("----------------------------");

    let clipboardSuccess = false;
    let clipboardError = null;
    if (navigator.clipboard && window.isSecureContext) { 
        try {
            await navigator.clipboard.writeText(jsonString);
            clipboardSuccess = true;
        } catch (err) {
            console.error('Failed to copy level JSON to clipboard:', err);
            clipboardError = err; 
        }
    } else {
        console.warn('Clipboard API not available or context is not secure. Skipping copy.');
        clipboardError = new Error('Clipboard API not available/secure.'); 
    }

    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `custom-level-${timestamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url); 

    let message = "Level JSON exported & logged to console.";
    if (clipboardSuccess) {
        message += " Copied to clipboard!";
    } else if (clipboardError && clipboardError.message !== 'Clipboard API not available/secure.') {
        message += " Failed to copy to clipboard.";
    } else if (!navigator.clipboard || !window.isSecureContext) {
         message += " (Clipboard copy skipped - requires secure context).";
    }
    dom.setMessage(message);
    trackEvent('editor_level_exported', { rows: state.editorGridData.length, cols: state.editorGridData[0].length });
}

export function handleResize() {
    const newRows = parseInt(dom.editorRowsInput.value, 10);
    const newCols = parseInt(dom.editorColsInput.value, 10);

    if (isNaN(newRows) || isNaN(newCols) || newRows < 5 || newCols < 5 || newRows > 50 || newCols > 50) {
        dom.setMessage("Invalid dimensions. Rows/Cols must be between 5 and 50.");
        dom.editorRowsInput.value = state.editorGridData.length; 
        dom.editorColsInput.value = state.editorGridData[0].length; 
        return;
    }

    createNewGrid(newRows, newCols);
    setupEditorGridAndRender(); 
    dom.setMessage(`Grid resized to ${newRows}x${newCols}. Board cleared.`);
}