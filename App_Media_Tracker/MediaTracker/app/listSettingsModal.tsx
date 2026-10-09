import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore } from '@/store/useStore';
import { useLocalSearchParams, router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';

export default function ListSettingsModalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const list = useStore(state => state.lists.find(l => l.id === id));
  const updateList = useStore(state => state.updateList);
  
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  if (!list) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text>Lista no encontrada</Text>
      </View>
    );
  }

  const handleUpdate = (updates: any) => {
    updateList(list.id, updates);
  };

  const layouts = [
    { id: 'simple_list', label: 'Lista Simple', icon: { ios: 'list.bullet', android: 'list', web: 'list' } },
    { id: 'large_grid', label: 'Cuadrícula', icon: { ios: 'square.grid.2x2', android: 'apps', web: 'apps' } },
  ];

  const shapes = [
    { id: 'short', label: 'Corta (Horizontal)', icon: { ios: 'rectangle', android: 'laptop', web: 'laptop' } },
    { id: 'square', label: 'Cuadrada', icon: { ios: 'square', android: 'stop', web: 'stop' } },
    { id: 'tall', label: 'Alta (Vertical)', icon: { ios: 'rectangle.portrait', android: 'smartphone', web: 'smartphone' } },
  ];

  const sorts = [
    { id: 'new_old', label: 'Más recientes primero', icon: { ios: 'arrow.down.circle', android: 'arrow-circle-down', web: 'arrow-circle-down' } },
    { id: 'a_z', label: 'Alfabético (A - Z)', icon: { ios: 'textformat.abc', android: 'sort-by-alpha', web: 'sort-by-alpha' } },
  ];

  const renderOptionGroup = (title: string, options: any[], currentValue: string, field: string) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      <View style={[styles.cardGroup, { backgroundColor: colors.surface }]}>
        {options.map((opt, index) => (
          <Pressable 
            key={opt.id}
            style={[
              styles.optionRow, 
              { borderBottomColor: colors.cardBackground, borderBottomWidth: index === options.length - 1 ? 0 : 1 }
            ]}
            onPress={() => handleUpdate({ [field]: opt.id })}
          >
            <View style={styles.optionLeft}>
              <SymbolView name={opt.icon} size={20} tintColor={colors.text} style={styles.optionIcon} />
              <Text style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</Text>
            </View>
            {currentValue === opt.id && (
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={20} tintColor={colors.tint} />
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      {renderOptionGroup('Estilo de Diseño', layouts, list.layoutStyle || 'simple_list', 'layoutStyle')}
      {list.layoutStyle === 'large_grid' && renderOptionGroup('Forma del Elemento', shapes, list.itemShape || 'square', 'itemShape')}
      {renderOptionGroup('Orden', sorts, list.sortOrder || 'new_old', 'sortOrder')}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { marginTop: 30, paddingHorizontal: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 10 },
  cardGroup: { borderRadius: 16, overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  optionLeft: { flexDirection: 'row', alignItems: 'center' },
  optionIcon: { marginRight: 15, width: 24 },
  optionLabel: { fontSize: 16, fontWeight: '500' },
});
