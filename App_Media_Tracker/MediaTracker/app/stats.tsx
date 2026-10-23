import { ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import PressableScale from '@/components/PressableScale';
import { BarChart, HBarRow } from '@/components/charts';
import Colors from '@/constants/Colors';
import { iconForType, mediaTypeLabelsES } from '@/constants/mediaTypes';
import { useColorScheme } from '@/hooks/useColorScheme';
import { MONTH_NAMES, StatsPeriod, computeStats } from '@/store/stats';
import { useStore } from '@/store/useStore';

const formatNumber = (n: number) => n.toLocaleString('es-ES');

export default function StatsScreen() {
  const items = useStore((state) => state.items);
  const colors = Colors[useColorScheme()];
  const [chosen, setChosen] = useState<StatsPeriod | undefined>();

  // Until the user picks one: the current year if something was finished in it, else the latest year, else everything.
  const years = useMemo(() => computeStats(items, 'all').years, [items]);
  const thisYear = new Date().getFullYear();
  const period: StatsPeriod = chosen ?? (years.includes(thisYear) ? thisYear : (years[0] ?? 'all'));
  const stats = useMemo(() => computeStats(items, period), [items, period]);

  const card = [styles.card, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }];
  const maxType = Math.max(1, ...stats.byType.map((t) => t.count));
  const maxStars = Math.max(1, ...stats.ratings.counts, stats.ratings.unrated);

  const tiles = [
    { value: formatNumber(stats.total), label: 'Terminados' },
    ...(stats.pages > 0 ? [{ value: formatNumber(stats.pages), label: 'Páginas leídas' }] : []),
    ...(stats.episodes > 0 ? [{ value: formatNumber(stats.episodes), label: 'Episodios vistos' }] : []),
    ...(stats.ratings.average !== undefined ? [{ value: stats.ratings.average.toFixed(1).replace('.', ','), label: 'Nota media' }] : []),
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Estadísticas', headerBackTitle: 'Bitácora', headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false }} />

      {years.length === 0 ? (
        <View style={styles.empty}>
          <SymbolView name={{ ios: 'chart.bar.fill', android: 'bar-chart', web: 'bar-chart' }} size={40} tintColor={colors.text + '60'} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aún no hay estadísticas</Text>
          <Text style={[styles.emptyText, { color: colors.text + '99' }]}>Cuando termines algo aparecerá aquí.</Text>
        </View>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periods} contentContainerStyle={{ gap: 8 }}>
            {(['all', ...years] as StatsPeriod[]).map((p) => {
              const active = p === period;
              return (
                <PressableScale
                  key={String(p)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={StyleSheet.flatten([styles.pill, { backgroundColor: active ? colors.tint : colors.cardBackground }])}
                  onPress={() => setChosen(p)}
                >
                  <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '600' }}>{p === 'all' ? 'Todo' : String(p)}</Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          <View style={styles.tiles}>
            {tiles.map((tile) => (
              <View key={tile.label} style={[styles.tile, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }]}>
                <Text style={[styles.tileValue, { color: colors.tint }]}>{tile.value}</Text>
                <Text style={[styles.tileLabel, { color: colors.text + '80' }]}>{tile.label}</Text>
              </View>
            ))}
          </View>

          <View style={card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>{period === 'all' ? 'Terminados por año' : 'Terminados por mes'}</Text>
            <BarChart
              unit={['elemento', 'elementos']}
              data={
                period === 'all'
                  ? stats.byYear.map((y) => ({ label: String(y.year).slice(2), name: String(y.year), value: y.count }))
                  : stats.byMonth.map((value, i) => ({ label: MONTH_NAMES[i][0], name: MONTH_NAMES[i], value }))
              }
            />
          </View>

          <View style={card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Por tipo</Text>
            {stats.byType.map(({ type, count }) => (
              <HBarRow
                key={type}
                label={mediaTypeLabelsES[type] ?? type}
                value={count}
                max={maxType}
                leading={<SymbolView name={iconForType(type)} size={16} tintColor={colors.text + 'B0'} />}
              />
            ))}
          </View>

          <View style={card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Notas</Text>
            {[5, 4, 3, 2, 1].map((stars) => (
              <HBarRow key={stars} label={'★'.repeat(stars)} value={stats.ratings.counts[stars - 1]} max={maxStars} />
            ))}
            <HBarRow label="Sin nota" value={stats.ratings.unrated} max={maxStars} />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  periods: { marginBottom: 16, flexGrow: 0 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16, backgroundColor: 'transparent' },
  tile: { flexGrow: 1, flexBasis: '45%', padding: 16, borderRadius: 16 },
  tileValue: { fontSize: 30, fontWeight: 'bold' },
  tileLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  card: { padding: 18, borderRadius: 16, marginBottom: 16 },
  cardTitle: { fontSize: 14, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 },
  empty: { alignItems: 'center', marginTop: 80, gap: 10, backgroundColor: 'transparent' },
  emptyTitle: { fontSize: 20, fontWeight: 'bold' },
  emptyText: { fontSize: 15 },
});
