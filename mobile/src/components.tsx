import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, theme } from './theme';

export function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatCard({ title, value, foot }: { title: string; value: string; foot: string }) {
  return (
    <Card style={styles.stat}>
      <Text style={styles.label}>{title}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit style={styles.value}>{value}</Text>
      <Text style={styles.foot}>{foot}</Text>
    </Card>
  );
}

export function Button({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

export function StatusDot({ live }: { live: boolean }) {
  return <View style={[styles.dot, { backgroundColor: live ? theme.green : theme.red }]} />;
}

export function WhaleMark() {
  return (
    <View style={styles.mark}>
      <Text style={styles.markText}>MO</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.panel,
    borderColor: theme.line,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: 16,
  },
  stat: {
    flex: 1,
    minHeight: 104,
  },
  label: {
    color: theme.sub,
    fontSize: 12,
    marginBottom: 8,
  },
  value: {
    color: theme.text,
    fontSize: 20,
    fontWeight: '800',
  },
  foot: {
    color: theme.sub,
    fontSize: 11,
    marginTop: 6,
  },
  button: {
    backgroundColor: theme.cyan,
    borderRadius: radius.chip,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  pressed: {
    opacity: 0.78,
  },
  buttonText: {
    color: '#001018',
    fontWeight: '800',
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 99,
  },
  mark: {
    width: 42,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.panel2,
    borderColor: theme.line,
    borderWidth: 1,
  },
  markText: {
    color: theme.cyan,
    fontSize: 15,
    fontWeight: '900',
  },
});
