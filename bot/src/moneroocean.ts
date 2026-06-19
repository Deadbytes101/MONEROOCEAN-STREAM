const API_BASE = "https://api.moneroocean.stream";

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

export type WorkerRecord = Record<string, unknown>;
export type WorkerMap = Record<string, WorkerRecord>;

export type PaymentRecord = Record<string, unknown>;

export type PaymentsResponse = {
  data?: PaymentRecord[];
  payments?: PaymentRecord[];
  items?: PaymentRecord[];
};

const XMR_ADDRESS_PATTERN = /^[48][1-9A-HJ-NP-Za-km-z]{94}([1-9A-HJ-NP-Za-km-z]{11})?$/;

export function isXmrAddress(address: string): boolean {
  return XMR_ADDRESS_PATTERN.test(address);
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      accept: "application/json",
      "user-agent": "moneroocean-stream-bot/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`MoneroOcean API returned ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as T;
}

function assertWallet(wallet: string): void {
  if (!isXmrAddress(wallet)) {
    throw new Error("Invalid XMR wallet address");
  }
}

export async function getMinerStats(wallet: string): Promise<MinerStats> {
  assertWallet(wallet);
  return getJson<MinerStats>(`/miner/${wallet}/stats`);
}

export async function getWorkers(wallet: string): Promise<WorkerMap> {
  assertWallet(wallet);
  return getJson<WorkerMap>(`/miner/${wallet}/stats/allWorkers`);
}

export async function getPayments(wallet: string): Promise<PaymentRecord[]> {
  assertWallet(wallet);

  const response = await getJson<PaymentRecord[] | PaymentsResponse>(
    `/miner/${wallet}/payments?page=0&limit=15`,
  );

  if (Array.isArray(response)) return response;
  if (Array.isArray(response.data)) return response.data;
  if (Array.isArray(response.payments)) return response.payments;
  if (Array.isArray(response.items)) return response.items;

  return [];
}

export function atomicToXmr(value: number | undefined): string {
  const atomic = Number(value ?? 0);
  return (atomic / 1_000_000_000_000).toFixed(6);
}

export function formatHashrate(value: number | undefined): string {
  const h = Number(value ?? 0);

  if (h >= 1_000_000) return `${(h / 1_000_000).toFixed(2)} MH/s`;
  if (h >= 1_000) return `${(h / 1_000).toFixed(2)} KH/s`;

  return `${h.toFixed(2)} H/s`;
}

export function shortWallet(wallet: string): string {
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-8)}`;
}

export function readNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const raw = record[key];

    if (typeof raw === "number" && Number.isFinite(raw)) {
      return raw;
    }

    if (typeof raw === "string" && raw.trim() !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return undefined;
}

export function readString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = record[key];
    if (typeof raw === "string" && raw.trim() !== "") return raw;
  }

  return undefined;
}
