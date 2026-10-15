import { useState } from 'react';
import { Image, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { SymbolView } from '@/components/AppIcon';
import Colors from '@/constants/Colors';
import { iconForType } from '@/constants/mediaTypes';
import { useColorScheme } from '@/hooks/useColorScheme';

/** Portrait thumbnail used in rows (2:3, like a poster). */
export const rowCover: ViewStyle = { width: 42, height: 63, borderRadius: 8, marginRight: 15 };

interface Props {
  type: string;
  posterUrl?: string;
  /** Size, radius and margins; the cover fills whatever box this describes. */
  style?: StyleProp<ViewStyle>;
  /** Size of the fallback icon. */
  iconSize?: number;
}

/**
 * The cover of an item: its poster when it has one, otherwise the icon for its media type.
 * If the poster fails to load (offline, removed from the source) it falls back to the icon too.
 */
export default function ItemCover({ type, posterUrl, style, iconSize = 24 }: Props) {
  const colors = Colors[useColorScheme()];
  // Remember which URL failed rather than a boolean, so a new poster gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | undefined>();
  const showPoster = !!posterUrl && failedUrl !== posterUrl;

  return (
    <View style={[styles.box, { backgroundColor: colors.tint + '15' }, style]}>
      {showPoster ? (
        <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailedUrl(posterUrl)} />
      ) : (
        <SymbolView name={iconForType(type)} size={iconSize} tintColor={colors.tint} />
      )}
      {/* Inset 1px outline over the poster edge; an overlay so it neither changes layout nor hides under the image. */}
      {showPoster && <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.outline, { borderColor: colors.imageOutline }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  outline: { borderWidth: 1 },
});
