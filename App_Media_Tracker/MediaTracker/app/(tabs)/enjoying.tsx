import { StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useNavigation, Link } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { useStore, MediaType } from '@/store/useStore';

const mediaTypeIcons: Record<string, any> = {
  software: { ios: 'desktopcomputer', android: 'computer', web: 'computer' },
  task: { ios: 'checkmark.circle', android: 'check-circle', web: 'check-circle' },
  movie: { ios: 'film', android: 'movie', web: 'movie' },
  tv_show: { ios: 'tv', android: 'tv', web: 'tv' },
  book: { ios: 'book.closed', android: 'book', web: 'book' },
  video_game: { ios: 'gamecontroller', android: 'gamepad', web: 'gamepad' },
};

export default function EnjoyingScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const navigation = useNavigation();

  const allItems = useStore(state => state.items);
  
  // Filter items that are in progress
  const enjoyingItems = useMemo(() => {
    return allItems.filter(item => 
      item.status !== 'completed' && (item.status === 'in_progress' || 
      (item.currentCheckpoint && item.currentCheckpoint > 0) || 
      item.progress > 0)
    );
  }, [allItems]);

  useEffect(() => {
    navigation.setOptions({
      headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
      headerTitle: 'Disfrutando',
      headerTitleStyle: { fontWeight: '600' },
      headerRight: () => (
        <View style={styles.headerRightContainer}>
          <Link href="/searchModal" asChild>
            <Pressable style={styles.headerButton}>
              <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} tintColor={colors.text} />
            </Pressable>
          </Link>
        </View>
      ),
    });
  }, [navigation, colors]);

  const calculateProgress = (item: any) => {
    if (item.totalCheckpoints && item.totalCheckpoints > 0) {
      return (item.currentCheckpoint || 0) / item.totalCheckpoints;
    }
    return item.progress || 0;
  };

  const getSubtitle = (item: any) => {
    if (item.checkpointType === 'percentage') {
      return `${item.subtitle ? item.subtitle + ' · ' : ''}${item.currentCheckpoint || 0}% Completado`;
    }
    if (item.totalCheckpoints && item.totalCheckpoints > 0) {
      const unitES: Record<string, string> = { episodes: 'Episodio', chapters: 'Capítulo', pages: 'Página', levels: 'Nivel' };
      const typeLabel = item.checkpointType
        ? (unitES[item.checkpointType] ?? item.checkpointType.charAt(0).toUpperCase() + item.checkpointType.slice(1))
        : (item.type === 'tv_show' ? 'Episodio' : 'Capítulo');
      return `${item.subtitle ? item.subtitle + ' · ' : ''}${typeLabel} ${item.currentCheckpoint || 0} de ${item.totalCheckpoints}`;
    }
    return item.subtitle || 'Recién empezando';
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={styles.mainTitle}>Sigue lo que estás disfrutando</Text>
      <Text style={[styles.description, { color: colors.text + '99' }]}>
        Un solo lugar para todo lo que estás consumiendo actualmente — series, libros, juegos y software — con progreso que se actualiza a medida que avanzas.
      </Text>

      {enjoyingItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.text + '80' }]}>
            No estás siguiendo nada ahora mismo. ¡Ve a Listas y marca un capítulo para verlo aquí!
          </Text>
        </View>
      ) : (
        enjoyingItems.map((item) => {
          const progressPercent = calculateProgress(item) * 100;
          return (
            <Link key={item.id} href={`/item/${item.id}`} asChild>
              <Pressable style={StyleSheet.flatten([styles.card, { backgroundColor: colors.cardBackground }])}>
                <View style={[styles.iconContainer, { backgroundColor: colors.tint + '15' }]}>
                  <SymbolView name={mediaTypeIcons[item.type] || mediaTypeIcons['software']} size={24} tintColor={colors.tint} />
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={[styles.cardSubtitle, { color: colors.text + '99' }]}>{getSubtitle(item)}</Text>
                  <View style={[styles.progressBarBg, { backgroundColor: colors.text + '20' }]}>
                    <View style={[styles.progressBarFill, { backgroundColor: colors.tint, width: `${progressPercent}%` }]} />
                  </View>
                </View>
              </Pressable>
            </Link>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'transparent' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  headerButton: { paddingHorizontal: 10, backgroundColor: 'transparent' },
  headerRightContainer: { flexDirection: 'row', backgroundColor: 'transparent', paddingRight: 5, alignItems: 'center' },
  mainTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  description: { fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 30, paddingHorizontal: 10 },
  emptyContainer: { padding: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
  card: { flexDirection: 'row', borderRadius: 20, padding: 16, marginBottom: 15, alignItems: 'center' },
  iconContainer: { width: 50, height: 70, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  cardContent: { flex: 1, backgroundColor: 'transparent' },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 14, marginBottom: 12 },
  progressBarBg: { height: 4, borderRadius: 2, width: '100%' },
  progressBarFill: { height: 4, borderRadius: 2 }
});
