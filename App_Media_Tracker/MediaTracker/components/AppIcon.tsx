import React from 'react';
import { Platform, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SymbolView as NativeSymbolView } from 'expo-symbols';

/**
 * Cross-platform icon.
 * - iOS: native SF Symbols (expo-symbols).
 * - Web / Electron / Android: MaterialIcons from @expo/vector-icons. The web
 *   fallback of expo-symbols ignores some names (e.g. "live-tv") and does not
 *   always respect tintColor, so we render a bundled icon font instead.
 *
 * Same props as expo-symbols' SymbolView so it can be used as a drop-in.
 */
type IconName = string | { ios?: string; android?: string; web?: string };

interface Props {
  name: IconName;
  size?: number;
  tintColor?: import("react-native").ColorValue;
  style?: StyleProp<ViewStyle>;
}

// SF Symbol -> Material Icon, for places that pass only an iOS name.
const SF_TO_MATERIAL: Record<string, string> = {
  desktopcomputer: 'computer',
  'checkmark.circle': 'check-circle-outline',
  'checkmark.circle.fill': 'check-circle',
  checkmark: 'check',
  film: 'movie',
  tv: 'tv',
  'play.tv': 'live-tv',
  'book.closed': 'book',
  'book.closed.fill': 'book',
  'text.book.closed': 'menu-book',
  'text.book.closed.fill': 'menu-book',
  gamecontroller: 'sports-esports',
  calendar: 'event',
  'list.bullet': 'list',
  'square.stack.3d.up.fill': 'layers',
  magnifyingglass: 'search',
  plus: 'add',
  xmark: 'close',
  trash: 'delete-outline',
  'star.fill': 'star',
  'sun.max': 'wb-sunny',
  'chevron.left': 'chevron-left',
  'chevron.right': 'chevron-right',
  'chevron.down': 'expand-more',
  gearshape: 'settings',
};

// Material Symbols names that differ in the classic MaterialIcons set.
const MATERIAL_ALIASES: Record<string, string> = {
  'light-mode': 'wb-sunny',
  'sticky-note-2': 'sticky-note-2',
};

function resolveMaterialName(name: IconName): string {
  let raw: string | undefined;
  if (typeof name === 'string') {
    raw = SF_TO_MATERIAL[name] ?? name;
  } else {
    raw = name.web ?? name.android ?? (name.ios ? SF_TO_MATERIAL[name.ios] : undefined);
  }
  let resolved = (raw ?? '').replace(/_/g, '-');
  resolved = MATERIAL_ALIASES[resolved] ?? resolved;
  return resolved in MaterialIcons.glyphMap ? resolved : 'help-outline';
}

export function SymbolView({ name, size = 24, tintColor, style }: Props) {
  if (Platform.OS === 'ios') {
    return <NativeSymbolView name={name as any} size={size} tintColor={tintColor as any} style={style} />;
  }
  return (
    <MaterialIcons
      name={resolveMaterialName(name) as any}
      size={size}
      color={tintColor}
      style={style as any}
    />
  );
}

export default SymbolView;
