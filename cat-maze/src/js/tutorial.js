import * as state from './state.js';
import * as dom from './dom.js';
import { EMOJI_MAP } from './config.js';
import { trackEvent } from './analytics.js';

// Tutorial steps data
const tutorialSteps = [
    {
        title: "Welcome to Cat Maze!",
        content: `You are a clever cat <span class="tutorial-highlight">${EMOJI_MAP.PLAYER}</span> trying to collect all the fish and escape!<br><br>Use arrow keys or WASD to move, or tap the control buttons on mobile.`
    },
    {
        title: "Collect Fish",
        content: `Your goal is to collect all the fish <span class="tutorial-highlight">${EMOJI_MAP.CHIP}</span> in each level.<br><br>Walk over them to collect them automatically.`
    },
    {
        title: "Avoid Hazards",
        content: `Watch out for dangerous tiles!<br><br>Water <span class="tutorial-highlight">${EMOJI_MAP.WATER}</span> and Fire <span class="tutorial-highlight">${EMOJI_MAP.FIRE}</span> will end your game unless you have the right boots.`
    },
    {
        title: "Find Equipment",
        content: `Collect special boots to traverse hazards:<br><br>Flippers <span class="tutorial-highlight">${EMOJI_MAP.BOOTS_WATER}</span> let you swim through water<br>Fire Boots <span class="tutorial-highlight">${EMOJI_MAP.BOOTS_FIRE}</span> let you walk on fire`
    },
    {
        title: "Keys and Doors",
        content: `Some paths are blocked by doors <span class="tutorial-highlight">${EMOJI_MAP.DOOR_RED}</span><br><br>Find the matching key <span class="tutorial-highlight">${EMOJI_MAP.KEY_RED}</span> to unlock them!`
    },
    {
        title: "Ice Mechanics",
        content: `Ice tiles <span class="tutorial-highlight">${EMOJI_MAP.ICE}</span> are slippery!<br><br>You'll slide until you hit something that stops you. Plan your moves carefully!`
    },
    {
        title: "Reach the Exit",
        content: `Once you've collected all fish, head to the exit <span class="tutorial-highlight">${EMOJI_MAP.EXIT}</span> to complete the level!<br><br>The exit won't open until you have all the fish.`
    },
    {
        title: "Controls & Tips",
        content: `• Press 'R' to restart the current level<br>• Use zoom and pan controls for large levels<br>• Toggle between full map and player-centered view<br>• The editor lets you create custom levels!`
    },
    {
        title: "Ready to Play!",
        content: `You're all set! The tutorial can be accessed again from the settings.<br><br>Good luck collecting all the fish! 🐾`
    }
];

let currentStep = 0;

export function initializeTutorial() {
    if (!dom.tutorialOverlay) {
        console.warn("Tutorial overlay not found!");
        return;
    }

    // Add event listeners
    if (dom.tutorialPrevBtn) {
        dom.tutorialPrevBtn.addEventListener('click', previousStep);
    }
    if (dom.tutorialNextBtn) {
        dom.tutorialNextBtn.addEventListener('click', nextStep);
    }
    if (dom.tutorialSkipBtn) {
        dom.tutorialSkipBtn.addEventListener('click', skipTutorial);
    }
}

export function showTutorial() {
    if (!dom.tutorialOverlay) return;
    
    currentStep = 0;
    state.setShowTutorial(true);
    dom.tutorialOverlay.style.display = 'flex';
    updateTutorialStep();
}

export function hideTutorial(reason = 'completed') {
    if (!dom.tutorialOverlay) return;

    state.setShowTutorial(false);
    dom.tutorialOverlay.style.display = 'none';
    state.setTutorialCompleted(true);
    trackEvent('tutorial_closed', { reason, step: currentStep + 1 });
}

function updateTutorialStep() {
    if (!dom.tutorialStep || currentStep >= tutorialSteps.length) return;

    const step = tutorialSteps[currentStep];
    dom.tutorialStep.innerHTML = `
        <h3>${step.title}</h3>
        <div>${step.content}</div>
        <div style="margin-top: 15px; font-size: 0.8em; color: #aaa;">
            Step ${currentStep + 1} of ${tutorialSteps.length}
        </div>
    `;

    // Update button states
    if (dom.tutorialPrevBtn) {
        dom.tutorialPrevBtn.disabled = currentStep === 0;
        dom.tutorialPrevBtn.style.opacity = currentStep === 0 ? '0.5' : '1';
    }

    if (dom.tutorialNextBtn) {
        dom.tutorialNextBtn.textContent = currentStep === tutorialSteps.length - 1 ? 'Finish' : 'Next';
    }
}

function previousStep() {
    if (currentStep > 0) {
        currentStep--;
        updateTutorialStep();
    }
}

function nextStep() {
    if (currentStep < tutorialSteps.length - 1) {
        currentStep++;
        updateTutorialStep();
    } else {
        hideTutorial();
    }
}

function skipTutorial() {
    hideTutorial('skipped');
}

export function shouldShowTutorial() {
    return !state.checkTutorialStatus();
}