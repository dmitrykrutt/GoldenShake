import { useCallback, useEffect, useState } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import HandshakeBadge from '../components/HandshakeBadge';
import api, { apiError } from '../lib/api';
import { useRequireAuth } from '../lib/auth';
import { EXCHANGE_RATES, RARITIES, RARITY_META, formatDateTime } from '../lib/constants';

export default function BalancePage() {
  const { user } = useRequireAuth();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [target, setTarget] = useState('blue');
  const [count, setCount] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [balanceRes, txRes] = await Promise.all([
        api.get('/coins/balance/'),
        api.get('/coins/transactions/'),
      ]);
      setBalance(balanceRes.data);
      setTransactions(
        Array.isArray(txRes.data) ? txRes.data : txRes.data.results || []
      );
    } catch (err) {
      setError(apiError(err, 'Could not load your balance.'));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const doExchange = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const { data } = await api.post('/coins/exchange/', {
        target_rarity: target,
        count: Number(count),
      });
      setNotice(
        `Minted ${data.minted ?? count} ${RARITY_META[target].label} handshake(s).`
      );
      await load();
    } catch (err) {
      setError(apiError(err, 'Exchange failed.'));
    } finally {
      setBusy(false);
    }
  };

  const balances = balance?.balances || {};
  const rate = EXCHANGE_RATES[target];

  return (
    <Layout title="Balance">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Handshake balance</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Earn handshakes by inviting members, closing garant deals and receiving donations.
          </p>
        </div>
        {balance?.level && <HandshakeBadge level={balance.level} size="lg" />}
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {RARITIES.map((rarity) => {
          const meta = RARITY_META[rarity];
          return (
            <div
              key={rarity}
              className="rounded-2xl border p-5 text-center"
              style={{ borderColor: `${meta.color}44`, backgroundColor: `${meta.color}0F` }}
            >
              <span className="text-3xl">🤝</span>
              <p className="mt-2 font-display text-3xl" style={{ color: meta.color }}>
                {balances[rarity] ?? 0}
              </p>
              <p className="mt-1 text-xs text-neutral-500">{meta.label}</p>
            </div>
          );
        })}
      </div>

      {balance?.next_level && (
        <div className="card mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">
              Next level: <strong className="text-gold">{balance.next_level}</strong>
            </span>
            <span className="text-neutral-500">
              {balance.needed} more {balance.next_rarity} handshakes
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-graphite-lighter">
            <div
              className="h-full rounded-full bg-gold-gradient transition-all"
              style={{
                width: `${Math.min(
                  100,
                  ((balances[balance.next_rarity] || 0) /
                    Math.max(1, (balances[balance.next_rarity] || 0) + balance.needed)) *
                    100
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={doExchange} className="card">
          <h2 className="flex items-center gap-2 text-xl">
            <ArrowsRightLeftIcon className="h-5 w-5 text-gold" /> Forge handshakes
          </h2>
          <p className="mt-2 text-sm text-neutral-400">
            Burn lower-rarity handshakes to mint a higher rarity.
          </p>

          <div className="mt-5">
            <label className="label" htmlFor="target">
              Target rarity
            </label>
            <select
              id="target"
              className="input"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            >
              {Object.keys(EXCHANGE_RATES).map((key) => (
                <option key={key} value={key}>
                  {RARITY_META[key].label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className="label" htmlFor="count">
              How many
            </label>
            <input
              id="count"
              type="number"
              min="1"
              className="input"
              value={count}
              onChange={(event) => setCount(event.target.value)}
            />
          </div>

          {rate && (
            <p className="mt-4 rounded-xl bg-black/40 p-3 text-xs text-neutral-400">
              Cost:{' '}
              <strong style={{ color: RARITY_META[rate.from].color }}>
                {rate.amount * (Number(count) || 1)} {RARITY_META[rate.from].label}
              </strong>{' '}
              → {count || 1} {RARITY_META[target].label}. You hold{' '}
              {balances[rate.from] ?? 0}.
            </p>
          )}

          {notice && <p className="mt-3 text-xs text-green-400">{notice}</p>}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

          <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">
            {busy ? 'Forging…' : 'Exchange'}
          </button>
        </form>

        <div className="card">
          <h2 className="text-xl">Recent activity</h2>
          <ul className="mt-4 divide-y divide-white/5">
            {transactions.slice(0, 12).map((tx) => {
              const incoming = tx.to_username === user?.username;
              const meta = RARITY_META[tx.rarity] || RARITY_META.green;
              return (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="capitalize text-neutral-300">
                        {tx.transaction_type.replace(/_/g, ' ')}
                      </span>
                      {tx.from_username && incoming && (
                        <span className="text-neutral-500"> from @{tx.from_username}</span>
                      )}
                      {tx.to_username && !incoming && (
                        <span className="text-neutral-500"> to @{tx.to_username}</span>
                      )}
                    </p>
                    <p className="text-[11px] text-neutral-600">
                      {formatDateTime(tx.created_at)}
                      {tx.memo ? ` · ${tx.memo}` : ''}
                    </p>
                  </div>
                  <span
                    className="shrink-0 text-sm font-semibold"
                    style={{ color: incoming ? meta.color : '#8A8A8E' }}
                  >
                    {incoming ? '+' : '−'}
                    {tx.amount} {meta.label}
                  </span>
                </li>
              );
            })}
            {!transactions.length && (
              <li className="py-8 text-center text-sm text-neutral-600">No activity yet.</li>
            )}
          </ul>
        </div>
      </div>
    </Layout>
  );
}
