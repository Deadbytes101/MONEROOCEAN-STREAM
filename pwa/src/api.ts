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

export type Payment = {
  id: string;
  amountAtomic: number;
  label: string;
  txid?: string;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, {
    headers: { accept: 'application/json' },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Proxy API ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getMinerStats(wallet: string): Promise<MinerStats> {
  return getJson<MinerStats>(`/api/miner/${encodeURIComponent(wallet)}/stats`);
}

export async function getWorkers(wallet: string): Promise<Worker[]> {
  return getJson<Worker[]>(`/api/miner/${encodeURIComponent(wallet)}/workers`);
}

export async function getPayments(wallet: string): Promise<Payment[]> {
  return getJson<Payment[]>(`/api/miner/${encodeURIComponent(wallet)}/payments`);
}
