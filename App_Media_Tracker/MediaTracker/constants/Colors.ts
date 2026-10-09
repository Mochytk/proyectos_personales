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
  },
  dark: {
    text: '#EFEBE6', // Soft pastel white
    background: '#1F1D1B', // Very dark warm grey (pastel dark)
    cardBackground: '#332F2C', // Lighter warm grey for cards
    tint: tintColorDark,
    tabIconDefault: '#8A8A8E',
    tabIconSelected: tintColorDark,
    surface: '#292623', // Intermediate warm grey
  },
};
