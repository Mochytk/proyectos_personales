import { useLocalSearchParams, router, Stack } from 'expo-router';
import { StyleSheet, Pressable, ScrollView, TextInput, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useStore } from '@/store/useStore';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SymbolView } from '@/components/AppIcon';
import { useState, useEffect } from 'react';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useStore(state => state.items.find(i => i.id === id));
  const updateItem = useStore(state => state.updateItem);
  const removeItem = useStore(state => state.removeItem);
  
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const [newTag, setNewTag] = useState('');
  const [notes, setNotes] = useState(item?.notes || '');

  useEffect(() => {
    if (item) setNotes(item.notes || '');
  }, [item?.notes]);

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: 'No Encontrado' }} />
        <Text>Elemento no encontrado</Text>
      </View>
    );
  }

  const handleDelete = () => {
    removeItem(item.id);
    router.back();
  };

  const handleComplete = () => {
    updateItem(item.id, { status: 'completed' });
    router.back();
  };

  const setRating = (rating: number) => {
    updateItem(item.id, { rating: item.rating === rating ? 0 : rating });
  };

  const addTag = () => {
    if (newTag.trim() && !item.tags?.includes(newTag.trim())) {
      updateItem(item.id, { tags: [...(item.tags || []), newTag.trim()] });
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    updateItem(item.id, { tags: (item.tags || []).filter(t => t !== tagToRemove) });
  };

  const saveNotes = () => {
    if (notes !== item.notes) {
      updateItem(item.id, { notes });
    }
  };

  const hasCheckpoints = item.totalCheckpoints && item.totalCheckpoints > 0;
  
  const renderChecklist = () => {
    if (!hasCheckpoints) return null;
    
    let unit = item.checkpointType && item.checkpointType !== 'percentage' 
      ? item.checkpointType.charAt(0).toUpperCase() + item.checkpointType.slice(1).replace(/s$/, '') 
      : 'Paso';
      
    const translations: any = {
      'Episode': 'Episodio',
      'Chapter': 'Capítulo',
      'Page': 'Página',
      'Level': 'Nivel'
    };
    unit = translations[unit] || unit;

    if (item.checkpointType === 'percentage') {
      const current = item.currentCheckpoint || 0;
      const total = item.totalCheckpoints || 100;
      return (
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Progreso ({current}%)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Pressable 
              style={[styles.actionButton, { flex: 1, backgroundColor: colors.cardBackground, padding: 12 }]} 
              onPress={() => updateItem(item.id, { currentCheckpoint: Math.max(0, current - 10), status: current - 10 > 0 ? 'in_progress' : 'unstarted' })}
            >
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>- 10%</Text>
            </Pressable>
            <Pressable 
              style={[styles.actionButton, { flex: 1, backgroundColor: colors.tint, padding: 12 }]} 
              onPress={() => updateItem(item.id, { currentCheckpoint: Math.min(total, current + 10), status: 'in_progress' })}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ 10%</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    
    const checkboxes = [];
    for (let i = 1; i <= (item.totalCheckpoints || 0); i++) {
      const isChecked = (item.currentCheckpoint || 0) >= i;
      checkboxes.push(
        <Pressable 
          key={i} 
          style={[styles.checklistItem, { borderBottomColor: colors.cardBackground }]}
          onPress={() => {
            const next = isChecked ? i - 1 : i;
            updateItem(item.id, { 
              currentCheckpoint: next,
              status: next > 0 ? 'in_progress' : 'unstarted'
            });
          }}
        >
          <View style={[
            styles.checkbox, 
            { 
              borderColor: isChecked ? colors.tint : colors.text + '40',
              backgroundColor: isChecked ? colors.tint : 'transparent'
            }
          ]}>
            {isChecked && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={12} tintColor="#fff" />}
          </View>
          <Text style={[styles.checklistText, { color: colors.text }, isChecked && { textDecorationLine: 'line-through', opacity: 0.5 }]}>
            {unit} {i}
          </Text>
        </Pressable>
      );
    }
    
    return (
      <View style={[styles.sectionContainer, { backgroundColor: colors.surface }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Lista de Progreso</Text>
        {checkboxes}
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ 
        title: item.title,
        headerBackTitle: 'Atrás',
        headerStyle: { backgroundColor: colors.background },
        headerShadowVisible: false,
      }} />
      <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.header}>
          {item.posterUrl ? <Image source={{ uri: item.posterUrl }} style={styles.poster} /> : null}
          <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
          {item.subtitle ? <Text style={[styles.subtitle, { color: colors.text + '90' }]}>{item.subtitle}</Text> : null}
          {item.overview ? <Text style={[styles.overview, { color: colors.text + '90' }]}>{item.overview}</Text> : null}
        </View>

        {/* Rating Section */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Calificación</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map(star => (
              <Pressable key={star} onPress={() => setRating(star)} style={styles.star}>
                <SymbolView 
                  name={{ ios: 'star.fill', android: 'star', web: 'star' }} 
                  size={32} 
                  tintColor={(item.rating || 0) >= star ? '#FFD700' : colors.text + '20'} 
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Sticky Notes Section */}
        <View style={[styles.sectionContainer, { backgroundColor: '#FDF1D0' }]}>
          <View style={styles.notesHeader}>
            <SymbolView name={{ ios: 'note.text', android: 'sticky-note-2', web: 'sticky-note-2' }} size={20} tintColor="#B8860B" />
            <Text style={[styles.sectionTitle, { color: '#B8860B', marginBottom: 0, marginLeft: 8 }]}>Nota Adhesiva</Text>
          </View>
          <TextInput
            style={[styles.notesInput, { color: '#333' }]}
            multiline
            placeholder="Anota tus pensamientos, reseñas o recordatorios aquí..."
            placeholderTextColor="#B8860B80"
            value={notes}
            onChangeText={(text) => { setNotes(text); updateItem(item.id, { notes: text }); }}
            onBlur={saveNotes}
          />
        </View>

        {/* Tags Section */}
        <View style={[styles.sectionContainer, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Etiquetas</Text>
          <View style={styles.tagsContainer}>
            {(item.tags || []).map(tag => (
              <Pressable key={tag} style={[styles.tag, { backgroundColor: colors.tint + '20' }]} onPress={() => removeTag(tag)}>
                <Text style={[styles.tagText, { color: colors.tint }]}>{tag}</Text>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={12} tintColor={colors.tint} style={{ marginLeft: 6 }} />
              </Pressable>
            ))}
          </View>
          <View style={styles.addTagContainer}>
            <TextInput
              style={[styles.tagInput, { color: colors.text, borderColor: colors.cardBackground }]}
              placeholder="Añadir etiqueta..."
              placeholderTextColor={colors.text + '60'}
              value={newTag}
              onChangeText={setNewTag}
              onSubmitEditing={addTag}
            />
            <Pressable style={[styles.addTagButton, { backgroundColor: colors.cardBackground }]} onPress={addTag}>
              <Text style={[styles.addTagButtonText, { color: colors.text }]}>Añadir</Text>
            </Pressable>
          </View>
        </View>
        
        {renderChecklist()}

        <View style={styles.actions}>
          {item.status !== 'completed' && (
            <Pressable style={[styles.actionButton, { backgroundColor: colors.tint }]} onPress={handleComplete}>
              <SymbolView name={{ ios: 'book.closed.fill', android: 'book', web: 'book' }} size={20} tintColor="#fff" />
              <Text style={[styles.actionButtonText, { color: '#fff' }]}>Marcar como Terminado</Text>
            </Pressable>
          )}

          <Pressable style={[styles.actionButton, { backgroundColor: '#ff3b3020' }]} onPress={handleDelete}>
            <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={20} tintColor="#ff3b30" />
            <Text style={[styles.actionButtonText, { color: '#ff3b30' }]}>Eliminar Elemento</Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 20, paddingBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 16, marginTop: 4 },
  poster: { width: 140, height: 210, borderRadius: 12, marginBottom: 16, backgroundColor: '#00000010' },
  overview: { fontSize: 15, lineHeight: 22, marginTop: 12 },
  sectionContainer: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 20, borderRadius: 16, marginHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 15 },
  
  // Rating
  starsContainer: { flexDirection: 'row', gap: 10 },
  star: { padding: 5 },

  // Sticky Notes
  notesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  notesInput: { minHeight: 100, fontSize: 16, lineHeight: 24, textAlignVertical: 'top' },

  // Tags
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  tagText: { fontSize: 14, fontWeight: '500' },
  addTagContainer: { flexDirection: 'row', gap: 10 },
  tagInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 10, fontSize: 15 },
  addTagButton: { justifyContent: 'center', paddingHorizontal: 20, borderRadius: 12 },
  addTagButtonText: { fontWeight: '600' },

  checklistItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, marginRight: 15, alignItems: 'center', justifyContent: 'center' },
  checklistText: { fontSize: 16 },
  actions: { padding: 20, marginTop: 20, gap: 15 },
  actionButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 12 },
  actionButtonText: { fontSize: 16, fontWeight: '600', marginLeft: 8 }
});
