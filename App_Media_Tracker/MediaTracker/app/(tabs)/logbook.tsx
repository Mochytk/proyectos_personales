import { StyleSheet, Pressable, ScrollView } from 'react-native';
import PressableScale from '@/components/PressableScale';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import ItemCover, { rowCover } from '@/components/ItemCover';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation, Link, router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useStore } from '@/store/useStore';
import { finishedAt } from '@/store/stats';

export default function LogbookScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const navigation = useNavigation();

  const allItems = useStore(state => state.items);

  const completedItems = useMemo(() => {
    return allItems
      .filter(item => item.status === 'completed')
      .sort((a, b) => finishedAt(b) - finishedAt(a));
  }, [allItems]);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
      headerTitle: 'Bitácora',
      headerTitleStyle: { fontWeight: '600' },
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Pressable style={styles.headerButton} accessibilityLabel="Estadísticas" onPress={() => router.push('/stats')}>
            <SymbolView name={{ ios: 'chart.bar.fill', android: 'bar-chart', web: 'bar-chart' }} size={24} tintColor={colors.text} />
          </Pressable>
          <Link href="/searchModal" asChild>
            <Pressable style={styles.headerButton}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.text} />
            </Pressable>
          </Link>
        </View>
      ),
    });
  }, [navigation, colors]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      
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
              <PressableScale style={StyleSheet.flatten([styles.card, { backgroundColor: colors.surface, boxShadow: colors.shadowBorder }])}>
                <ItemCover type={item.type} posterUrl={item.posterUrl} style={rowCover} />
                <View style={styles.cardContent}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.text + '90' }]}>
                    {item.subtitle || 'Completado'}
                  </Text>
                </View>
                <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={20} tintColor={colors.tint} />
              </PressableScale>
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
  headerButton: { paddingHorizontal: 10, paddingVertical: 10, backgroundColor: 'transparent' },
  headerRightContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  

  emptyStateContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyStateIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyStateTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  emptyStateSubtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 30, marginBottom: 30, lineHeight: 22 },
  listContainer: { marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { flexDirection: 'row', borderRadius: 16, padding: 16, marginBottom: 10, alignItems: 'center' },
  cardContent: { flex: 1, backgroundColor: 'transparent' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13 },
});
