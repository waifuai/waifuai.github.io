import * as state from './state.js';
import * as dom from './dom.js';
import * as audio from './audio.js';
import { loadLevel, createLevelMenu } from './level.js';
import { movePlayer, initializeGame } from './game.js';
import { initializeEditor, handleEditorClick, handleToolbarClick, handleResize, exportLevelJSON, loadCurrentGameLevelIntoEditor } from './editor.js';
import { initializeTutorial, showTutorial, shouldShowTutorial } from './tutorial.js';
import { TOTAL_LEVELS } from './config.js';
import { resetView, setMapViewMode, setZoomLevel, setPanOffset } from './state.js';
import { trackEvent } from './analytics.js';

// --- Event Listeners ---
function handleInteraction(event) {
    // If editor is active, delegate click to editor handler
    if (state.isEditorMode && event.type === 'click' && dom.gameBoard.contains(event.target) && event.target !== dom.gameBoard) {
        handleEditorClick(event);
        return;
    }
    if (state.isEditorMode) {
        // Allow editor button clicks even when editor is active
        if (event.type === 'click' && event.target.closest('#editor-toolbar')) {
            handleToolbarClick(event);
        }
        // Don't process game interactions in editor mode
        return;
    }

    // If game is active, handle game interactions
    audio.startAudio(); // Try starting audio on any interaction

    // Prevent page scroll on arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
    }

    // Handle restart key 'r' separately, even if game is lost
    if (event.type === 'keydown' && event.key.toLowerCase() === 'r') {
        if (!state.isLoadingLevel) { // Prevent restart spam while loading
            dom.setMessage("Restarting level...");
            trackEvent('level_restarted', { level: state.currentLevelIndex + 1 });
            loadLevel(state.currentLevelIndex);
        }
        return; // Don't process other inputs if restarting
    }

    // Only process movement/button clicks if game is active
    if (!state.gameWon && !state.gameLost && !state.isLoadingLevel) {
        if (event.type === 'keydown') {
            switch (event.key.toLowerCase()) {
                case 'arrowup': case 'w': movePlayer(0, -1); break;
                case 'arrowdown': case 's': movePlayer(0, 1); break;
                case 'arrowleft': case 'a': movePlayer(-1, 0); break;
                case 'arrowright': case 'd': movePlayer(1, 0); break;
                // 'r' handled above
            }
        } else if (event.type === 'click' && event.target.tagName === 'BUTTON') {
            const targetId = event.target.id;
            if (targetId === 'btn-up') movePlayer(0, -1);
            else if (targetId === 'btn-down') movePlayer(0, 1);
            else if (targetId === 'btn-left') movePlayer(-1, 0);
            else if (targetId === 'btn-right') movePlayer(1, 0);
            else if (targetId === 'btn-reset-view') {
                resetView(); // Resets zoom, pan, and mapViewMode to default (true)
                updateMapViewButton(); // Update button appearance
                dom.renderGame(); // Re-render to apply reset
                dom.setMessage("View reset to default (full map).");
            }
            else if (targetId === 'btn-toggle-map-view') { // Added map view toggle handler
                toggleMapView();
            }
            else if (targetId === 'btn-zoom-in') {
                zoomBoard(1); // Zoom in
            } else if (targetId === 'btn-zoom-out') {
                zoomBoard(-1); // Zoom out
            }
            // Level menu clicks are handled by their own onclick handlers in level.js
        }
    }
}

// --- Mode Toggling ---
async function toggleEditorMode() {
    state.setIsEditorMode(!state.isEditorMode);
    trackEvent('editor_mode_toggled', { enabled: state.isEditorMode });
    if (state.isEditorMode) {
        dom.editorContainer.style.display = 'flex';
        dom.gameContainer.style.display = 'none';
        if (dom.levelSidebar) dom.levelSidebar.style.display = 'none';
        dom.toggleEditorButton.textContent = "Exit Editor";
        dom.gameBoard.classList.add('editor-mode');
        
        dom.editorContainer.insertBefore(dom.gameBoard, document.getElementById('editor-controls'));
        
        await initializeEditor(); // Await editor setup
        // Message is handled by initializeEditor
    } else {
        dom.editorContainer.style.display = 'none';
        dom.gameContainer.style.display = 'flex';
        if (dom.levelSidebar) dom.levelSidebar.style.display = 'flex';
        dom.toggleEditorButton.textContent = "Toggle Editor";
        dom.gameBoard.classList.remove('editor-mode');
        
        dom.gameContainer.insertBefore(dom.gameBoard, document.getElementById('message-box'));
        
        await loadLevel(state.currentLevelIndex); // Await level load
        resetView();
        updateMapViewButton();
        dom.setMessage(`Game Mode Activated. Level ${state.currentLevelIndex + 1}.`);
    }
}

// --- Map View Toggling ---
function toggleMapView() {
    setMapViewMode(!state.mapViewMode); // Toggle the state
    trackEvent('map_view_toggled', { mode: state.mapViewMode ? 'full_map' : 'player_centered' });
    updateMapViewButton(); // Update button appearance
    
    // Reset pan offset when switching to map view mode
    if (state.mapViewMode) {
        setPanOffset(0, 0);
        setZoomLevel(1.0);
    }
    
    dom.renderGame(); // Re-render to apply the new view mode transform
    dom.setMessage(state.mapViewMode ? "Switched to Full Map View." : "Switched to Player-Centered View.");
}

function updateMapViewButton() {
    if (!dom.btnToggleMapView) return; // Check if button exists
    
    // Update button text/icon based on the *current* mode
    if (state.mapViewMode) {
        dom.btnToggleMapView.textContent = '👤'; // Icon to switch TO player-centered
        dom.btnToggleMapView.title = "Switch to Player-Centered View";
    } else {
        dom.btnToggleMapView.textContent = '🗺️'; // Icon to switch TO full map
        dom.btnToggleMapView.title = "Switch to Full Map View";
    }
}

// --- Zoom and Pan Handlers ---
const ZOOM_INCREMENT = 0.2; // Amount to zoom per button click
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5.0;

function zoomBoard(direction) {
    // Allow zoom in editor mode or when not in map view mode
    if (state.mapViewMode && !state.isEditorMode) {
        dom.setMessage("Zoom disabled in Full Map View. Switch to Player-Centered View to zoom.");
        return;
    }

    // Calculate new zoom level
    const zoomFactor = direction > 0 ? (1 + ZOOM_INCREMENT) : (1 - ZOOM_INCREMENT);
    let newZoom = state.zoomLevel * zoomFactor;
    newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM)); // Clamp zoom level

    // If zoom didn't change (already at min/max), do nothing
    if (Math.abs(newZoom - state.zoomLevel) < 0.01) {
        dom.setMessage(direction > 0 ? "Maximum zoom reached." : "Minimum zoom reached.");
        return;
    }

    // Get container center for zoom centering
    const rect = dom.gameContainer.getBoundingClientRect();
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;

    // Calculate the point on the board currently at the container's center
    const boardCenterX = (containerCenterX - state.panOffset.x) / state.zoomLevel;
    const boardCenterY = (containerCenterY - state.panOffset.y) / state.zoomLevel;

    // Calculate new pan offset to keep the same board point centered
    const newPanX = containerCenterX - boardCenterX * newZoom;
    const newPanY = containerCenterY - boardCenterY * newZoom;

    // Update state
    setZoomLevel(newZoom);
    setPanOffset(newPanX, newPanY);

    // Re-apply transform
    dom.renderGame();
    
    dom.setMessage(`Zoom: ${Math.round(newZoom * 100)}%`);
}

function handleWheelZoom(event) {
    // Allow zoom in editor mode or when not in map view mode
    if (state.mapViewMode && !state.isEditorMode) return;

    // Prevent default page scroll
    event.preventDefault();

    const rect = dom.gameContainer.getBoundingClientRect();
    // Calculate mouse position relative to the container
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    // Calculate mouse position relative to the board before zoom
    const boardXBefore = (mouseX - state.panOffset.x) / state.zoomLevel;
    const boardYBefore = (mouseY - state.panOffset.y) / state.zoomLevel;

    // Determine zoom direction and calculate new zoom level
    const zoomFactor = event.deltaY < 0 ? 1.1 : 0.9;
    let newZoom = state.zoomLevel * zoomFactor;
    newZoom = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));

    // If zoom didn't change, do nothing
    if (Math.abs(newZoom - state.zoomLevel) < 0.01) return;

    // Calculate new pan offset to keep mouse point stationary
    const newPanX = mouseX - boardXBefore * newZoom;
    const newPanY = mouseY - boardYBefore * newZoom;

    // Update state
    setZoomLevel(newZoom);
    setPanOffset(newPanX, newPanY);

    // Re-apply transform
    dom.renderGame();
}

function handleMouseDown(event) {
    // Allow panning in editor mode or when not in map view mode
    if (state.mapViewMode && !state.isEditorMode) return;
    
    // Only drag with left mouse button
    if (event.button !== 0) return;
    
    // Don't initiate drag when clicking on buttons or tiles in editor mode
    if (event.target.tagName === 'BUTTON') return;
    if (state.isEditorMode && event.target.classList.contains('tile')) return;
    
    // Prevent dragging text/images
    event.preventDefault();

    state.setIsDragging(true);
    state.setDragStart(event.clientX, event.clientY, state.panOffset.x, state.panOffset.y);
    dom.gameBoard.style.transition = 'none'; // Disable transition during drag
    document.body.classList.add('dragging');

    // Add temporary listeners to window for mousemove and mouseup
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
}

function handleMouseMove(event) {
    if (!state.isDragging) return;

    // Calculate mouse movement since drag start
    const dx = event.clientX - state.dragStart.x;
    const dy = event.clientY - state.dragStart.y;

    // Calculate new pan offset based on initial offset + mouse delta
    const newPanX = state.dragStart.initialPanX + dx;
    const newPanY = state.dragStart.initialPanY + dy;

    setPanOffset(newPanX, newPanY);

    // Re-apply transform
    dom.renderGame();
}

function handleMouseUp(event) {
    if (event.button !== 0 || !state.isDragging) return;

    state.setIsDragging(false);
    dom.gameBoard.style.transition = 'transform 0.1s linear';
    document.body.classList.remove('dragging');

    // Remove temporary listeners
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
}

// --- Handle Touch Events for Mobile ---
function handleTouchStart(event) {
    // Allow panning in editor mode or when not in map view mode
    if (state.mapViewMode && !state.isEditorMode) return;
    
    // Ignore multi-touch
    if (event.touches.length !== 1) return;
    
    // Don't initiate drag when touching buttons or tiles in editor mode
    if (event.target.tagName === 'BUTTON') return;
    if (state.isEditorMode && event.target.classList.contains('tile')) return;
    
    const touch = event.touches[0];
    
    state.setIsDragging(true);
    state.setDragStart(touch.clientX, touch.clientY, state.panOffset.x, state.panOffset.y);
    dom.gameBoard.style.transition = 'none';
    document.body.classList.add('dragging');
}

function handleTouchMove(event) {
    if (!state.isDragging) return;
    
    // Prevent scrolling when dragging
    event.preventDefault();
    
    const touch = event.touches[0];
    
    const dx = touch.clientX - state.dragStart.x;
    const dy = touch.clientY - state.dragStart.y;
    
    const newPanX = state.dragStart.initialPanX + dx;
    const newPanY = state.dragStart.initialPanY + dy;
    
    setPanOffset(newPanX, newPanY);
    
    dom.renderGame();
}

function handleTouchEnd(event) {
    if (!state.isDragging) return;
    
    state.setIsDragging(false);
    dom.gameBoard.style.transition = 'transform 0.1s linear';
    document.body.classList.remove('dragging');
}

// --- Start Game on Load ---
async function startGame() {
    try {
        // Initialize tutorial
        initializeTutorial();
        
        // Initialize with proper view state
        state.resetView(); // Ensure we start with default view settings
        
        // Try loading the first level to see if files exist
        await loadLevel(0);
        
        // Set initial state of the map view toggle button
        updateMapViewButton();
        
        setTimeout(() => {
            // Add listener for mouse wheel zoom
            if (dom.gameContainer) {
                dom.gameContainer.addEventListener('wheel', handleWheelZoom, { passive: false });
                dom.gameContainer.addEventListener('mousedown', handleMouseDown);
                dom.gameContainer.addEventListener('touchstart', handleTouchStart);
                dom.gameContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
                dom.gameContainer.addEventListener('touchend', handleTouchEnd);
            }

            // Setup editor listeners
            if (dom.editorResizeButton) dom.editorResizeButton.addEventListener('click', handleResize);
            if (dom.editorExportButton) dom.editorExportButton.addEventListener('click', exportLevelJSON);
            if (dom.editorLoadCurrentButton) {
                dom.editorLoadCurrentButton.addEventListener('click', async () => { // Make async
                    // Use the new function from editor.js
                    await loadCurrentGameLevelIntoEditor(); 
                });
            }

            // Setup mode toggle listener
            if (dom.toggleEditorButton) dom.toggleEditorButton.addEventListener('click', toggleEditorMode);
            if (dom.showTutorialButton) {
                dom.showTutorialButton.addEventListener('click', () => {
                    audio.startAudio(); // Ensure audio context is ready
                    trackEvent('tutorial_shown', { source: 'manual' });
                    showTutorial();
                });
            }

            // Theme toggle
            const themeBtn = document.getElementById('toggle-theme');
            const applyTheme = (t) => {
                document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
                localStorage.setItem('catMazeTheme', t);
                if (themeBtn) { themeBtn.textContent = t === 'light' ? '🌙 Dark' : '☀️ Light'; }
            };
            const savedTheme = localStorage.getItem('catMazeTheme') || 'dark';
            applyTheme(savedTheme);
            themeBtn?.addEventListener('click', () => {
                const newTheme = (localStorage.getItem('catMazeTheme') || 'dark') === 'light' ? 'dark' : 'light';
                trackEvent('theme_toggled', { theme: newTheme });
                applyTheme(newTheme);
            });
        }, 100);
    } catch (error) {
        console.error("Error initializing game:", error);
        dom.setMessage("Error starting game. Please check console for details.");
    }
}

// --- Initialize ---
document.addEventListener('keydown', handleInteraction);
document.body.addEventListener('click', handleInteraction);

// Consolidate audio start attempts
let audioInitializedByInteraction = false;
function attemptAudioStart() {
    if (!audioInitializedByInteraction) {
        audio.startAudio();
        audioInitializedByInteraction = true;
        // Remove these specific listeners after first success to prevent multiple calls from body
        document.body.removeEventListener('click', attemptAudioStart);
        document.body.removeEventListener('touchstart', attemptAudioStart);
    }
}
document.body.addEventListener('click', attemptAudioStart);
document.body.addEventListener('touchstart', attemptAudioStart);

window.onload = startGame;