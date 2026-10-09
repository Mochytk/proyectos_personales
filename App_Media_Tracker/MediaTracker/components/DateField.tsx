import { StyleSheet, TextInput } from 'react-native';
import { View } from '@/components/Themed';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

export interface DateFieldProps {
  date: string; // "YYYY-MM-DD" or ""
  time: string; // "HH:MM" or ""
  onChange: (value: { date: string; time: string }) => void;
}

/** Native fallback: plain text fields. The web / Electron build uses real pickers (DateField.web.tsx). */
export default function DateField({ date, time, onChange }: DateFieldProps) {
  const colors = Colors[useColorScheme() ?? 'light'];
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.text + '40' }];
  return (
    <View style={styles.row}>
      <TextInput
        style={[...inputStyle, { flex: 2 }]}
        value={date}
        onChangeText={(d) => onChange({ date: d, time })}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.text + '80'}
      />
      <TextInput
        style={[...inputStyle, { flex: 1 }]}
        value={time}
        onChangeText={(t) => onChange({ date, time: t })}
        placeholder="HH:MM"
        placeholderTextColor={colors.text + '80'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, backgroundColor: 'transparent' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
});
