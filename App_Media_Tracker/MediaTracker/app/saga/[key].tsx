import { useLocalSearchParams, Link, Stack } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import PressableScale from '@/components/PressableScale';
import ItemCover, { rowCover } from '@/components/ItemCover';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { nextBook, sagasOf } from '@/store/sagas';
import { useStore, MediaItem } from '@/store/useStore';

const statusLabel: Record<MediaItem['status'], string> = {
  unstarted: 'Por leer',
  in_progress: 'Leyendo',
  completed: 'Leído',
  abandoned: 'Abandonado',
};

export default function SagaScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const items = useStore((state) => state.items);
  const colors = Colors[useColorScheme()];

  const saga = useMemo(() => sagasOf(items).find((s) => s.key === key), [items, key]);

  if (!saga) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'Saga' }} />
        <Text style={[styles.empty, { color: colors.text + '99' }]}>Esta saga ya no tiene libros.</Text>
      </View>
    );
  }

  const next = nextBook(saga);
  const percent = Math.round((saga.completed / saga.books.length) * 100);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Stack.Screen
        options={{
          title: saga.name,
          headerBackTitle: 'Atrás',
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      />

      <Text style={[styles.title, { color: colors.text }]}>{saga.name}</Text>
      <Text style={[styles.summary, { color: colors.text + '99' }]}>
        {saga.completed} de {saga.books.length} {saga.books.length === 1 ? 'libro leído' : 'libros leídos'}
      </Text>
      <View style={[styles.track, { backgroundColor: colors.text + '20' }]}>
        <View style={[styles.fill, { backgroundColor: colors.tint, width: `${percent}%` }]} />
      </View>

      {next ? (
        <Link href={`/item/${next.id}`} asChild>
          <PressableScale style={StyleSheet.flatten([styles.nextCard, { backgroundColor: colors.tint + '18' }])}>
            <SymbolView name={{ ios: 'book.fill', android: 'menu-book', web: 'menu-book' }} size={22} tintColor={colors.tint} />
            <View style={styles.nextText}>
              <Text style={[styles.nextLabel, { color: colors.tint }]}>{next.status === 'in_progress' ? 'Sigue con' : 'Siguiente libro'}</Text>
              <Text style={{ color: colors.text, fontSize: 16, fontWeight: '600' }} numberOfLines={2}>{next.title}</Text>
            </View>
          </PressableScale>
        </Link>
      ) : (
        <Text style={[styles.done, { color: colors.tint }]}>Terminaste toda la saga</Text>
      )}

      {saga.books.map((book) => (
        <Link key={book.id} href={`/item/${book.id}`} asChild>
          <PressableScale style={StyleSheet.flatten([styles.row, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }])}>
            <ItemCover type={book.type} posterUrl={book.posterUrl} style={rowCover} iconSize={20} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                {book.saga?.number !== undefined ? `#${book.saga.number}  ` : ''}{book.title}
              </Text>
              <Text style={{ color: colors.text + '90', fontSize: 13 }}>{statusLabel[book.status]}</Text>
            </View>
            {book.status === 'completed' && (
              <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={20} tintColor={colors.tint} />
            )}
          </PressableScale>
        </Link>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  empty: { fontSize: 16, textAlign: 'center', marginTop: 60 },
  title: { fontSize: 26, fontWeight: 'bold' },
  summary: { fontSize: 15, marginTop: 4, marginBottom: 12 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: 20 },
  fill: { height: 6, borderRadius: 3 },
  nextCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, marginBottom: 20 },
  nextText: { flex: 1, backgroundColor: 'transparent' },
  nextLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  done: { fontSize: 16, fontWeight: '600', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, marginBottom: 10 },
  rowText: { flex: 1, backgroundColor: 'transparent' },
  rowTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
});
