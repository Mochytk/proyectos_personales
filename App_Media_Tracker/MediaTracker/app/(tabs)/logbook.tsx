import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import { iconForType, mediaTypeLabelsES } from '@/constants/mediaTypes';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation, Link } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useStore, MediaType } from '@/store/useStore';

export default function LogbookScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const navigation = useNavigation();

  const allItems = useStore(state => state.items);
  const [showStats, setShowStats] = useState(false);

  const completedItems = useMemo(() => {
    return allItems
      .filter(item => item.status === 'completed')
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allItems]);

  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear();
    let thisYearCount = 0;
    const typeCount: Record<string, number> = {};

    completedItems.forEach(item => {
      const isThisYear = new Date(item.updatedAt).getFullYear() === currentYear;
      if (isThisYear) thisYearCount++;
      
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
    });

    const topTypes = Object.entries(typeCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return { total: completedItems.length, thisYearCount, topTypes };
  }, [completedItems]);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
      headerTitle: 'Bitácora',
      headerTitleStyle: { fontWeight: '600' },
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Pressable style={styles.headerButton} onPress={() => setShowStats(!showStats)}>
            <SymbolView name={{ ios: 'chart.bar.fill', android: 'bar-chart', web: 'bar-chart' }} size={24} tintColor={showStats ? colors.tint : colors.text} />
          </Pressable>
          <Link href="/searchModal" asChild>
            <Pressable style={styles.headerButton}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.text} />
            </Pressable>
          </Link>
        </View>
      ),
    });
  }, [navigation, colors, showStats]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      
      {showStats && completedItems.length > 0 && (
        <View style={styles.statsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Tus Estadísticas</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.tint }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Histórico</Text>
            </View>
            <View style={[styles.statBox, { backgroundColor: colors.surface }]}>
              <Text style={[styles.statNumber, { color: colors.tint }]}>{stats.thisYearCount}</Text>
              <Text style={[styles.statLabel, { color: colors.text + '80' }]}>Este Año</Text>
            </View>
          </View>
          
          {stats.topTypes.length > 0 && (
            <View style={[styles.breakdownContainer, { backgroundColor: colors.surface }]}>
              <Text style={[styles.breakdownTitle, { color: colors.text }]}>Top Categorías</Text>
              {stats.topTypes.map(([type, count], index) => (
                <View key={type} style={[styles.breakdownRow, { borderTopColor: index > 0 ? colors.cardBackground : 'transparent', borderTopWidth: index > 0 ? 1 : 0 }]}>
                  <View style={styles.breakdownLeft}>
                    <SymbolView name={iconForType(type)} size={16} tintColor={colors.text} style={{ marginRight: 10 }} />
                    <Text style={[styles.breakdownLabel, { color: colors.text }]}>{mediaTypeLabelsES[type as MediaType] || type}</Text>
                  </View>
                  <Text style={[styles.breakdownCount, { color: colors.tint }]}>{count}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {completedItems.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateIconContainer, { backgroundColor: colors.cardBackground }]}>
            <SymbolView name={{ ios: 'text.book.closed.fill', android: 'book', web: 'book' }} size={40} tintColor={colors.text + '80'} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Sin Actividad</Text>
          <Text style={[styles.emptyStateSubtitle, { color: colors.text + '99' }]}>
            No has terminado nada aún. Completa un elemento desde Disfrutando para verlo aquí.
          </Text>
        </View>
      ) : (
        <View style={styles.listContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actividad Reciente</Text>
          {completedItems.map(item => (
            <Link key={item.id} href={`/item/${item.id}`} asChild>
              <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: colors.surface, borderBottomColor: colors.cardBackground }])}>
                <View style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}>
                  <SymbolView name={iconForType(item.type)} size={24} tintColor={colors.tint} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.text + '90' }]}>
                    {item.subtitle || 'Completado'}
                  </Text>
                </View>
                <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={20} tintColor={colors.tint} />
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
  
  // Stats
  statsContainer: { marginTop: 20, marginBottom: 20 },
  statsGrid: { flexDirection: 'row', gap: 15, marginBottom: 15 },
  statBox: { flex: 1, padding: 20, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  statNumber: { fontSize: 32, fontWeight: 'bold', marginBottom: 4 },
  statLabel: { fontSize: 13, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  breakdownContainer: { padding: 20, borderRadius: 16 },
  breakdownTitle: { fontSize: 14, fontWeight: '600', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center' },
  breakdownLabel: { fontSize: 16, fontWeight: '500' },
  breakdownCount: { fontSize: 16, fontWeight: 'bold' },

  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyStateIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyStateTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  emptyStateSubtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 30, marginBottom: 30, lineHeight: 22 },
  listContainer: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 10, alignItems: 'center', borderBottomWidth: 1 },
  iconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  cardContent: { flex: 1, backgroundColor: 'transparent' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13 },
});
