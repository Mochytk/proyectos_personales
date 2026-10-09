import { StyleSheet, Pressable, ScrollView, Switch } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore } from '@/store/useStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export default function GlobalSettingsScreen() {
  const settings = useStore(state => state.settings);
  const updateSettings = useStore(state => state.updateSettings);
  
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[styles.description, { color: colors.text + '99' }]}>
        Personaliza tu experiencia ocultando las pestañas que no usas. Tus datos no se borrarán.
      </Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Pestañas de Navegación</Text>
        <View style={[styles.cardGroup, { backgroundColor: colors.surface }]}>
          
          <View style={[styles.optionRow, { borderBottomColor: colors.cardBackground, borderBottomWidth: 1 }]}>
            <View style={styles.optionLeft}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Disfrutando</Text>
              <Text style={[styles.optionDescription, { color: colors.text + '80' }]}>Rastrea tu progreso actual.</Text>
            </View>
            <Switch 
              value={settings?.showEnjoying !== false} 
              onValueChange={(val) => updateSettings({ showEnjoying: val })}
              trackColor={{ true: colors.tint }}
            />
          </View>

          <View style={[styles.optionRow, { borderBottomColor: colors.cardBackground, borderBottomWidth: 1 }]}>
            <View style={styles.optionLeft}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Planificador</Text>
              <Text style={[styles.optionDescription, { color: colors.text + '80' }]}>Programa tareas y eventos próximos.</Text>
            </View>
            <Switch 
              value={settings?.showPlanner !== false} 
              onValueChange={(val) => updateSettings({ showPlanner: val })}
              trackColor={{ true: colors.tint }}
            />
          </View>

          <View style={styles.optionRow}>
            <View style={styles.optionLeft}>
              <Text style={[styles.optionLabel, { color: colors.text }]}>Bitácora</Text>
              <Text style={[styles.optionDescription, { color: colors.text + '80' }]}>Revisa tu historial de completados.</Text>
            </View>
            <Switch 
              value={settings?.showLogbook !== false} 
              onValueChange={(val) => updateSettings({ showLogbook: val })}
              trackColor={{ true: colors.tint }}
            />
          </View>

        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  description: { padding: 20, fontSize: 15, lineHeight: 22 },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 14, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginLeft: 10 },
  cardGroup: { borderRadius: 16, overflow: 'hidden' },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  optionLeft: { flex: 1, paddingRight: 20 },
  optionLabel: { fontSize: 16, fontWeight: '500', marginBottom: 4 },
  optionDescription: { fontSize: 13 },
});
