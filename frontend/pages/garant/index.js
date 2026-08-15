import { useCallback, useEffect, useState } from 'react';
import {
  ClipboardDocumentIcon,
  PlusIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import GarantDeal from '../../components/GarantDeal';
import api, { apiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { CRYPTO_CURRENCIES } from '../../lib/constants';

export default function GarantIndexPage() {
  const { user } = useRequireAuth();
  const [activeDeals, setActiveDeals] = useState([]);
  const [historyDeals, setHistoryDeals] = useState([]);
  const [tab, setTab] = useState('active');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    price_crypto: '',
    crypto_currency: 'USDT',
  });
  const [created, setCreated] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [activeRes, historyRes] = await Promise.all([
        api.get('/garant/deals/'),
        api.get('/garant/deals/?history=true'),
      ]);
      setActiveDeals(Array.isArray(activeRes.data) ? activeRes.data : activeRes.data.results || []);
      setHistoryDeals(Array.isArray(historyRes.data) ? historyRes.data : historyRes.data.results || []);
    } catch (err) {
      setError(apiError(err, 'Не удалось загрузить ваши сделки.'));
    }
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const set = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const createDeal = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/garant/deals/', {
        title: form.title,
        description: form.description,
        price_crypto: form.price_crypto,
        crypto_currency: form.crypto_currency,
      });
      setCreated(data);
      setCreating(false);
      setForm({ title: '', description: '', price_crypto: '', crypto_currency: 'USDT' });
      await load();
    } catch (err) {
      setError(apiError(err, 'Не удалось создать сделку.'));
    } finally {
      setBusy(false);
    }
  };

  const copyLink = (url) => {
    if (navigator?.clipboard) navigator.clipboard.writeText(url);
    setNotice('Ссылка на сделку скопирована — отправьте её контрагенту.');
  };

  const deals = tab === 'active' ? activeDeals : historyDeals;

  return (
    <Layout title="Гарант">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-3xl">
            <ShieldCheckIcon className="h-8 w-8 text-gold" /> Гарант
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Безопасные криптосделки. Средства освобождаются только после подтверждения обеих сторон.
          </p>
        </div>
        <button type="button" onClick={() => setCreating(true)} className="btn-primary">
          <PlusIcon className="h-4 w-4" /> Новая сделка
        </button>
      </div>

      {notice && <p className="mb-4 text-xs text-green-400">{notice}</p>}
      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      <div className="mb-5 flex gap-2 border-b border-white/5">
        <button
          type="button"
          onClick={() => setTab('active')}
          className={`pb-2 text-sm font-medium transition-colors ${tab === 'active' ? 'border-b-2 border-gold text-gold' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          Активные ({activeDeals.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`pb-2 text-sm font-medium transition-colors ${tab === 'history' ? 'border-b-2 border-gold text-gold' : 'text-neutral-500 hover:text-neutral-300'}`}
        >
          История ({historyDeals.length})
        </button>
      </div>

      {created && (
        <div className="card mb-6 border-gold/40">
          <h2 className="text-lg">Сделка создана</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Поделитесь этой ссылкой с покупателем. Она нужна только ему.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-lg bg-black/50 px-3 py-2 text-xs text-gold">
              {created.private_url}
            </code>
            <button
              type="button"
              onClick={() => copyLink(created.private_url)}
              className="btn-ghost"
            >
              <ClipboardDocumentIcon className="h-4 w-4" /> Копировать
            </button>
          </div>
        </div>
      )}

      <div className="space-y-5">
        {deals.map((deal) => (
          <GarantDeal
            key={deal.id}
            deal={deal}
            currentUser={user}
            compact
            actions={
              <>
                <a href={`/garant/${deal.private_link_token}`} className="btn-ghost">
                  Открыть сделку
                </a>
                {deal.creator?.id === user?.id && (
                  <button
                    type="button"
                    onClick={() => copyLink(deal.private_url)}
                    className="btn-dark"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" /> Скопировать ссылку
                  </button>
                )}
              </>
            }
          />
        ))}
        {!deals.length && (
          <div className="card text-center text-sm text-neutral-500">
            {tab === 'active'
              ? 'У вас нет активных сделок. Создайте новую.'
              : 'История сделок пуста.'}
          </div>
        )}
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={createDeal} className="w-full max-w-lg rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Новая гарант-сделка</h2>
            <p className="mt-1 text-xs text-neutral-400">
              При освобождении средств взимается комиссия платформы 5%.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="title">
                  Название
                </label>
                <input
                  id="title"
                  required
                  className="input"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="Передача домена: example.com"
                />
              </div>

              <div>
                <label className="label" htmlFor="description">
                  Условия
                </label>
                <textarea
                  id="description"
                  required
                  rows={4}
                  className="input resize-none"
                  value={form.description}
                  onChange={set('description')}
                  placeholder="Что передаётся, когда и на каких условиях."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="price">
                    Цена
                  </label>
                  <input
                    id="price"
                    required
                    type="number"
                    step="0.00000001"
                    min="0.00000001"
                    className="input"
                    value={form.price_crypto}
                    onChange={set('price_crypto')}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="currency">
                    Валюта
                  </label>
                  <select
                    id="currency"
                    className="input"
                    value={form.crypto_currency}
                    onChange={set('crypto_currency')}
                  >
                    {CRYPTO_CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setCreating(false)} className="btn-dark flex-1">
                Отмена
              </button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                {busy ? 'Создание…' : 'Создать сделку'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Layout>
  );
}
