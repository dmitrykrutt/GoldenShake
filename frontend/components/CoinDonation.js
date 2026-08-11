import { useState } from 'react';
import api, { apiError } from '../lib/api';
import { RARITIES, RARITY_META } from '../lib/constants';

export default function CoinDonation({
  recipientUsername,
  roomId = null,
  balances = {},
  onDone,
  onClose,
}) {
  const [rarity, setRarity] = useState('green');
  const [amount, setAmount] = useState(1);
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/coins/donate/', {
        recipient_username: recipientUsername,
        rarity,
        amount: Number(amount),
        memo: memo || undefined,
        room_id: roomId || undefined,
      });
      onDone?.(data);
      onClose?.();
    } catch (err) {
      setError(apiError(err, 'Donation failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl glass-gold p-6">
        <h3 className="font-display text-xl">
          Send a handshake to <span className="gold-text">@{recipientUsername}</span>
        </h3>
        <p className="mt-1 text-xs text-neutral-400">
          Handshakes are the reputation currency of GoldenShake. Donations are irreversible.
        </p>

        <div className="mt-5">
          <span className="label">Rarity</span>
          <div className="grid grid-cols-5 gap-2">
            {RARITIES.map((key) => {
              const meta = RARITY_META[key];
              const selected = rarity === key;
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setRarity(key)}
                  className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                    selected ? 'ring-2' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{
                    color: meta.color,
                    borderColor: `${meta.color}55`,
                    backgroundColor: selected ? `${meta.color}22` : 'transparent',
                  }}
                >
                  {meta.label}
                  <span className="mt-0.5 block text-[10px] text-neutral-500">
                    {balances[key] ?? 0}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="donation-amount">
            Amount
          </label>
          <input
            id="donation-amount"
            type="number"
            min="1"
            max={balances[rarity] || 1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="input"
          />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="donation-memo">
            Message (optional)
          </label>
          <input
            id="donation-memo"
            type="text"
            maxLength={255}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder="Thanks for the deal!"
            className="input"
          />
        </div>

        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} className="btn-dark flex-1">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn-primary flex-1">
            {busy ? 'Sending…' : 'Send handshake'}
          </button>
        </div>
      </form>
    </div>
  );
}
