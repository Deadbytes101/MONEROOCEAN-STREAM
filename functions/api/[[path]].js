const ocean = 'https://api.moneroocean.stream';

const jsonHeaders = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
};

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

function fail(message, status = 400) {
  return new Response(message, { status, headers: { ...jsonHeaders, 'content-type': 'text/plain; charset=utf-8' } });
}

function validWallet(value) {
  return /^[48][1-9A-HJ-NP-Za-km-z]{94}([1-9A-HJ-NP-Za-km-z]{11})?$/.test(value);
}

async function fetchOcean(path) {
  const response = await fetch(`${ocean}${path}`, {
    headers: { accept: 'application/json', 'user-agent': 'MoneroOceanSteam-PWA/0.1' },
  });

  const text = await response.text();

  if (!response.ok) {
    return fail(text || `MoneroOcean ${response.status}`, response.status);
  }

  try {
    return reply(JSON.parse(text));
  } catch {
    return fail('bad json from upstream', 502);
  }
}

function readNumber(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function readString(record, keys) {
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

async function workers(wallet) {
  const response = await fetch(`${ocean}/miner/${wallet}/stats/allWorkers`, {
    headers: { accept: 'application/json', 'user-agent': 'MoneroOceanSteam-PWA/0.1' },
  });

  if (!response.ok) {
    return fail(await response.text(), response.status);
  }

  const raw = await response.json();
  const rows = Object.entries(raw ?? {})
    .map(([name, fields]) => ({
      id: name,
      name,
      hashrate: readNumber(fields, ['hash2', 'hash', 'h', 'r', 'rate', 'hashrate']) ?? 0,
      algorithm: readString(fields, ['algo', 'algorithm', 'coin', 'ticker']),
    }))
    .sort((a, b) => b.hashrate - a.hashrate || a.name.localeCompare(b.name));

  return reply(rows);
}

async function payments(wallet) {
  const response = await fetch(`${ocean}/miner/${wallet}/payments?page=0&limit=15`, {
    headers: { accept: 'application/json', 'user-agent': 'MoneroOceanSteam-PWA/0.1' },
  });

  if (!response.ok) {
    return fail(await response.text(), response.status);
  }

  const raw = await response.json();
  const source = Array.isArray(raw) ? raw : raw?.data ?? raw?.payments ?? raw?.items ?? [];
  const rows = source.map((item, index) => {
    const amount = readNumber(item, ['amount', 'amt', 'value', 'paid']) ?? 0;
    const txid = readString(item, ['txid', 'tx', 'hash']);
    const label = readString(item, ['ts', 'time', 'date', 'timestamp']) ?? 'payment';

    return { id: txid ?? String(index), amountAtomic: amount, label, txid };
  });

  return reply(rows);
}

export async function onRequestGet({ params }) {
  const parts = String(params.path ?? '').split('/').filter(Boolean);

  if (parts[0] === 'health') {
    return reply({ ok: true, upstream: ocean });
  }

  if (parts[0] !== 'miner') {
    return fail('unknown api path', 404);
  }

  const wallet = parts[1] ?? '';
  const action = parts[2] ?? '';

  if (!validWallet(wallet)) {
    return fail('bad wallet', 400);
  }

  if (action === 'stats') {
    return fetchOcean(`/miner/${wallet}/stats`);
  }

  if (action === 'workers') {
    return workers(wallet);
  }

  if (action === 'payments') {
    return payments(wallet);
  }

  return fail('unknown miner action', 404);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type, accept',
    },
  });
}
