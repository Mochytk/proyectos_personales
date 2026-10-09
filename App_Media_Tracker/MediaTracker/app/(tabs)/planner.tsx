import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation, Link } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useStore, MediaType } from '@/store/useStore';

export default function PlannerScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const navigation = useNavigation();

  const allItems = useStore(state => state.items);
  
  const upcomingItems = useMemo(() => {
    return allItems
      .filter(item => item.status !== 'completed' && (item.dueDate !== undefined || item.type === 'event' || item.type === 'task'))
      .sort((a, b) => {
        const aTime = a.dueDate || a.updatedAt;
        const bTime = b.dueDate || b.updatedAt;
        return aTime - bTime;
      });
  }, [allItems]);

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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    // Use es-ES locale for Spanish formatting
    return date.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric' });
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
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Próximos Lanzamientos y Tareas</Text>
          {upcomingItems.map(item => (
            <Link key={item.id} href={`/item/${item.id}`} asChild>
              <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: colors.cardBackground }])}>
                <View style={[styles.iconContainer, { backgroundColor: (item.type === 'event' || item.dueDate) ? '#FF950020' : colors.tint + '15' }]}>
                  <SymbolView 
                    name={(item.type === 'event' || item.dueDate) ? { ios: 'calendar', android: 'event', web: 'event' } : { ios: 'checkmark.circle', android: 'check-circle', web: 'check-circle' }} 
                    size={24} 
                    tintColor={(item.type === 'event' || item.dueDate) ? '#FF9500' : colors.tint} 
                  />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.text + '90' }]}>
                    {item.dueDate ? `Programado para el ${formatDate(item.dueDate)}` : (item.subtitle || 'Sin fecha')}
                  </Text>
                </View>
              </Pressable>
            </Link>
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
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  card: { flexDirection: 'row', borderRadius: 20, padding: 16, marginBottom: 12, alignItems: 'center' },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  cardContent: { flex: 1, backgroundColor: 'transparent' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13 },
});
