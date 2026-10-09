import { StyleSheet, Pressable, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore, AppSettings } from '@/store/useStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';

export default function PileSettingsModalScreen() {
  const settings = useStore(state => state.settings);
  const updateSettings = useStore(state => state.updateSettings);
  
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const handleUpdate = (updates: Partial<AppSettings>) => {
    updateSettings(updates);
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
      {renderOptionGroup('Estilo de Diseño', layouts, settings?.pileLayoutStyle || 'simple_list', 'pileLayoutStyle')}
      {renderOptionGroup('Forma del Elemento', shapes, settings?.pileItemShape || 'square', 'pileItemShape')}
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
