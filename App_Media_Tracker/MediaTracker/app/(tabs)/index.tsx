import { StyleSheet, Pressable, ScrollView, Dimensions } from 'react-native';
import { Text, View } from '@/components/Themed';
import { SymbolView } from '@/components/AppIcon';
import { iconForType, mediaTypeLabelsES } from '@/constants/mediaTypes';
import Colors from '@/constants/Colors';
import { Link } from 'expo-router';
import { useMemo } from 'react';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStore, MediaItem, MediaType } from '@/store/useStore';

const { width } = Dimensions.get('window');

export default function ListsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  const items = useStore(state => state.items);
  const lists = useStore(state => state.lists);
  const settings = useStore(state => state.settings);
  
  const pileItems = items.filter(i => !i.listId && i.status !== 'completed');
  
  const groupedItems = useMemo(() => {
    return pileItems.reduce((acc, item) => {
      if (!acc[item.type]) acc[item.type] = [];
      acc[item.type].push(item);
      return acc;
    }, {} as Record<string, MediaItem[]>);
  }, [pileItems]);

  const layout = settings?.pileLayoutStyle || 'simple_list';
  const shape = settings?.pileItemShape || 'square';
  
  const getCardAspectRatio = () => {
    switch(shape) {
      case 'short': return 16/9;
      case 'tall': return 2/3;
      case 'square': default: return 1;
    }
  };

  const renderGridItem = (item: MediaItem) => {
    const itemWidth = (width - 60) / 2;
    return (
      <Link key={item.id} href={`/item/${item.id}`} asChild>
        <Pressable style={StyleSheet.flatten([
          styles.gridCard, 
          { backgroundColor: colors.surface, width: itemWidth }
        ])}>
          <View style={[styles.gridImagePlaceholder, { aspectRatio: getCardAspectRatio(), backgroundColor: colors.tint + '15' }]}>
            <SymbolView name={iconForType(item.type)} size={32} tintColor={colors.tint} />
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
          <SymbolView name={iconForType(item.type)} size={20} tintColor={colors.tint} />
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
      <View style={[styles.pileCard, { backgroundColor: colors.cardBackground }]}>
        <View style={[styles.pileIconContainer, { backgroundColor: colors.tint + '20' }]}>
          <SymbolView name={{ ios: 'square.stack.3d.up.fill', android: 'layers', web: 'layers' }} size={20} tintColor={colors.tint} />
        </View>
        <Text style={[styles.pileTitle, { color: colors.text }]}>La Pila</Text>
        <Text style={[styles.pileSubtitle, { color: colors.text + '80' }]}>
          {pileItems.length} {pileItems.length === 1 ? 'Elemento' : 'Elementos'}
        </Text>
      </View>

      {/* Render Custom Lists */}
      {lists.length > 0 && (
        <View style={styles.customListsContainer}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Mis Listas</Text>
          {lists.map(list => {
            const listItemsCount = list.isSmartList 
              ? items.filter(i => i.status !== 'completed' && (!list.smartFilters?.types || list.smartFilters.types.includes(i.type))).length
              : items.filter(i => i.listId === list.id && i.status !== 'completed').length;
              
            return (
              <Link key={list.id} href={`/list/${list.id}`} asChild>
                <Pressable style={StyleSheet.flatten([styles.listCard, { backgroundColor: colors.surface }])}>
                  <View style={[styles.listIconContainer, { backgroundColor: colors.cardBackground }]}>
                    {list.isSmartList ? (
                      <SymbolView name={{ ios: 'wand.and.stars', android: 'auto-fix-high', web: 'auto-fix-high' }} size={20} tintColor={colors.tint} />
                    ) : (
                      <SymbolView name={{ ios: 'list.bullet', android: 'list', web: 'list' }} size={20} tintColor={colors.text} />
                    )}
                  </View>
                  <View style={styles.listCardContent}>
                    <Text style={[styles.listTitle, { color: colors.text }]}>{list.name}</Text>
                    <Text style={[styles.listSubtitle, { color: colors.text + '80' }]}>{listItemsCount} Elementos</Text>
                  </View>
                  <SymbolView name={{ ios: 'chevron.right', android: 'chevron-right', web: 'chevron-right' }} size={16} tintColor={colors.text + '60'} />
                </Pressable>
              </Link>
            )
          })}
        </View>
      )}

      {/* Add New List Button */}
      <Link href="/newListModal" asChild>
        <Pressable style={StyleSheet.flatten([styles.newListButton, { backgroundColor: colors.cardBackground }])}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor={colors.tint} />
          <Text style={[styles.newListButtonText, { color: colors.tint }]}>Crear Nueva Lista</Text>
        </Pressable>
      </Link>

      {pileItems.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <View style={[styles.emptyStateIconContainer, { backgroundColor: colors.cardBackground }]}>
            <SymbolView name={{ ios: 'list.bullet', android: 'format-list-bulleted', web: 'format-list-bulleted' }} size={40} tintColor={colors.text + '80'} />
          </View>
          <Text style={[styles.emptyStateTitle, { color: colors.text }]}>Crea tu primer elemento</Text>
          <Text style={[styles.emptyStateSubtitle, { color: colors.text + '99' }]}>
            Organiza lo que quieres ver, leer, jugar, escuchar y más.
          </Text>
          
          <Link href="/modal" asChild>
            <Pressable style={StyleSheet.flatten([styles.createButton, { backgroundColor: colors.tint + '20' }])}>
              <Text style={StyleSheet.flatten([styles.createButtonText, { color: colors.tint }])}>Añadir a La Pila</Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <View style={styles.groupedList}>
          <View style={styles.pileHeaderRow}>
            <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0, marginTop: 10 }]}>Contenido de La Pila</Text>
            <Link href="/pileSettingsModal" asChild>
              <Pressable style={{ padding: 10 }}>
                <SymbolView name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} size={20} tintColor={colors.text} />
              </Pressable>
            </Link>
          </View>

          {Object.entries(groupedItems).map(([type, typeItems]) => (
            <View key={type} style={styles.groupSection}>
              <Text style={[styles.groupHeader, { color: colors.text }]}>{mediaTypeLabelsES[type as MediaType] || type}</Text>
              
              <View style={layout === 'large_grid' ? styles.gridContainer : styles.listContainer}>
                {typeItems.map(item => layout === 'large_grid' ? renderGridItem(item) : renderListItem(item))}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  pileCard: { borderRadius: 20, padding: 20, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start', minHeight: 120, marginBottom: 20 },
  pileIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  pileTitle: { fontSize: 18, fontWeight: '600' },
  pileSubtitle: { fontSize: 14, marginTop: 4 },
  customListsContainer: { marginBottom: 15 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  listCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 10 },
  listIconContainer: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  listCardContent: { flex: 1 },
  listTitle: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  listSubtitle: { fontSize: 14 },
  newListButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 16, marginBottom: 20 },
  newListButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  emptyStateIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyStateTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 10 },
  emptyStateSubtitle: { fontSize: 16, textAlign: 'center', paddingHorizontal: 30, marginBottom: 30, lineHeight: 22 },
  createButton: { paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  createButtonText: { fontSize: 16, fontWeight: '600' },
  
  groupedList: { marginTop: 10 },
  pileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  groupSection: { marginBottom: 25 },
  groupHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 12, marginLeft: 4 },
  
  // List Layout
  listContainer: { marginTop: 10 },
  itemCard: { flexDirection: 'row', padding: 12, borderRadius: 16, marginBottom: 10, alignItems: 'center' },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  itemContent: { flex: 1, backgroundColor: 'transparent' },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemSubtitle: { fontSize: 13, marginTop: 4 },
  
  // Grid Layout
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { borderRadius: 16, marginBottom: 15, overflow: 'hidden' },
  gridImagePlaceholder: { width: '100%', alignItems: 'center', justifyContent: 'center' },
  gridCardContent: { padding: 12, backgroundColor: 'transparent' },
  gridTitle: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  gridSubtitle: { fontSize: 12 },
});
