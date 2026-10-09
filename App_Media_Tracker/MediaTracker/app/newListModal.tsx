import { useState } from 'react';
import { StyleSheet, TextInput, Pressable, ScrollView, Switch } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore, MediaType } from '@/store/useStore';
import { useNavigation, router } from 'expo-router';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';

const mediaTypes: { label: string; value: MediaType; icon: string }[] = [
  { label: 'Software', value: 'software', icon: 'desktopcomputer' },
  { label: 'Tarea', value: 'task', icon: 'checkmark.circle' },
  { label: 'Película', value: 'movie', icon: 'film' },
  { label: 'Serie', value: 'tv_show', icon: 'tv' },
  { label: 'Libro', value: 'book', icon: 'book.closed' },
  { label: 'Juego', value: 'video_game', icon: 'gamecontroller' },
];

export default function NewListModalScreen() {
  const addList = useStore(state => state.addList);
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  
  const [name, setName] = useState('');
  const [isSmartList, setIsSmartList] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<MediaType[]>([]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    addList({
      name,
      isPinned: false,
      type: 'collection',
      layoutStyle: 'large_grid',
      sortOrder: 'new_old',
      isSmartList,
      smartFilters: isSmartList ? { types: selectedTypes.length > 0 ? selectedTypes : undefined } : undefined
    });
    
    router.back();
  };

  const toggleType = (type: MediaType) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={[styles.label, { color: colors.text }]}>Nombre de la Lista</Text>
      <TextInput
        style={[styles.input, { color: colors.text, borderColor: colors.text + '40' }]}
        value={name}
        onChangeText={setName}
        placeholder={isSmartList ? "ej. Todo Películas y Series" : "ej. Anime de Otoño 2026"}
        placeholderTextColor={colors.text + '80'}
        autoFocus
      />
      
      <View style={styles.switchRow}>
        <View style={styles.switchTextContainer}>
          <Text style={[styles.label, { color: colors.text, marginTop: 0 }]}>Lista Inteligente (Smart List)</Text>
          <Text style={[styles.switchDescription, { color: colors.text + '80' }]}>Añade automáticamente elementos que coincidan con tus filtros en toda la app.</Text>
        </View>
        <Switch value={isSmartList} onValueChange={setIsSmartList} trackColor={{ true: colors.tint }} />
      </View>

      {isSmartList && (
        <View style={styles.filtersContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Filtrar por Tipo (Opcional)</Text>
          <Text style={[styles.switchDescription, { color: colors.text + '80', marginBottom: 15 }]}>Selecciona los tipos a incluir. Si no seleccionas ninguno, se incluirán todos.</Text>
          <View style={styles.tagsContainer}>
            {mediaTypes.map((mt) => {
              const isSelected = selectedTypes.includes(mt.value);
              return (
                <Pressable
                  key={mt.value}
                  style={[
                    styles.tag,
                    { backgroundColor: isSelected ? colors.tint : colors.cardBackground }
                  ]}
                  onPress={() => toggleType(mt.value)}
                >
                  <SymbolView name={mt.icon as any} size={16} tintColor={isSelected ? '#fff' : colors.text} />
                  <Text style={[styles.tagText, { color: isSelected ? '#fff' : colors.text }]}>{mt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <Pressable 
        style={[styles.saveButton, { backgroundColor: name.trim() ? colors.tint : colors.text + '40' }]} 
        onPress={handleSave}
        disabled={!name.trim()}
      >
        <Text style={styles.saveButtonText}>Crear Lista</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#88888820' },
  switchTextContainer: { flex: 1, paddingRight: 20 },
  switchDescription: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  filtersContainer: { marginTop: 10 },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  tagText: { marginLeft: 6, fontWeight: '500' },
  saveButton: { marginTop: 40, padding: 16, borderRadius: 25, alignItems: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
