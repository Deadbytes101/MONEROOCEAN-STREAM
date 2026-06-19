import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getMinerStats, getPayments, getWorkers, type MinerStats, type Payment, type Worker } from './api';
import { ageFromUnix, atomicToXmr, hashrate, shortWallet } from './format';
import './style.css';

const walletKey = 'mo.wallet';

type Tab = 'dash' | 'workers' | 'payments' | 'settings';

function App() {
  const [wallet, setWallet] = useState(() => localStorage.getItem(walletKey) ?? '');
  const [stats, setStats] = useState<MinerStats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tab, setTab] = useState<Tab>('dash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState<Date | null>(null);

  const onlineWorkers = useMemo(() => workers.filter((worker) => worker.hashrate > 0).length, [workers]);
  const currentHashrate = stats?.hash2 ?? stats?.hash ?? 0;

  async function refresh() {
    const cleanWallet = wallet.trim();

    if (!cleanWallet) {
      setError('Set wallet first.');
      setTab('settings');
      return;
    }

    setBusy(true);
    setError('');

    try {
      localStorage.setItem(walletKey, cleanWallet);
      const [nextStats, nextWorkers, nextPayments] = await Promise.all([
        getMinerStats(cleanWallet),
        getWorkers(cleanWallet),
        getPayments(cleanWallet),
      ]);

      setStats(nextStats);
      setWorkers(nextWorkers);
      setPayments(nextPayments);
      setUpdated(new Date());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (wallet.trim()) void refresh();
  }, []);

  return (
    <main className="shell">
      <header className="hero card">
        <div className="mark">MO</div>
        <div className="heroText">
          <h1>MoneroOcean Steam</h1>
          <p>{wallet ? shortWallet(wallet) : 'No wallet set'} · proxy monitor</p>
        </div>
        <button className="primary" onClick={refresh} disabled={busy}>{busy ? 'Syncing' : 'Refresh'}</button>
      </header>

      {error ? <div className="error">{error}</div> : null}

      {tab === 'dash' ? (
        <section className="stack">
          <div className="grid two">
            <Stat title="Hashrate" value={hashrate(currentHashrate)} foot="XMR normalized" />
            <Stat title="Pending" value={atomicToXmr(stats?.amtDue ?? stats?.due)} foot="unpaid balance" />
          </div>
          <div className="grid two">
            <Stat title="Paid" value={atomicToXmr(stats?.amtPaid ?? stats?.paid)} foot="total payout" />
            <Stat title="Workers" value={`${onlineWorkers} / ${workers.length}`} foot="online" />
          </div>
          <section className="card pulse">
            <div>
              <p className="label">Pulse</p>
              <h2>{hashrate(stats?.hash ?? stats?.lastHash ?? 0)}</h2>
              <p className="sub">raw · last share {ageFromUnix(stats?.lastShare)} · tx {stats?.txnCount ?? 0}</p>
            </div>
            <div className="bars">{[42, 55, 46, 68, 50, 73, 62, 45, 66, 52, 75, 58].map((h, i) => <i key={i} style={{ height: `${h}%` }} />)}</div>
          </section>
          <section className="card status">
            <span className="dot ok" />
            <span>Cloudflare proxy active</span>
            <small>{updated ? updated.toLocaleTimeString() : 'not synced yet'}</small>
          </section>
        </section>
      ) : null}

      {tab === 'workers' ? (
        <section className="card list">
          <div className="listHead"><h2>Workers</h2><span>{onlineWorkers} / {workers.length} online</span></div>
          {workers.length === 0 ? <p className="sub">No workers yet.</p> : null}
          {workers.map((worker) => <WorkerRow key={worker.id} worker={worker} />)}
        </section>
      ) : null}

      {tab === 'payments' ? (
        <section className="card list">
          <div className="listHead"><h2>Payments</h2><span>{payments.length} rows</span></div>
          {payments.length === 0 ? <p className="sub">No payments found.</p> : null}
          {payments.map((payment) => (
            <div className="row" key={payment.id}>
              <div><b>{atomicToXmr(payment.amountAtomic)}</b><p>{payment.label}</p></div>
              <span>{payment.txid ? `${payment.txid.slice(0, 6)}...${payment.txid.slice(-6)}` : 'no tx'}</span>
            </div>
          ))}
        </section>
      ) : null}

      {tab === 'settings' ? (
        <section className="stack">
          <section className="card">
            <p className="label">Wallet</p>
            <textarea value={wallet} onChange={(event) => setWallet(event.target.value)} placeholder="XMR wallet address" />
            <button className="primary wide" onClick={refresh} disabled={busy}>Save and refresh</button>
          </section>
          <section className="card">
            <p className="label">Mode</p>
            <h2>Private PWA</h2>
            <p className="sub">Add to Home Screen · no keys · no wallet actions · API through your Cloudflare domain.</p>
          </section>
        </section>
      ) : null}

      <nav className="tabs">
        <button className={tab === 'dash' ? 'active' : ''} onClick={() => setTab('dash')}>Dash</button>
        <button className={tab === 'workers' ? 'active' : ''} onClick={() => setTab('workers')}>Workers</button>
        <button className={tab === 'payments' ? 'active' : ''} onClick={() => setTab('payments')}>Pay</button>
        <button className={tab === 'settings' ? 'active' : ''} onClick={() => setTab('settings')}>Settings</button>
      </nav>
    </main>
  );
}

function Stat({ title, value, foot }: { title: string; value: string; foot: string }) {
  return <section className="card stat"><p>{title}</p><b>{value}</b><small>{foot}</small></section>;
}

function WorkerRow({ worker }: { worker: Worker }) {
  return (
    <div className="row">
      <span className={`dot ${worker.hashrate > 0 ? 'ok' : 'bad'}`} />
      <div><b>{worker.name}</b><p>{worker.algorithm ?? 'unknown algo'}</p></div>
      <span>{hashrate(worker.hashrate)}</span>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
