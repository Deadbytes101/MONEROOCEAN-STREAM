export type MinerStats = {
  amtDue?: number;
  amtPaid?: number;
  due?: number;
  paid?: number;
  hash?: number;
  hash2?: number;
  lastHash?: number;
  lastShare?: number;
  txnCount?: number;
};

export type Worker = {
  id: string;
  name: string;
  hashrate: number;
  algorithm?: string;
};

const API_BASE = 'https://api.moneroocean.stream';

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`MoneroOcean API ${response.status}`);
  }

  return (await response.json()) as T;
}

function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

export async function getMinerStats(wallet: string): Promise<MinerStats> {
  return getJson<MinerStats>(`/miner/${wallet}/stats`);
}

export async function getWorkers(wallet: string): Promise<Worker[]> {
  const raw = await getJson<Record<string, Record<string, unknown>>>(`/miner/${wallet}/stats/allWorkers`);

  return Object.entries(raw)
    .map(([name, fields]) => ({
      id: name,
      name,
      hashrate: readNumber(fields, ['hash2', 'hash', 'h', 'r', 'rate', 'hashrate']) ?? 0,
      algorithm: readString(fields, ['algo', 'algorithm', 'coin', 'ticker']),
    }))
    .sort((a, b) => b.hashrate - a.hashrate || a.name.localeCompare(b.name));
}
