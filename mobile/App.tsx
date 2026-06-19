import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, StatCard, StatusDot, WhaleMark } from './src/components';
import { ageFromUnix, atomicToXmr, hashrate, shortWallet } from './src/format';
import { getMinerStats, getWorkers, type MinerStats, type Worker } from './src/ocean';
import { theme } from './src/theme';

const WALLET_KEY = 'moneroocean.wallet';

export default function App() {
  const [wallet, setWallet] = useState('');
  const [stats, setStats] = useState<MinerStats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'dash' | 'workers' | 'settings'>('dash');

  useEffect(() => {
    AsyncStorage.getItem(WALLET_KEY).then((value) => {
      if (value) setWallet(value);
    });
  }, []);

  const onlineWorkers = useMemo(() => workers.filter((worker) => worker.hashrate > 0).length, [workers]);
  const currentHashrate = stats?.hash2 ?? stats?.hash ?? 0;

  const refresh = useCallback(async () => {
    const cleanWallet = wallet.trim();

    if (!cleanWallet) {
      setError('Set wallet first.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await AsyncStorage.setItem(WALLET_KEY, cleanWallet);
      const [nextStats, nextWorkers] = await Promise.all([
        getMinerStats(cleanWallet),
        getWorkers(cleanWallet),
      ]);

      setStats(nextStats);
      setWorkers(nextWorkers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.shell}>
        <Header wallet={wallet} loading={loading} onRefresh={refresh} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {tab === 'dash' ? (
          <Dashboard stats={stats} workers={workers} onlineWorkers={onlineWorkers} currentHashrate={currentHashrate} />
        ) : null}

        {tab === 'workers' ? <Workers workers={workers} onlineWorkers={onlineWorkers} /> : null}

        {tab === 'settings' ? <Settings wallet={wallet} setWallet={setWallet} onRefresh={refresh} /> : null}

        <View style={styles.tabs}>
          <Tab label="Dash" active={tab === 'dash'} onPress={() => setTab('dash')} />
          <Tab label="Workers" active={tab === 'workers'} onPress={() => setTab('workers')} />
          <Tab label="Settings" active={tab === 'settings'} onPress={() => setTab('settings')} />
        </View>
      </View>
    </SafeAreaView>
  );
}

function Header({ wallet, loading, onRefresh }: { wallet: string; loading: boolean; onRefresh: () => void }) {
  return (
    <Card style={styles.header}>
      <WhaleMark />
      <View style={styles.headerText}>
        <Text style={styles.title}>MoneroOcean Steam</Text>
        <Text style={styles.sub}>{wallet ? shortWallet(wallet) : 'No wallet set'}</Text>
      </View>
      {loading ? <ActivityIndicator color={theme.cyan} /> : <Button title="Refresh" onPress={onRefresh} />}
    </Card>
  );
}

function Dashboard({ stats, workers, onlineWorkers, currentHashrate }: { stats: MinerStats | null; workers: Worker[]; onlineWorkers: number; currentHashrate: number }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.grid}>
        <StatCard title="Hashrate" value={hashrate(currentHashrate)} foot="XMR normalized" />
        <StatCard title="Pending" value={atomicToXmr(stats?.amtDue ?? stats?.due)} foot="unpaid balance" />
      </View>
      <View style={styles.grid}>
        <StatCard title="Paid" value={atomicToXmr(stats?.amtPaid ?? stats?.paid)} foot="total payout" />
        <StatCard title="Workers" value={`${onlineWorkers} / ${workers.length}`} foot="online" />
      </View>
      <Card>
        <Text style={styles.cardTitle}>Pulse</Text>
        <Text style={styles.big}>{hashrate(stats?.hash ?? stats?.lastHash ?? 0)}</Text>
        <Text style={styles.sub}>raw hashrate</Text>
        <View style={styles.line} />
        <Text style={styles.sub}>last share {ageFromUnix(stats?.lastShare)} · tx {stats?.txnCount ?? 0}</Text>
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Chart</Text>
        <View style={styles.fakeChart}>
          {[34, 48, 39, 56, 46, 62, 50, 41, 59, 37, 45, 31].map((height, index) => (
            <View key={index} style={[styles.bar, { height }]} />
          ))}
        </View>
        <Text style={styles.sub}>live chart parser comes after sample JSON is locked</Text>
      </Card>
    </ScrollView>
  );
}

function Workers({ workers, onlineWorkers }: { workers: Worker[]; onlineWorkers: number }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card>
        <Text style={styles.cardTitle}>{onlineWorkers} / {workers.length} online</Text>
        {workers.length === 0 ? <Text style={styles.sub}>No workers yet.</Text> : null}
        {workers.map((worker) => (
          <View key={worker.id} style={styles.workerRow}>
            <StatusDot live={worker.hashrate > 0} />
            <View style={styles.workerText}>
              <Text style={styles.workerName}>{worker.name}</Text>
              <Text style={styles.sub}>{worker.algorithm ?? 'unknown algo'}</Text>
            </View>
            <Text style={styles.workerHash}>{hashrate(worker.hashrate)}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function Settings({ wallet, setWallet, onRefresh }: { wallet: string; setWallet: (value: string) => void; onRefresh: () => void }) {
  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card>
        <Text style={styles.cardTitle}>Wallet</Text>
        <TextInput
          value={wallet}
          onChangeText={setWallet}
          placeholder="XMR wallet address"
          placeholderTextColor={theme.sub}
          autoCapitalize="none"
          autoCorrect={false}
          multiline
          style={styles.input}
        />
        <Button title="Save and refresh" onPress={onRefresh} />
      </Card>
      <Card>
        <Text style={styles.cardTitle}>Build</Text>
        <Text style={styles.sub}>read-only · no keys · no wallet actions</Text>
        <Text style={styles.sub}>Windows path: Expo Go now, EAS iOS build later</Text>
      </Card>
    </ScrollView>
  );
}

function Tab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <Text onPress={onPress} style={[styles.tab, active && styles.tabActive]}>{label}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  shell: { flex: 1, backgroundColor: theme.bg, padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerText: { flex: 1 },
  title: { color: theme.text, fontSize: 18, fontWeight: '900' },
  sub: { color: theme.sub, fontSize: 12, lineHeight: 18 },
  content: { gap: 14, paddingBottom: 100 },
  grid: { flexDirection: 'row', gap: 12 },
  cardTitle: { color: theme.text, fontSize: 16, fontWeight: '900', marginBottom: 10 },
  big: { color: theme.text, fontSize: 36, fontWeight: '900' },
  line: { height: 1, backgroundColor: theme.line, marginVertical: 14 },
  fakeChart: { height: 120, flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingTop: 18 },
  bar: { flex: 1, backgroundColor: theme.cyan, borderRadius: 999, opacity: 0.85 },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopColor: theme.line, borderTopWidth: 1 },
  workerText: { flex: 1 },
  workerName: { color: theme.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  workerHash: { color: theme.text, fontSize: 13, fontWeight: '800' },
  input: { minHeight: 110, color: theme.text, backgroundColor: theme.panel2, borderColor: theme.line, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 14, fontSize: 13 },
  tabs: { position: 'absolute', left: 16, right: 16, bottom: 14, flexDirection: 'row', gap: 10, backgroundColor: theme.panel, borderColor: theme.line, borderWidth: 1, borderRadius: 22, padding: 8 },
  tab: { flex: 1, color: theme.sub, textAlign: 'center', paddingVertical: 10, borderRadius: 16, fontWeight: '800' },
  tabActive: { color: '#001018', backgroundColor: theme.cyan },
  error: { color: theme.red, fontSize: 13, fontWeight: '700' },
});
