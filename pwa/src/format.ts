export function atomicToXmr(value?: number): string {
  const xmr = Number(value ?? 0) / 1_000_000_000_000;
  return `${xmr.toFixed(6)} XMR`;
}

export function hashrate(value?: number): string {
  const h = Number(value ?? 0);
  if (h >= 1_000_000) return `${(h / 1_000_000).toFixed(2)} MH/s`;
  if (h >= 1_000) return `${(h / 1_000).toFixed(2)} KH/s`;
  return `${h.toFixed(2)} H/s`;
}

export function shortWallet(wallet: string): string {
  if (wallet.length <= 18) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-8)}`;
}

export function ageFromUnix(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'unknown';
  const delta = Math.max(0, Math.floor(Date.now() / 1000) - seconds);
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}
