import * as state from './state.js';
import { setMessage } from './dom.js';
import { trackError } from './analytics.js';

// --- Sound Effects ---
let moveSynth, collectSynth, wallSynth, unlockSynth, lockedSynth, winSynth, levelCompleteSynth, loseSynth, bootSynth, iceSynth;

export function initializeSynths() {
    try {
        moveSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
        collectSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.2 } }).toDestination();
        wallSynth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, volume: -10, envelope: { attack: 0.01, decay: 0.1, sustain: 0, release: 0.1 } }).toDestination();
        unlockSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.05, decay: 0.3, sustain: 0.2, release: 0.5 } }).toDestination();
        lockedSynth = new Tone.Synth({ oscillator: { type: 'square' }, volume: -8, envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.1 } }).toDestination();
        winSynth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.1, decay: 0.5, sustain: 0.3, release: 1.0 } }).toDestination();
        levelCompleteSynth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.1, decay: 0.8, sustain: 0.2, release: 1.0 } }).toDestination();
        loseSynth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, volume: -5, envelope: { attack: 0.1, decay: 1.0, sustain: 0, release: 0.5 } }).toDestination();
        bootSynth = new Tone.Synth({ oscillator: { type: 'sine' }, volume: -6, envelope: { attack: 0.02, decay: 0.3, sustain: 0.1, release: 0.3 } }).toDestination();
        
        // Correct NoiseSynth initialization
        iceSynth = new Tone.NoiseSynth({
            noise: { type: 'white' },
            volume: -15,
            envelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 }
        }).toDestination();
        
        console.log("Synthesizers initialized successfully");
    } catch (error) {
        console.error("Failed to initialize synthesizers:", error);
    }
}

export function playSound(synth, noteOrDuration, duration = '8n', time = '+0.01') {
    // Ensure time is slightly ahead to prevent scheduling issues
    const scheduledTime = Tone.now() + parseFloat(time);

    if (state.audioStarted && Tone.context && Tone.context.state === 'running' && synth) {
        try {
            // Check if the synth is a NoiseSynth, which has a different signature
            if (synth instanceof Tone.NoiseSynth) {
                // NoiseSynth doesn't take a note, the first arg is duration
                const noiseDuration = typeof noteOrDuration === 'string' && noteOrDuration.match(/^[0-9]+[ntm]$/) ? noteOrDuration : '16n';
                synth.triggerAttackRelease(noiseDuration, scheduledTime);
            } else if (noteOrDuration) { // For other synths, note is required
                synth.triggerAttackRelease(noteOrDuration, duration, scheduledTime);
            } else {
                console.warn("playSound called for non-NoiseSynth without a note.");
            }
        } catch (error) {
            console.error("Error playing sound:", error);
        }
    }
}

export async function startAudio() {
    if (!state.audioStarted && typeof Tone !== 'undefined') {
        try {
            await Tone.start();
            initializeSynths(); // Initialize synths after audio context is running
            state.setAudioStarted(true);
            console.log("Audio context started");
            setMessage("Sound enabled! Collect all the fishes!");
        } catch (e) {
            console.error("Failed to start audio context:", e);
            setMessage("Could not enable sound. Click or press key to try again.");
            trackError('audio', 'context_start_failed');
            state.setAudioStarted(false); // Ensure state reflects failure
        }
    }
}

export function startBackgroundMusic() {
    // Background music disabled - text/code-only repo
}

export function stopBackgroundMusic() {
    // Background music disabled - text/code-only repo
}

// Export individual synths if they need to be accessed directly (e.g., for complex sequences)
export { moveSynth, collectSynth, wallSynth, unlockSynth, lockedSynth, winSynth, levelCompleteSynth, loseSynth, bootSynth, iceSynth };