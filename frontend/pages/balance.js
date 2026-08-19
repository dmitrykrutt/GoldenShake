import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowUpIcon, ArrowsRightLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import HandshakeBadge from '../components/HandshakeBadge';
import HandshakeIcon from '../components/HandshakeIcon';
import api, { apiError } from '../lib/api';
import { useRequireAuth } from '../lib/auth';
import { EXCHANGE_RATES, RARITIES, RARITY_META, formatDateTime } from '../lib/constants';

function formatLevelName(level) {
  if (!level) return '';
  const base = level.replace('_plus', '');
  const isPlus = level.includes('plus');
  const meta = RARITY_META[base] || RARITY_META.green;
  return `${meta.label}${isPlus ? ' +' : ''}`;
}

export default function BalancePage() {
  const { user } = useRequireAuth();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [fiatBalances, setFiatBalances] = useState([]);
  const [fiatTransactions, setFiatTransactions] = useState([]);
  const [target, setTarget] = useState('blue');
  const [count, setCount] = useState(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawCurrency, setWithdrawCurrency] = useState('USDT');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCheckUrl, setWithdrawCheckUrl] = useState('');

  const load = useCallback(async () => {
    try {
      const [balanceRes, txRes, fiatRes, fiatTxRes] = await Promise.all([
        api.get('/coins/balance/'),
        api.get('/coins/transactions/'),
        api.get('/coins/fiat-balance/').catch(() => ({ data: [] })),
        api.get('/coins/fiat-transactions/').catch(() => ({ data: [] })),
      ]);
      setBalance(balanceRes.data);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data.results || []);
      setFiatBalances(Array.isArray(fiatRes.data) ? fiatRes.data : []);
      setFiatTransactions(Array.isArray(fiatTxRes.data) ? fiatTxRes.data : []);
    } catch (err) {
      setError(apiError(err, 'Не удалось загрузить баланс.'));
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
      const { data } = await api.post('/coins/exchange/', { target_rarity: target, count: Number(count) });
      setNotice(`Успешно создано ${data.minted ?? count} ${RARITY_META[target].label}.`);
      await load();
    } catch (err) {
      setError(apiError(err, 'Ошибка обмена.'));
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/coins/withdraw/', {
        amount: withdrawAmount,
        currency: withdrawCurrency,
      });
      setWithdrawCheckUrl(data.check_url);
      setNotice(`Чек на ${withdrawAmount} ${withdrawCurrency} успешно создан!`);
      await load();
    } catch (err) {
      setError(apiError(err, 'Не удалось создать чек на вывод.'));
    } finally {
      setBusy(false);
    }
  };

  const balances = balance?.balances || {};
  const rate = EXCHANGE_RATES[target];
  const CRYPTOS = ['USDT', 'TON'];
  const nextRarityMeta = balance?.next_rarity ? RARITY_META[balance.next_rarity] : null;

  return (
    <Layout title="Баланс">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-white">Баланс рукопожатий</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Зарабатывайте рукопожатия, приглашая участников, завершая гарант-сделки и получая донаты.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/levels"
            className="flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/10 px-3.5 py-2 text-xs font-bold text-gold hover:bg-gold/20 transition"
          >
            <span>Все уровни</span>
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
          {balance?.level && <HandshakeBadge level={balance.level} size="lg" />}
        </div>
      </div>

      {/* Карточки рукопожатий */}
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {RARITIES.map((rarity) => {
          const meta = RARITY_META[rarity];
          return (
            <div
              key={rarity}
              className="flex flex-col items-center justify-center rounded-2xl border p-5 text-center transition hover:scale-[1.02]"
              style={{ borderColor: `${meta.color}44`, backgroundColor: `${meta.color}0F` }}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <HandshakeIcon className="h-6 w-6" color="#FFFFFF" />
              </div>
              <p className="mt-2 font-display text-3xl font-bold" style={{ color: meta.color }}>
                {balances[rarity] ?? 0}
              </p>
              <p className="mt-1 text-xs text-neutral-400 font-semibold">{meta.label}</p>
            </div>
          );
        })}
      </div>

      {/* Прогресс следующего уровня со ссылкой */}
      {balance?.next_level && (
        <div className="card mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-neutral-400">
                Следующий уровень:
                <strong className="text-gold font-semibold ml-1.5">
                  {formatLevelName(balance.next_level)}
                </strong>
              </span>
              <span className="text-neutral-500">·</span>
              <span className="text-neutral-400">
                Ещё <strong className="text-white">{balance.needed}</strong> {nextRarityMeta?.label || balance.next_rarity}
              </span>
            </div>

            <Link
              href="/levels"
              className="inline-flex items-center gap-1 text-xs font-semibold text-gold hover:underline"
            >
              Смотреть все уровни <ChevronRightIcon className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-graphite-lighter">
            <div
              className="h-full rounded-full bg-gold-gradient transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(5, 100 - (balance.needed / 100) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Фиатный баланс */}
      <div className="card mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-white">Фиатный баланс</h2>
          <button
            type="button"
            onClick={() => { setShowWithdraw(true); setWithdrawCheckUrl(''); }}
            className="btn-primary py-2 text-xs flex items-center gap-2"
          >
            <ArrowUpIcon className="h-4 w-4" /> Вывести средства
          </button>
        </div>
        {fiatBalances.length === 0 ? (
          <p className="text-sm text-neutral-500">Нет доступных средств на балансе.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fiatBalances.map((fb) => (
              <div key={fb.currency} className="rounded-xl border border-white/10 p-4 bg-white/[0.02]">
                <p className="text-xs text-neutral-500 font-semibold">{fb.currency}</p>
                <p className="mt-1 text-2xl font-semibold text-gold">{Number(fb.amount).toFixed(2)}</p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => { setWithdrawCurrency(fb.currency); setWithdrawCheckUrl(''); setShowWithdraw(true); }}
                    className="btn-dark w-full py-1.5 text-xs flex items-center justify-center gap-1.5"
                  >
                    <ArrowUpIcon className="h-3.5 w-3.5" /> Вывести
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* История фиатных транзакций */}
      {fiatTransactions.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-4 text-xl font-display font-bold text-white">История фиатных транзакций</h2>
          <ul className="divide-y divide-white/5">
            {fiatTransactions.slice(0, 15).map((tx) => (
              <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm capitalize text-neutral-300">{tx.tx_type.replace(/_/g, ' ')}</p>
                  {tx.description && <p className="text-[11px] text-neutral-600">{tx.description}</p>}
                </div>
                <span className={`shrink-0 text-sm font-semibold ${tx.tx_type === 'withdrawal' ? 'text-red-400' : 'text-green-400'}`}>
                  {tx.tx_type === 'withdrawal' ? '−' : '+'}{Number(tx.amount).toFixed(2)} {tx.currency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ковка и активность */}
      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={doExchange} className="card">
          <h2 className="flex items-center gap-2 text-xl font-display font-bold text-white">
            <ArrowsRightLeftIcon className="h-5 w-5 text-gold" /> Ковка рукопожатий
          </h2>
          <p className="mt-2 text-sm text-neutral-400">Сжигайте рукопожатия низкого ранга для создания более редких.</p>
          <div className="mt-5">
            <label className="label" htmlFor="target">Целевая редкость</label>
            <select id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {Object.keys(EXCHANGE_RATES).map((key) => (
                <option key={key} value={key}>{RARITY_META[key].label}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="count">Количество</label>
            <input id="count" type="number" min="1" className="input" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          {rate && (
            <p className="mt-4 rounded-xl bg-black/40 p-3 text-xs text-neutral-400">
              Стоимость: <strong style={{ color: RARITY_META[rate.from].color }}>{rate.amount * (Number(count) || 1)} {RARITY_META[rate.from].label}</strong> → {count || 1} {RARITY_META[target].label}. У вас на балансе {balances[rate.from] ?? 0}.
            </p>
          )}
          {notice && <p className="mt-3 text-xs text-green-400">{notice}</p>}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">{busy ? 'Ковка…' : 'Обменять'}</button>
        </form>

        <div className="card">
          <h2 className="text-xl font-display font-bold text-white">Последняя активность</h2>
          <ul className="mt-4 divide-y divide-white/5">
            {transactions.slice(0, 12).map((tx) => {
              const incoming = tx.to_username === user?.username;
              const meta = RARITY_META[tx.rarity] || RARITY_META.green;
              return (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm">
                      <span className="capitalize text-neutral-300">{tx.transaction_type.replace(/_/g, ' ')}</span>
                      {tx.from_username && incoming && <span className="text-neutral-500"> от @{tx.from_username}</span>}
                      {tx.to_username && !incoming && <span className="text-neutral-500"> для @{tx.to_username}</span>}
                    </p>
                    <p className="text-[11px] text-neutral-600">{formatDateTime(tx.created_at)}{tx.memo ? ` · ${tx.memo}` : ''}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold" style={{ color: incoming ? meta.color : '#8A8A8E' }}>
                    {incoming ? '+' : '−'}{tx.amount} {meta.label}
                  </span>
                </li>
              );
            })}
            {!transactions.length && (
              <li className="py-8 text-center text-sm text-neutral-600">Активности пока нет.</li>
            )}
          </ul>
        </div>
      </div>

      {/* Модалка вывода (CryptoPay Check) */}
      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={doWithdraw} className="w-full max-w-md rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl font-bold text-white">Мгновенный вывод средств</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Средства выдаются в виде чека CryptoBot и сразу зачисляются на ваш баланс в Telegram.
            </p>

            {!withdrawCheckUrl ? (
              <>
                <div className="mt-5 space-y-4">
                  <div>
                    <label className="label" htmlFor="w-currency">Валюта</label>
                    <select id="w-currency" className="input" value={withdrawCurrency} onChange={(e) => setWithdrawCurrency(e.target.value)}>
                      {CRYPTOS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="label" htmlFor="w-amount">Сумма</label>
                    <input
                      id="w-amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      className="input"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

                <div className="mt-6 flex gap-3">
                  <button type="button" onClick={() => { setShowWithdraw(false); setError(''); }} className="btn-dark flex-1">
                    Отмена
                  </button>
                  <button type="submit" disabled={busy} className="btn-primary flex-1">
                    {busy ? 'Создание чека…' : 'Получить чек'}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                  <p className="text-sm font-semibold text-emerald-400">
                    Чек на {withdrawAmount} {withdrawCurrency} готов!
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    Нажмите кнопку ниже, чтобы забрать средства в Telegram.
                  </p>
                </div>

                <a
                  href={withdrawCheckUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block w-full py-3 text-center text-sm font-bold"
                >
                  Активировать чек в Telegram →
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setShowWithdraw(false);
                    setWithdrawCheckUrl('');
                    setWithdrawAmount('');
                  }}
                  className="btn-dark w-full"
                >
                  Закрыть
                </button>
              </div>
            )}
          </form>
        </div>
      )}
    </Layout>
  );
}
