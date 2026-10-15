const tintColorLight = '#4358D0'; 
const tintColorDark = '#7B8CE5'; // Lighter blue for dark mode

export default {
  light: {
    text: '#1C1C1E',
    background: '#F7F3ED', 
    cardBackground: '#E8E1D9', 
    tint: tintColorLight,
    tabIconDefault: '#8A8A8E',
    tabIconSelected: tintColorLight,
    surface: '#FFFFFF',
    // Depth for cards: a 1px ring plus a soft lift, instead of a border that fakes elevation.
    shadowBorder: '0 0 0 1px rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.06), 0 2px 4px 0 rgba(0,0,0,0.04)',
    // Neutral pure black/white (never a tinted neutral) so it doesn't read as dirt on the cover edge.
    imageOutline: 'rgba(0,0,0,0.1)',
  },
  dark: {
    text: '#EFEBE6', // Soft pastel white
    background: '#1F1D1B', // Very dark warm grey (pastel dark)
    cardBackground: '#332F2C', // Lighter warm grey for cards
    tint: tintColorDark,
    tabIconDefault: '#8A8A8E',
    tabIconSelected: tintColorDark,
    surface: '#292623', // Intermediate warm grey
    shadowBorder: '0 0 0 1px rgba(255,255,255,0.08)',
    imageOutline: 'rgba(255,255,255,0.1)',
  },
};
