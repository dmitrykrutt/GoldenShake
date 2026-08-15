import Layout from '../components/Layout';
import HandshakeBadge from '../components/HandshakeBadge';
import api, { apiError } from '../lib/api';
import { useRequireAuth } from '../lib/auth';
import { EXCHANGE_RATES, RARITIES, RARITY_META, formatDateTime } from '../lib/constants';

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
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositCurrency, setDepositCurrency] = useState('USDT');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositUrl, setDepositUrl] = useState('');
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawCurrency, setWithdrawCurrency] = useState('USDT');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawWallet, setWithdrawWallet] = useState('');

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
      const { data } = await api.post('/coins/exchange/', { target_rarity: target, count: Number(count) });
      setNotice(`Minted ${data.minted ?? count} ${RARITY_META[target].label} handshake(s).`);
      await load();
    } catch (err) {
      setError(apiError(err, 'Exchange failed.'));
    } finally {
      setBusy(false);
    }
  };

  const doDeposit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/coins/deposit/', { amount: depositAmount, currency: depositCurrency });
      setDepositUrl(data.pay_url);
      setNotice('Invoice created — open the link to pay via CryptoPay.');
    } catch (err) {
      setError(apiError(err, 'Could not create deposit invoice.'));
    } finally {
      setBusy(false);
    }
  };

  const doWithdraw = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/coins/withdraw/', { amount: withdrawAmount, currency: withdrawCurrency, wallet: withdrawWallet });
      setNotice('Withdrawal request submitted. It will be processed within 24 hours.');
      setShowWithdraw(false);
      setWithdrawAmount('');
      setWithdrawWallet('');
      await load();
    } catch (err) {
      setError(apiError(err, 'Could not submit withdrawal.'));
    } finally {
      setBusy(false);
    }
  };

  const balances = balance?.balances || {};
  const rate = EXCHANGE_RATES[target];
  const CRYPTOS = ['USDT', 'TON', 'BTC', 'ETH', 'LTC', 'TRX', 'BNB'];

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
            <div key={rarity} className="rounded-2xl border p-5 text-center"
              style={{ borderColor: `${meta.color}44`, backgroundColor: `${meta.color}0F` }}>
              <span className="text-3xl">🤝</span>
              <p className="mt-2 font-display text-3xl" style={{ color: meta.color }}>{balances[rarity] ?? 0}</p>
              <p className="mt-1 text-xs text-neutral-500">{meta.label}</p>
            </div>
          );
        })}
      </div>

      {balance?.next_level && (
        <div className="card mt-6">
          <div className="flex items-center justify-between text-sm">
            <span className="text-neutral-400">Next level: <strong className="text-gold">{balance.next_level}</strong></span>
            <span className="text-neutral-500">{balance.needed} more {balance.next_rarity} handshakes</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-graphite-lighter">
            <div className="h-full rounded-full bg-gold-gradient transition-all"
              style={{ width: `${Math.min(100, ((balances[balance.next_rarity] || 0) / Math.max(1, (balances[balance.next_rarity] || 0) + balance.needed)) * 100)}%` }} />
          </div>
        </div>
      )}

      <div className="card mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl">Фиатный баланс</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowDeposit(true)} className="btn-primary py-2 text-xs">
              <ArrowDownIcon className="h-4 w-4" /> Пополнить
            </button>
            <button type="button" onClick={() => setShowWithdraw(true)} className="btn-dark py-2 text-xs">
              <ArrowUpIcon className="h-4 w-4" /> Вывести
            </button>
          </div>
        </div>
        {fiatBalances.length === 0 ? (
          <p className="text-sm text-neutral-500">Нет фиатных балансов. Пополните с помощью CryptoPay.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fiatBalances.map((fb) => (
              <div key={fb.currency} className="rounded-xl border border-white/10 p-4">
                <p className="text-xs text-neutral-500">{fb.currency}</p>
                <p className="mt-1 text-2xl font-semibold text-gold">{Number(fb.amount).toFixed(2)}</p>
                <div className="mt-3 flex gap-2">
                  <button type="button" onClick={() => { setDepositCurrency(fb.currency); setShowDeposit(true); }}
                    className="btn-ghost flex-1 py-1.5 text-xs"><ArrowDownIcon className="h-3 w-3" /> Пополнить</button>
                  <button type="button" onClick={() => { setWithdrawCurrency(fb.currency); setShowWithdraw(true); }}
                    className="btn-dark flex-1 py-1.5 text-xs"><ArrowUpIcon className="h-3 w-3" /> Вывести</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {fiatTransactions.length > 0 && (
        <div className="card mt-6">
          <h2 className="mb-4 text-xl">История фиатных транзакций</h2>
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={doExchange} className="card">
          <h2 className="flex items-center gap-2 text-xl">
            <ArrowsRightLeftIcon className="h-5 w-5 text-gold" /> Forge handshakes
          </h2>
          <p className="mt-2 text-sm text-neutral-400">Burn lower-rarity handshakes to mint a higher rarity.</p>
          <div className="mt-5">
            <label className="label" htmlFor="target">Target rarity</label>
            <select id="target" className="input" value={target} onChange={(e) => setTarget(e.target.value)}>
              {Object.keys(EXCHANGE_RATES).map((key) => (
                <option key={key} value={key}>{RARITY_META[key].label}</option>
              ))}
            </select>
          </div>
          <div className="mt-4">
            <label className="label" htmlFor="count">How many</label>
            <input id="count" type="number" min="1" className="input" value={count} onChange={(e) => setCount(e.target.value)} />
          </div>
          {rate && (
            <p className="mt-4 rounded-xl bg-black/40 p-3 text-xs text-neutral-400">
              Cost: <strong style={{ color: RARITY_META[rate.from].color }}>{rate.amount * (Number(count) || 1)} {RARITY_META[rate.from].label}</strong> → {count || 1} {RARITY_META[target].label}. You hold {balances[rate.from] ?? 0}.
            </p>
          )}
          {notice && <p className="mt-3 text-xs text-green-400">{notice}</p>}
          {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary mt-5 w-full">{busy ? 'Forging…' : 'Exchange'}</button>
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
                      <span className="capitalize text-neutral-300">{tx.transaction_type.replace(/_/g, ' ')}</span>
                      {tx.from_username && incoming && <span className="text-neutral-500"> from @{tx.from_username}</span>}
                      {tx.to_username && !incoming && <span className="text-neutral-500"> to @{tx.to_username}</span>}
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
              <li className="py-8 text-center text-sm text-neutral-600">No activity yet.</li>
            )}
          </ul>
        </div>
      </div>

      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={doDeposit} className="w-full max-w-md rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Пополнить баланс</h2>
            <p className="mt-1 text-xs text-neutral-400">Пополнение через CryptoPay Bot.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="dep-currency">Валюта</label>
                <select id="dep-currency" className="input" value={depositCurrency} onChange={(e) => setDepositCurrency(e.target.value)}>
                  {CRYPTOS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="dep-amount">Сумма</label>
                <input id="dep-amount" type="number" step="0.01" min="0.01" required className="input" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
              </div>
            </div>
            {depositUrl && (
              <a href={depositUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 block w-full text-center">
                Открыть CryptoPay →
              </a>
            )}
            {!depositUrl && error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => { setShowDeposit(false); setDepositUrl(''); setError(''); }} className="btn-dark flex-1">Отмена</button>
              {!depositUrl && <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Создание…' : 'Создать счёт'}</button>}
            </div>
          </form>
        </div>
      )}

      {showWithdraw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={doWithdraw} className="w-full max-w-md rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Вывести средства</h2>
            <p className="mt-1 text-xs text-neutral-400">Заявка будет обработана в течение 24 часов.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="w-currency">Валюта</label>
                <select id="w-currency" className="input" value={withdrawCurrency} onChange={(e) => setWithdrawCurrency(e.target.value)}>
                  {CRYPTOS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="w-amount">Сумма</label>
                <input id="w-amount" type="number" step="0.01" min="0.01" required className="input" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
              </div>
              <div>
                <label className="label" htmlFor="w-wallet">Адрес кошелька</label>
                <input id="w-wallet" type="text" required className="input font-mono" value={withdrawWallet} onChange={(e) => setWithdrawWallet(e.target.value)} placeholder="TRC20 / ERC20 / TON адрес" />
              </div>
            </div>
            {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => { setShowWithdraw(false); setError(''); }} className="btn-dark flex-1">Отмена</button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? 'Отправка…' : 'Вывести'}</button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
