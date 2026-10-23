import { ScrollView, StyleSheet } from 'react-native';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from '@/components/Themed';
import PressableScale from '@/components/PressableScale';
import ItemCover, { rowCover } from '@/components/ItemCover';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { buildHighlights, computeStats } from '@/store/stats';
import { useStore } from '@/store/useStore';

/** "Tu año": the highlights of one year as big cards, in the spirit of a year-end recap. */
export default function YearSummaryScreen() {
  const { year: yearParam } = useLocalSearchParams<{ year: string }>();
  const year = Number(yearParam);
  const items = useStore((state) => state.items);
  const colors = Colors[useColorScheme()];

  const stats = useMemo(() => computeStats(items, year), [items, year]);
  const highlights = useMemo(() => buildHighlights(stats), [stats]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: `Tu ${year}`, headerBackTitle: 'Estadísticas', headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }} />

      {highlights.length === 0 ? (
        <Text style={[styles.empty, { color: colors.text + '99' }]}>No terminaste nada en {year}.</Text>
      ) : (
        <>
          <Text style={[styles.kicker, { color: colors.tint }]}>Tu {year} en Media Tracker</Text>

          {highlights.map((card, index) => (
            <View
              key={card.id}
              style={[
                styles.card,
                index === 0
                  ? { backgroundColor: colors.tint }
                  : { backgroundColor: colors.surface, boxShadow: colors.shadowBorder },
              ]}
            >
              <Text style={[styles.value, { color: index === 0 ? '#fff' : colors.tint }]} adjustsFontSizeToFit numberOfLines={1}>{card.value}</Text>
              <Text style={[styles.caption, { color: index === 0 ? '#ffffffE6' : colors.text }]}>{card.caption}</Text>
              {card.detail ? <Text style={[styles.detail, { color: colors.text + '99' }]}>{card.detail}</Text> : null}
            </View>
          ))}

          {stats.topRated.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }]}>
              <Text style={[styles.caption, { color: colors.text, marginBottom: 12 }]}>Lo mejor valorado</Text>
              {stats.topRated.map((item) => (
                <Link key={item.id} href={`/item/${item.id}`} asChild>
                  <PressableScale style={StyleSheet.flatten([styles.topRow])}>
                    <ItemCover type={item.type} posterUrl={item.posterUrl} style={rowCover} iconSize={20} />
                    <View style={styles.topText}>
                      <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>{item.title}</Text>
                      <Text style={{ color: colors.tint, fontSize: 15 }}>{'★'.repeat(Math.round(item.rating ?? 0))}</Text>
                    </View>
                  </PressableScale>
                </Link>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  empty: { fontSize: 16, textAlign: 'center', marginTop: 60 },
  kicker: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  card: { padding: 24, borderRadius: 20, marginBottom: 14 },
  value: { fontSize: 52, fontWeight: '800' },
  caption: { fontSize: 17, fontWeight: '600', marginTop: 2 },
  detail: { fontSize: 14, marginTop: 8 },
  topRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, backgroundColor: 'transparent' },
  topText: { flex: 1, backgroundColor: 'transparent' },
});
