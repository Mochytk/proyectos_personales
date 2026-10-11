import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation, Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { DayBucket } from '@/store/dates';
import { PlannerEntry, buildPlannerEntries, groupEntries } from '@/store/planner';
import { formatPosition } from '@/store/seasons';

const LABELS: Record<DayBucket, string> = {
  overdue: 'Vencidos',
  today: 'Hoy',
  tomorrow: 'Mañana',
  week: 'Esta semana',
  later: 'Más adelante',
  undated: 'Sin fecha',
};

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
  
  const groups = useMemo(() => groupEntries(buildPlannerEntries(allItems, now), now), [allItems, now]);

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

  const formatDue = ({ date, hasTime }: PlannerEntry) => {
    const when = new Date(date!);
    const day = when.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    return hasTime ? `${day}, ${when.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : day;
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {groups.length === 0 ? (
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
              <Text style={[styles.sectionTitle, { color: group.key === 'overdue' ? '#ff3b30' : colors.text }]}>{LABELS[group.key]}</Text>
              {group.entries.map(entry => { const { item, premiere } = entry; return (
                <View key={item.id} style={StyleSheet.flatten([styles.card, { backgroundColor: colors.cardBackground }])}>
                  {premiere ? (
                    // A series premiere is not something to tick off: the whole series would be marked finished.
                    <SymbolView name={{ ios: 'play.circle', android: 'play-circle-outline', web: 'play-circle-outline' }} size={26} tintColor={colors.tint} style={styles.premiereIcon} />
                  ) : (
                    <Pressable
                      accessibilityLabel="Marcar como terminado"
                      style={[styles.checkButton, { borderColor: colors.tint }]}
                      onPress={() => updateItem(item.id, { status: 'completed' })}
                    />
                  )}
                  <Link href={`/item/${item.id}`} asChild>
                    <Pressable style={styles.cardContent}>
                      <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.cardSubtitle, { color: group.key === 'overdue' ? '#ff3b30' : colors.text + '90' }]}>
                        {premiere ? `Estreno ${formatPosition(premiere)} · ` : ''}
                        {entry.date !== undefined ? formatDue(entry) : (item.subtitle || 'Sin fecha')}
                        {item.remind ? '  🔔' : ''}
                      </Text>
                    </Pressable>
                  </Link>
                </View>
              ); })}
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
  premiereIcon: { marginRight: 15 },
  checkButton: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, marginRight: 15 },
  card: { flexDirection: 'row', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center' },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  cardContent: { flex: 1, backgroundColor: 'transparent' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13 },
});
