import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation, Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useStore, MediaItem } from '@/store/useStore';
import { DayBucket, bucketFor } from '@/store/dates';

const BUCKETS: { key: DayBucket; label: string }[] = [
  { key: 'overdue', label: 'Vencidos' },
  { key: 'today', label: 'Hoy' },
  { key: 'tomorrow', label: 'Mañana' },
  { key: 'week', label: 'Esta semana' },
  { key: 'later', label: 'Más adelante' },
  { key: 'undated', label: 'Sin fecha' },
];

export default function PlannerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const navigation = useNavigation();

  const allItems = useStore(state => state.items);
  const updateItem = useStore(state => state.updateItem);

  // Re-group every minute so items move to "Vencidos" / "Hoy" without reopening the app.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  
  const upcomingItems = useMemo(() => {
    return allItems
      .filter(item => item.status !== 'completed' && (item.dueDate !== undefined || item.type === 'event' || item.type === 'task'))
      .sort((a, b) => (a.dueDate ?? Infinity) - (b.dueDate ?? Infinity) || a.updatedAt - b.updatedAt);
  }, [allItems]);

  const groups = useMemo(() => {
    return BUCKETS
      .map(({ key, label }) => ({ key, label, items: upcomingItems.filter(item => bucketFor(item, now) === key) }))
      .filter(group => group.items.length > 0);
  }, [upcomingItems, now]);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
      headerTitle: 'Planificador',
      headerTitleStyle: { fontWeight: '600' },
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Link href="/searchModal" asChild>
            <Pressable style={styles.headerButton}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.text} />
            </Pressable>
          </Link>
          <Link href="/modal" asChild>
            <Pressable style={styles.headerButton}>
              <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={24} tintColor={colors.text} />
            </Pressable>
          </Link>
        </View>
      ),
    });
  }, [navigation, colors]);

  const formatDue = (item: MediaItem) => {
    const date = new Date(item.dueDate!);
    const day = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    return item.dueHasTime ? `${day}, ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : day;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {upcomingItems.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateIconContainer, { backgroundColor: colors.cardBackground }]}>
            <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={40} tintColor={colors.text + '80'} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Nada Programado</Text>
          <Text style={[styles.emptyStateSubtitle, { color: colors.text + '99' }]}>
            Usa el Planificador para llevar el control de próximos lanzamientos, tareas y eventos.
          </Text>
          <Link href="/modal" asChild>
            <Pressable style={StyleSheet.flatten([styles.createButton, { backgroundColor: colors.tint + '20' }])}>
              <Text style={StyleSheet.flatten([styles.createButtonText, { color: colors.tint }])}>Añadir un Evento</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={styles.listContainer}>
          {groups.map(group => (
            <View key={group.key}>
              <Text style={[styles.sectionTitle, { color: group.key === 'overdue' ? '#ff3b30' : colors.text }]}>{group.label}</Text>
              {group.items.map(item => (
                <View key={item.id} style={StyleSheet.flatten([styles.card, { backgroundColor: colors.cardBackground }])}>
                  <Pressable
                    accessibilityLabel="Marcar como terminado"
                    style={[styles.checkButton, { borderColor: colors.tint }]}
                    onPress={() => updateItem(item.id, { status: 'completed' })}
                  />
                  <Link href={`/item/${item.id}`} asChild>
                    <Pressable style={styles.cardContent}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.cardSubtitle, { color: group.key === 'overdue' ? '#ff3b30' : colors.text + '90' }]}>
                        {item.dueDate !== undefined ? formatDue(item) : (item.subtitle || 'Sin fecha')}
                        {item.remind ? '  🔔' : ''}
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  content: { flexGrow: 1, paddingBottom: 40 },
  headerButton: { paddingHorizontal: 10, backgroundColor: 'transparent' },
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyStateIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyStateTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  emptyStateSubtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 30, marginBottom: 30, lineHeight: 22 },
  createButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  createButtonText: { fontSize: 16, fontWeight: '600' },
  listContainer: { marginTop: 20 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, marginTop: 10 },
  checkButton: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, marginRight: 15 },
  card: { flexDirection: 'row', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center' },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  cardContent: { flex: 1, backgroundColor: 'transparent' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13 },
});
