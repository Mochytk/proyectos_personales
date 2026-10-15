import { Pressable, StyleSheet } from 'react-native';
import PressableScale from '@/components/PressableScale';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatPosition, lastWatched, nextToWatch, seasonEnd, seasonProgress, toggleSeason } from '@/store/seasons';

interface Props {
  seasons: number[];
  watched: number; // episodes watched in total
  onChange: (watched: number) => void;
}

/** Progress for a series with seasons: current position, next-episode button and one row per season. */
export default function SeasonTracker({ seasons, watched, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const last = lastWatched(watched, seasons);
  const next = nextToWatch(watched, seasons);

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }]}>
      <Text style={[styles.title, { color: colors.text }]}>Progreso</Text>
      <Text style={[styles.position, { color: colors.text }]}>
        {last ? `Vas por ${formatPosition(last)}` : 'Aún no empiezas'}
      </Text>
      {!next && <Text style={[styles.hint, { color: colors.tint }]}>Terminaste todos los episodios</Text>}

      <View style={styles.buttons}>
        <PressableScale
          accessibilityLabel="Retroceder un episodio"
          disabled={watched <= 0}
          style={[styles.button, { flex: 1, backgroundColor: colors.cardBackground, opacity: watched <= 0 ? 0.4 : 1 }]}
          onPress={() => onChange(watched - 1)}
        >
          <Text style={{ color: colors.text, fontWeight: 'bold' }}>−1</Text>
        </PressableScale>
        <PressableScale
          accessibilityLabel="Marcar el siguiente episodio"
          disabled={!next}
          style={[styles.button, { flex: 3, backgroundColor: colors.tint, opacity: next ? 1 : 0.4 }]}
          onPress={() => onChange(watched + 1)}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>{next ? `Visto ${formatPosition(next)}` : 'Sin episodios pendientes'}</Text>
        </PressableScale>
      </View>

      {seasonProgress(watched, seasons).map(({ season, total, watched: done }) => {
        const finished = done === total;
        return (
          <Pressable
            key={season}
            accessibilityLabel={finished ? `Desmarcar la temporada ${season}` : `Marcar la temporada ${season} como vista`}
            style={[styles.seasonRow, { borderBottomColor: colors.cardBackground }]}
            onPress={() => onChange(toggleSeason(season, watched, seasons))}
          >
            <View style={styles.seasonHeader}>
              <Text style={{ color: colors.text, fontSize: 16 }}>Temporada {season}</Text>
              <Text style={{ color: finished ? colors.tint : colors.text + '90', fontWeight: finished ? '700' : '400', fontVariant: ['tabular-nums'] }}>
                {done}/{total}{finished ? ' ✓' : ''}
              </Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.text + '20' }]}>
              <View style={[styles.fill, { backgroundColor: colors.tint, width: `${Math.round((done / total) * 100)}%` }]} />
            </View>
          </Pressable>
        );
      })}
      <Text style={[styles.hint, { color: colors.text + '80', marginTop: 12 }]}>
        Toca una temporada para marcarla como vista. {seasonEnd(seasons.length, seasons)} episodios en total.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 20, padding: 20, borderRadius: 16, marginHorizontal: 20 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
  position: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
  hint: { fontSize: 13 },
  buttons: { flexDirection: 'row', gap: 10, marginVertical: 16, backgroundColor: 'transparent' },
  button: { alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12 },
  seasonRow: { paddingVertical: 12, borderBottomWidth: 1, backgroundColor: 'transparent' },
  seasonHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, backgroundColor: 'transparent' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
