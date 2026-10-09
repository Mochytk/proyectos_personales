import { useLocalSearchParams, router, Stack, Link, useNavigation } from 'expo-router';
import { StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore, MediaItem, MediaType } from '@/store/useStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';
import { useMemo, useEffect } from 'react';

const { width } = Dimensions.get('window');

const mediaTypeIcons: Record<string, any> = {
  software: { ios: 'desktopcomputer', android: 'computer', web: 'computer' },
  task: { ios: 'checkmark.circle', android: 'check-circle', web: 'check-circle' },
  movie: { ios: 'film', android: 'movie', web: 'movie' },
  tv_show: { ios: 'tv', android: 'tv', web: 'tv' },
  book: { ios: 'book.closed', android: 'book', web: 'book' },
  video_game: { ios: 'gamecontroller', android: 'gamepad', web: 'gamepad' },
};

export default function ListDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useStore(state => state.lists.find(l => l.id === id));
  const allItems = useStore(state => state.items);
  const removeList = useStore(state => state.removeList);
  const navigation = useNavigation();
  
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const items = useMemo(() => {
    if (!list) return [];
    
    // Base active items filter
    const activeItems = allItems.filter(i => i.status !== 'completed');
    
    if (list.isSmartList) {
      // Smart List logic: apply filters across all active items
      return activeItems.filter(item => {
        if (list.smartFilters?.types && list.smartFilters.types.length > 0) {
          return list.smartFilters.types.includes(item.type);
        }
        return true;
      });
    } else {
      // Standard List logic: only match exact listId
      return activeItems.filter(i => i.listId === id);
    }
  }, [allItems, list, id]);

  const sortedItems = useMemo(() => {
    let sorted = [...items];
    if (list?.sortOrder === 'a_z') {
      sorted.sort((a, b) => a.title.localeCompare(b.title));
    } else {
      sorted.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    return sorted;
  }, [items, list?.sortOrder]);

  useEffect(() => {
    if (list) {
      navigation.setOptions({
        title: list.name,
        headerBackTitle: 'Listas',
        headerStyle: { backgroundColor: colors.background, shadowColor: 'transparent', elevation: 0 },
        headerShadowVisible: false,
        headerRight: () => (
          <Pressable 
            onPress={() => router.push(`/listSettingsModal?id=${list.id}`)} 
            style={{ paddingHorizontal: 10 }}
          >
            <SymbolView name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} size={24} tintColor={colors.text} />
          </Pressable>
        )
      });
    } else {
      navigation.setOptions({ title: 'No Encontrado' });
    }
  }, [navigation, list?.name, list?.id, colors]);

  if (!list) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text>Lista no encontrada</Text>
      </View>
    );
  }

  const handleDelete = () => {
    removeList(list.id);
    router.back();
  };

  const layout = list.layoutStyle || 'simple_list';
  const shape = list.itemShape || 'square';
  
  const getCardAspectRatio = () => {
    switch(shape) {
      case 'short': return 16/9;
      case 'tall': return 2/3;
      case 'square': default: return 1;
    }
  };

  const renderGridItem = (item: MediaItem) => {
    // 2 columns
    const itemWidth = (width - 60) / 2;
    
    return (
      <Link key={item.id} href={`/item/${item.id}`} asChild>
        <Pressable style={StyleSheet.flatten([
          styles.gridCard, 
          { backgroundColor: colors.surface, width: itemWidth }
        ])}>
          <View style={[styles.gridImagePlaceholder, { aspectRatio: getCardAspectRatio(), backgroundColor: colors.tint + '15' }]}>
            <SymbolView name={mediaTypeIcons[item.type] || mediaTypeIcons['software']} size={32} tintColor={colors.tint} />
          </View>
          <View style={styles.gridCardContent}>
            <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
            {item.subtitle ? <Text style={[styles.gridSubtitle, { color: colors.text + '90' }]} numberOfLines={1}>{item.subtitle}</Text> : null}
          </View>
        </Pressable>
      </Link>
    );
  };

  const renderListItem = (item: MediaItem) => (
    <Link key={item.id} href={`/item/${item.id}`} asChild>
      <Pressable style={StyleSheet.flatten([styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.cardBackground }])}>
        <View style={[styles.itemIcon, { backgroundColor: colors.tint + '15' }]}>
          <SymbolView name={mediaTypeIcons[item.type] || mediaTypeIcons['software']} size={20} tintColor={colors.tint} />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemTitle, { color: colors.text }]}>{item.title}</Text>
          {item.subtitle ? <Text style={[styles.itemSubtitle, { color: colors.text + '90' }]}>{item.subtitle}</Text> : null}
        </View>
      </Pressable>
    </Link>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      
      {list.isSmartList && (
        <View style={[styles.smartListBanner, { backgroundColor: colors.tint + '20' }]}>
          <SymbolView name={{ ios: 'wand.and.stars', android: 'auto-fix-high', web: 'auto-fix-high' }} size={20} tintColor={colors.tint} />
          <Text style={[styles.smartListBannerText, { color: colors.tint }]}>Lista Inteligente</Text>
        </View>
      )}

      {items.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateIconContainer, { backgroundColor: colors.cardBackground }]}>
            <SymbolView name={{ ios: 'tray', android: 'inbox', web: 'inbox' }} size={40} tintColor={colors.text + '80'} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Lista Vacía</Text>
          <Text style={[styles.emptyStateSubtitle, { color: colors.text + '99' }]}>
            {list.isSmartList ? "No hay elementos que coincidan con los filtros de esta lista." : "Añade elementos a esta lista usando el botón +."}
          </Text>
        </View>
      ) : (
        <View style={layout === 'large_grid' ? styles.gridContainer : styles.listContainer}>
          {sortedItems.map(item => layout === 'large_grid' ? renderGridItem(item) : renderListItem(item))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable style={[styles.deleteButton, { backgroundColor: '#ff3b3020' }]} onPress={handleDelete}>
          <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor="#ff3b30" />
          <Text style={styles.deleteButtonText}>Eliminar Lista</Text>
        </Pressable>
        {!list.isSmartList && (
          <Text style={[styles.deleteWarning, { color: colors.text + '80' }]}>
            Al eliminar esta lista, sus elementos regresarán a La Pila.
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  smartListBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, marginBottom: 10 },
  smartListBannerText: { fontWeight: '600', marginLeft: 8 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 40 },
  emptyStateIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyStateTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  emptyStateSubtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 30, marginBottom: 30, lineHeight: 22 },
  
  // List Layout
  listContainer: { marginTop: 10 },
  itemCard: { flexDirection: 'row', padding: 12, borderRadius: 16, marginBottom: 10, alignItems: 'center' },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  itemContent: { flex: 1, backgroundColor: 'transparent' },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemSubtitle: { fontSize: 13, marginTop: 4 },
  
  // Grid Layout
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 10 },
  gridCard: { borderRadius: 16, marginBottom: 15, overflow: 'hidden' },
  gridImagePlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  gridCardContent: { padding: 12, backgroundColor: 'transparent' },
  gridTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  gridSubtitle: { fontSize: 12 },

  actions: { marginTop: 60 },
  deleteButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  deleteButtonText: { color: '#ff3b30', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  deleteWarning: { textAlign: 'center', marginTop: 10, fontSize: 13 }
});
