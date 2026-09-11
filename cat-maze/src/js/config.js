// --- Game Configuration ---
export const TILE_SIZE = 40; // Base tile size in pixels (coordinates for grid & scaling)
export const EMOJI_MAP = {
    EMPTY: '', WALL: '🧱', CHIP: '🐟', WATER: '💧', FIRE: '🔥', // Using '.' for empty for JSON visibility
    KEY_RED: '🔑', DOOR_RED: '🚪', EXIT: '🏁', PLAYER: '🐈', // 5, 6, 7, P
    ICE: '🧊', // 8
    BOOTS_WATER: '🤿', // 9 - Water Boots (Using Diving Mask as single emoji)
    BOOTS_FIRE: '🥾', // A - Fire Boots (Using Hiking Boot as single emoji)
    // New color-coded mechanics
    KEY_BLUE: '🔵', DOOR_BLUE: '🚪', // B, C - Blue variants
    KEY_YELLOW: '🟡', DOOR_YELLOW: '🚪', // D, E - Yellow variants
    KEY_GREEN: '🟢', DOOR_GREEN: '🚪', // F, G - Green variants
    // Future mechanics (BUTTON: 'H', TOGGLE_WALL: 'I', CONVEYOR_UP: 'J'...)
};

// Define total number of levels available
export const TOTAL_LEVELS = 30; // Updated from 20 to 30 for new color mechanics