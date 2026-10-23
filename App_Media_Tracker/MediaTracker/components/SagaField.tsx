import { Pressable, StyleSheet, TextInput } from 'react-native';
import { Text, View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { nextSagaNumber, suggestSagas } from '@/store/sagas';
import { useStore } from '@/store/useStore';

interface Props {
  name: string;
  number: string;
  onChange: (value: { name: string; number: string }) => void;
}

/** Saga name and number for a book, with the sagas already in the library as suggestions. */
export default function SagaField({ name, number, onChange }: Props) {
  const colors = Colors[useColorScheme()];
  const items = useStore((state) => state.items);
  const suggestions = suggestSagas(items, name);
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.text + '40' }];

  return (
    <View style={{ backgroundColor: 'transparent' }}>
      <View style={styles.row}>
        <TextInput
          style={[...inputStyle, { flex: 3 }]}
          value={name}
          onChangeText={(text) => onChange({ name: text, number })}
          placeholder="Nombre de la saga"
          placeholderTextColor={colors.text + '80'}
          accessibilityLabel="Nombre de la saga"
        />
        <TextInput
          style={[...inputStyle, { flex: 1 }]}
          value={number}
          onChangeText={(text) => onChange({ name, number: text })}
          placeholder="N.º"
          placeholderTextColor={colors.text + '80'}
          keyboardType="numeric"
          accessibilityLabel="Número dentro de la saga"
        />
      </View>
      {suggestions.length > 0 && (
        <View style={styles.chips}>
          {suggestions.map((suggestion) => (
            <Pressable
              key={suggestion}
              style={[styles.chip, { backgroundColor: colors.cardBackground }]}
              onPress={() => onChange({ name: suggestion, number: number.trim() ? number : String(nextSagaNumber(items, suggestion)) })}
            >
              <Text style={{ color: colors.text, fontSize: 14 }}>{suggestion}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, backgroundColor: 'transparent' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, backgroundColor: 'transparent' },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
});
