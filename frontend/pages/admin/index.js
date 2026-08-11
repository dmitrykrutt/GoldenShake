import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  CheckBadgeIcon,
  ExclamationTriangleIcon,
  GiftIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import Layout from '../../components/Layout';
import api, { apiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';
import { RARITIES, RARITY_META, formatDateTime } from '../../lib/constants';

const TABS = [
  { key: 'stats', label: 'Dashboard', icon: ChartBarIcon },
  { key: 'support', label: 'Support', icon: ChatBubbleLeftRightIcon },
  { key: 'verifications', label: 'Verifications', icon: CheckBadgeIcon },
  { key: 'disputes', label: 'Disputes', icon: ExclamationTriangleIcon },
  { key: 'moderation', label: 'Moderation', icon: NoSymbolIcon },
];

function StatCard({ label, value, hint }) {
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className="font-display text-3xl gold-text">{value ?? '—'}</p>
      {hint && <p className="mt-1 text-[11px] text-neutral-600">{hint}</p>}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const { user, loading } = useRequireAuth();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [banForm, setBanForm] = useState({ username: '', reason: '' });
  const [grantForm, setGrantForm] = useState({ username: '', rarity: 'green', amount: 1, note: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!loading && user && !user.is_staff) router.replace('/chats');
  }, [loading, user, router]);

  const load = useCallback(async () => {
    try {
      const [statsRes, ticketsRes, verificationsRes, disputesRes] = await Promise.all([
        api.get('/admin-panel/stats/'),
        api.get('/admin-panel/support-queue/'),
        api.get('/admin-panel/verifications/'),
        api.get('/admin-panel/garant-complaints/'),
      ]);
      const list = (res) => (Array.isArray(res.data) ? res.data : res.data.results || []);
      setStats(statsRes.data);
      setTickets(list(ticketsRes));
      setVerifications(list(verificationsRes));
      setDisputes(list(disputesRes));
    } catch (err) {
      setError(apiError(err, 'Could not load the admin data.'));
    }
  }, []);

  useEffect(() => {
    if (user?.is_staff) load();
  }, [user, load]);

  const act = async (fn, message) => {
    setError('');
    setNotice('');
    try {
      await fn();
      setNotice(message);
      await load();
    } catch (err) {
      setError(apiError(err, 'Action failed.'));
    }
  };

  if (!user?.is_staff) {
    return (
      <Layout title="Admin">
        <div className="skeleton h-40 w-full" />
      </Layout>
    );
  }

  return (
    <Layout title="Admin">
      <h1 className="text-3xl">Control room</h1>
      <p className="mt-1 text-sm text-neutral-500">Staff-only moderation and platform health.</p>

      <div className="my-6 flex flex-wrap gap-2">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`btn ${tab === key ? 'btn-primary' : 'btn-dark'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {notice && <p className="mb-4 text-xs text-green-400">{notice}</p>}
      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      {tab === 'stats' && stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total users" value={stats.users?.total} hint={`${stats.users?.new_24h ?? 0} new in 24h`} />
          <StatCard label="Verified" value={stats.users?.verified} />
          <StatCard label="Online now" value={stats.users?.online} />
          <StatCard label="Messages 24h" value={stats.messages_24h} />
          <StatCard label="Open tickets" value={stats.queues?.support_open} />
          <StatCard label="Pending verifications" value={stats.queues?.verifications_pending} />
          <StatCard label="Open disputes" value={stats.queues?.disputes_open} />
          <StatCard label="Coin transactions 24h" value={stats.coin_transactions_24h} />
        </div>
      )}

      {tab === 'support' && (
        <div className="card">
          <h2 className="text-xl">Support queue</h2>
          <ul className="mt-4 divide-y divide-white/5">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-white">{ticket.subject || 'Support request'}</p>
                  <p className="text-[11px] text-neutral-500">
                    @{ticket.opened_by?.username} · {ticket.status} ·{' '}
                    {formatDateTime(ticket.created_at)}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() =>
                    act(
                      () => api.post(`/admin-panel/support-queue/${ticket.id}/assign/`),
                      'Ticket assigned to you.'
                    )
                  }
                >
                  Assign to me
                </button>
                <button
                  type="button"
                  className="btn-dark text-xs"
                  onClick={() =>
                    act(
                      () => api.post(`/admin-panel/support-queue/${ticket.id}/close/`),
                      'Ticket closed.'
                    )
                  }
                >
                  Close
                </button>
              </li>
            ))}
            {!tickets.length && (
              <li className="py-8 text-center text-sm text-neutral-600">Queue is empty.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'verifications' && (
        <div className="card">
          <h2 className="text-xl">Verification requests</h2>
          <ul className="mt-4 divide-y divide-white/5">
            {verifications.map((request) => (
              <li key={request.id} className="flex flex-wrap items-start gap-3 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white">@{request.user?.username}</p>
                  <p className="mt-1 text-xs text-neutral-400">{request.reason}</p>
                  {request.proof_url && (
                    <a
                      href={request.proof_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-xs text-gold hover:underline"
                    >
                      Evidence
                    </a>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={() =>
                    act(
                      () =>
                        api.post(`/admin-panel/verifications/${request.id}/review/`, {
                          decision: 'approve',
                        }),
                      'Account verified.'
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="btn-dark text-xs"
                  onClick={() =>
                    act(
                      () =>
                        api.post(`/admin-panel/verifications/${request.id}/review/`, {
                          decision: 'reject',
                        }),
                      'Request rejected.'
                    )
                  }
                >
                  Reject
                </button>
              </li>
            ))}
            {!verifications.length && (
              <li className="py-8 text-center text-sm text-neutral-600">Nothing pending.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'disputes' && (
        <div className="card">
          <h2 className="text-xl">Garant disputes</h2>
          <ul className="mt-4 divide-y divide-white/5">
            {disputes.map((dispute) => (
              <li key={dispute.id} className="py-4">
                <p className="text-sm text-white">
                  Deal {String(dispute.deal).slice(0, 8)} · @{dispute.complainant?.username}
                </p>
                <p className="mt-1 text-xs text-neutral-400">{dispute.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['buyer', 'seller', 'reject'].map((decision) => (
                    <button
                      key={decision}
                      type="button"
                      className={decision === 'reject' ? 'btn-dark text-xs' : 'btn-ghost text-xs'}
                      onClick={() =>
                        act(
                          () =>
                            api.post(`/admin-panel/garant-complaints/${dispute.id}/resolve/`, {
                              decision,
                            }),
                          `Dispute resolved (${decision}).`
                        )
                      }
                    >
                      {decision === 'reject' ? 'Reject claim' : `Resolve for ${decision}`}
                    </button>
                  ))}
                </div>
              </li>
            ))}
            {!disputes.length && (
              <li className="py-8 text-center text-sm text-neutral-600">No open disputes.</li>
            )}
          </ul>
        </div>
      )}

      {tab === 'moderation' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            className="card"
            onSubmit={(event) => {
              event.preventDefault();
              act(
                () => api.post('/admin-panel/moderation/ban/', banForm),
                `@${banForm.username} banned.`
              );
            }}
          >
            <h2 className="flex items-center gap-2 text-xl">
              <NoSymbolIcon className="h-5 w-5 text-red-400" /> Ban a user
            </h2>
            <label className="label mt-4" htmlFor="ban-username">
              Username
            </label>
            <input
              id="ban-username"
              required
              className="input"
              value={banForm.username}
              onChange={(event) => setBanForm({ ...banForm, username: event.target.value })}
            />
            <label className="label mt-4" htmlFor="ban-reason">
              Reason
            </label>
            <textarea
              id="ban-reason"
              required
              rows={3}
              className="input resize-none"
              value={banForm.reason}
              onChange={(event) => setBanForm({ ...banForm, reason: event.target.value })}
            />
            <div className="mt-4 flex gap-3">
              <button type="submit" className="btn-primary flex-1">
                Ban
              </button>
              <button
                type="button"
                className="btn-dark flex-1"
                onClick={() =>
                  act(
                    () =>
                      api.delete('/admin-panel/moderation/ban/', {
                        data: { username: banForm.username },
                      }),
                    `@${banForm.username} unbanned.`
                  )
                }
              >
                Unban
              </button>
            </div>
          </form>

          <form
            className="card"
            onSubmit={(event) => {
              event.preventDefault();
              act(
                () =>
                  api.post('/admin-panel/moderation/grant-coins/', {
                    ...grantForm,
                    amount: Number(grantForm.amount),
                  }),
                'Coins granted.'
              );
            }}
          >
            <h2 className="flex items-center gap-2 text-xl">
              <GiftIcon className="h-5 w-5 text-gold" /> Grant handshakes
            </h2>
            <label className="label mt-4" htmlFor="grant-username">
              Username
            </label>
            <input
              id="grant-username"
              required
              className="input"
              value={grantForm.username}
              onChange={(event) => setGrantForm({ ...grantForm, username: event.target.value })}
            />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="grant-rarity">
                  Rarity
                </label>
                <select
                  id="grant-rarity"
                  className="input"
                  value={grantForm.rarity}
                  onChange={(event) => setGrantForm({ ...grantForm, rarity: event.target.value })}
                >
                  {RARITIES.map((rarity) => (
                    <option key={rarity} value={rarity}>
                      {RARITY_META[rarity].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="grant-amount">
                  Amount
                </label>
                <input
                  id="grant-amount"
                  type="number"
                  min="1"
                  className="input"
                  value={grantForm.amount}
                  onChange={(event) => setGrantForm({ ...grantForm, amount: event.target.value })}
                />
              </div>
            </div>
            <label className="label mt-4" htmlFor="grant-note">
              Note
            </label>
            <input
              id="grant-note"
              className="input"
              value={grantForm.note}
              onChange={(event) => setGrantForm({ ...grantForm, note: event.target.value })}
            />
            <button type="submit" className="btn-primary mt-4 w-full">
              Grant
            </button>
          </form>
        </div>
      )}
    </Layout>
  );
}
