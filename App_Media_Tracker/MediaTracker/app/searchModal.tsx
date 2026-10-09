import { useState, useMemo } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore } from '@/store/useStore';
import { router, Link } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';

const mediaTypeIcons: Record<string, any> = {
  software: { ios: 'desktopcomputer', android: 'computer', web: 'computer' },
  task: { ios: 'checkmark.circle', android: 'check-circle', web: 'check-circle' },
  movie: { ios: 'film', android: 'movie', web: 'movie' },
  tv_show: { ios: 'tv', android: 'tv', web: 'tv' },
  book: { ios: 'book.closed', android: 'book', web: 'book' },
  video_game: { ios: 'gamecontroller', android: 'gamepad', web: 'gamepad' },
  event: { ios: 'calendar', android: 'event', web: 'event' }
};

export default function SearchModalScreen() {
  const allItems = useStore(state => state.items);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    if (!query.trim()) return [];
    
    const lowerQuery = query.toLowerCase();
    
    return allItems.filter(item => {
      if (item.title.toLowerCase().includes(lowerQuery)) return true;
      if (item.subtitle && item.subtitle.toLowerCase().includes(lowerQuery)) return true;
      if (item.notes && item.notes.toLowerCase().includes(lowerQuery)) return true;
      if (item.tags && item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) return true;
      return false;
    }).sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allItems, query]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.searchHeader}>
        <View style={[styles.searchBar, { backgroundColor: colors.cardBackground }]}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={colors.text + '80'} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Buscar títulos, etiquetas, notas..."
            placeholderTextColor={colors.text + '80'}
            autoFocus
            clearButtonMode="while-editing"
          />
        </View>
        <Pressable onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={[styles.cancelText, { color: colors.tint }]}>Cancelar</Text>
        </Pressable>
      </View>

      <ScrollView style={styles.resultsContainer} keyboardShouldPersistTaps="handled">
        {query.trim() === '' ? (
          <View style={styles.emptyStateContainer}>
            <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={40} tintColor={colors.text + '40'} />
            <Text style={[styles.emptyStateText, { color: colors.text + '60' }]}>Escribe para buscar en tu biblioteca</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <Text style={[styles.emptyStateText, { color: colors.text + '80' }]}>No se encontraron resultados para "{query}"</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            <Text style={[styles.resultCount, { color: colors.text + '80' }]}>{results.length} resultado{results.length !== 1 ? 's' : ''}</Text>
            {results.map(item => (
              <Pressable 
                key={item.id} 
                style={StyleSheet.flatten([styles.itemCard, { backgroundColor: colors.surface, borderBottomColor: colors.cardBackground }])}
                onPress={() => {
                  router.back();
                  router.push(`/item/${item.id}`);
                }}
              >
                <View style={[styles.itemIcon, { backgroundColor: colors.tint + '15' }]}>
                  <SymbolView name={mediaTypeIcons[item.type] || mediaTypeIcons['software']} size={20} tintColor={colors.tint} />
                </View>
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.itemSubtitle, { color: colors.text + '90' }]} numberOfLines={1}>
                    {item.subtitle || item.type.replace('_', ' ').toUpperCase()}
                  </Text>
                </View>
                {item.status === 'completed' && (
                  <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check-circle', web: 'check-circle' }} size={20} tintColor={colors.tint} />
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: { flexDirection: 'row', alignItems: 'center', padding: 15, paddingBottom: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 10, paddingHorizontal: 10, height: 40 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 16, height: '100%' },
  cancelButton: { marginLeft: 15 },
  cancelText: { fontSize: 16, fontWeight: '500' },
  resultsContainer: { flex: 1 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100, gap: 15 },
  emptyStateText: { fontSize: 16, textAlign: 'center' },
  listContainer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  resultCount: { fontSize: 13, marginBottom: 15, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: '600' },
  itemCard: { flexDirection: 'row', padding: 12, borderRadius: 16, marginBottom: 10, alignItems: 'center' },
  itemIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 15 },
  itemContent: { flex: 1, backgroundColor: 'transparent', paddingRight: 10 },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemSubtitle: { fontSize: 13, marginTop: 4 },
});
