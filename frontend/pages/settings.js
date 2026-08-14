import { useCallback, useEffect, useState } from 'react';
import {
  BellIcon,
  ClipboardDocumentIcon,
  ShieldCheckIcon,
  TrashIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import HandshakeBadge from '../components/HandshakeBadge';
import VerificationBadge from '../components/VerificationBadge';
import api, { apiError } from '../lib/api';
import { useRequireAuth } from '../lib/auth';

const THEMES = [
  { id: 'midnight', name: 'Midnight', primary: '#6C63FF', accent: '#FF6584', bg: '#0D0D1A' },
  { id: 'golden', name: 'Golden Hour', primary: '#F5A623', accent: '#F76B1C', bg: '#1A1200' },
  { id: 'emerald', name: 'Emerald', primary: '#00C896', accent: '#00E5FF', bg: '#001A12' },
  { id: 'crimson', name: 'Crimson', primary: '#E63946', accent: '#FF6B6B', bg: '#1A0005' },
  { id: 'ocean', name: 'Ocean', primary: '#0077B6', accent: '#00B4D8', bg: '#00080F' },
  { id: 'sakura', name: 'Sakura', primary: '#FF85A1', accent: '#FFC2D1', bg: '#1A0010' },
  { id: 'graphite', name: 'Graphite', primary: '#9E9E9E', accent: '#E0E0E0', bg: '#111111' },
  { id: 'aurora', name: 'Aurora', primary: '#7B2FBE', accent: '#00F5D4', bg: '#080318' },
];

const TABS = [
  { key: 'profile', label: 'Profile', icon: UserIcon },
  { key: 'security', label: 'Security', icon: ShieldCheckIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
  { key: 'privacy', label: 'Privacy & data', icon: TrashIcon },
];

export default function SettingsPage() {
  const { user, refresh } = useRequireAuth();
  const [tab, setTab] = useState('profile');
  const [form, setForm] = useState(null);
  const [invites, setInvites] = useState([]);
  const [prefs, setPrefs] = useState(null);
  const [verificationReason, setVerificationReason] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [invitesRes, prefsRes] = await Promise.all([
        api.get('/accounts/invites/'),
        api.get('/notifications/preferences/'),
      ]);
      setInvites(
        Array.isArray(invitesRes.data) ? invitesRes.data : invitesRes.data.results || []
      );
      setPrefs(prefsRes.data);
    } catch (err) {
      setError(apiError(err, 'Could not load settings.'));
    }
  }, []);

  useEffect(() => {
    if (user && !form) {
      setForm({
        username: user.username || '',
        bio: user.bio || '',
        phone: user.phone || '',
        theme_color: user.theme_color || 'midnight',
        private_profile: Boolean(user.private_profile),
        paid_messages_enabled: Boolean(user.paid_messages_enabled),
        paid_message_price: user.paid_message_price ?? 1,
        newsletter_opt_in: Boolean(user.newsletter_opt_in),
        telegram_chat_id: user.telegram_chat_id || '',
        social_links: JSON.stringify(user.social_links || {}, null, 2),
      });
      load();
    }
  }, [user, form, load]);

  const set = (key) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      let socialLinks = {};
      try {
        socialLinks = JSON.parse(form.social_links || '{}');
      } catch (parseError) {
        setError('Social links must be valid JSON, e.g. {"Telegram": "https://t.me/you"}');
        setBusy(false);
        return;
      }
      await api.patch('/accounts/profiles/me/update/', {
        username: form.username,
        bio: form.bio,
        phone: form.phone || '',
        theme_color: form.theme_color,
        private_profile: form.private_profile,
        paid_messages_enabled: form.paid_messages_enabled,
        ...(form.paid_messages_enabled ? { paid_message_price: Number(form.paid_message_price) } : { paid_message_price: 0 }),
        newsletter_opt_in: form.newsletter_opt_in,
        telegram_chat_id: form.telegram_chat_id || '',
        social_links: socialLinks,
      });
      await refresh();
      setNotice('Profile updated.');
    } catch (err) {
      setError(apiError(err, 'Could not save your profile.'));
    } finally {
      setBusy(false);
    }
  };

  const savePrefs = async (patch) => {
    try {
      const { data } = await api.patch('/notifications/preferences/', patch);
      setPrefs(data);
      setNotice('Notification preferences saved.');
    } catch (err) {
      setError(apiError(err, 'Could not save preferences.'));
    }
  };

  const createInvite = async () => {
    try {
      const { data } = await api.post('/accounts/invites/', {});
      setInvites((prev) => [data, ...prev]);
    } catch (err) {
      setError(apiError(err, 'Could not create an invite.'));
    }
  };

  const requestVerification = async (event) => {
    event.preventDefault();
    try {
      await api.post('/accounts/verification-requests/', { reason: verificationReason });
      setVerificationReason('');
      setNotice('Verification request submitted for review.');
    } catch (err) {
      setError(apiError(err, 'Could not submit the request.'));
    }
  };

  const requestGdpr = async () => {
    try {
      await api.post('/accounts/profiles/gdpr-export/', { confirm: true });
      setNotice('Your data export has been queued — check your inbox shortly.');
    } catch (err) {
      setError(apiError(err, 'Could not queue the export.'));
    }
  };

  const copy = (text) => {
    if (navigator?.clipboard) navigator.clipboard.writeText(text);
    setNotice('Copied to clipboard.');
  };

  if (!form) {
    return (
      <Layout title="Settings">
        <div className="skeleton h-64 w-full" />
      </Layout>
    );
  }

  return (
    <Layout title="Settings">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl">Settings</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-neutral-500">
            @{user.username}
            <VerificationBadge verified={user.is_verified} size={14} />
            <HandshakeBadge level={user.handshake_level || 'green'} size="sm" />
          </p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
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

      {tab === 'profile' && (
        <form onSubmit={saveProfile} className="card space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="username">
                Username
              </label>
              <input id="username" className="input" value={form.username} onChange={set('username')} />
            </div>
            <div>
              <label className="label" htmlFor="phone">
                Phone
              </label>
              <input id="phone" className="input" value={form.phone} onChange={set('phone')} />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="bio">
              Bio
            </label>
            <textarea
              id="bio"
              rows={3}
              className="input resize-none"
              value={form.bio}
              onChange={set('bio')}
            />
          </div>

          <div>
            <label className="label" htmlFor="social">
              Social links (JSON)
            </label>
            <textarea
              id="social"
              rows={4}
              className="input resize-none font-mono text-xs"
              value={form.social_links}
              onChange={set('social_links')}
            />
          </div>

          <div>
              <label className="label">Тема профиля</label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, theme_color: theme.id }))}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      form.theme_color === theme.id
                        ? 'border-white/40 ring-2 ring-white/20'
                        : 'border-white/10 hover:border-white/20'
                    }`}
                    style={{ background: theme.bg }}
                  >
                    <div className="mb-1.5 flex gap-1">
                      <span className="h-3 w-3 rounded-full" style={{ background: theme.primary }} />
                      <span className="h-3 w-3 rounded-full" style={{ background: theme.accent }} />
                    </div>
                    <p className="text-xs font-medium" style={{ color: theme.primary }}>
                      {theme.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="paid-price">
                Paid message price (green handshakes)
              </label>
              <input
                id="paid-price"
                type="number"
                min="1"
                className="input disabled:opacity-40"
                disabled={!form.paid_messages_enabled}
                value={form.paid_message_price}
                onChange={set('paid_message_price')}
              />
            </div>

          <label className="flex items-center gap-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#C9A84C]"
              checked={form.private_profile}
              onChange={set('private_profile')}
            />
            Private profile
          </label>

          <label className="flex items-center gap-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#C9A84C]"
              checked={form.paid_messages_enabled}
              onChange={set('paid_messages_enabled')}
            />
            Charge strangers to message me
          </label>

          <label className="flex items-center gap-3 text-sm text-neutral-300">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#C9A84C]"
              checked={form.newsletter_opt_in}
              onChange={set('newsletter_opt_in')}
            />
            Receive the GoldenShake newsletter
          </label>

          <div>
            <label className="label" htmlFor="telegram">
              Telegram chat ID (for SMS-style 2FA delivery)
            </label>
            <input
              id="telegram"
              className="input"
              value={form.telegram_chat_id}
              onChange={set('telegram_chat_id')}
              placeholder="123456789"
            />
          </div>

          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? 'Saving…' : 'Save profile'}
          </button>
        </form>
      )}

      {tab === 'security' && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl">Two-factor authentication</h2>
            <p className="mt-2 text-sm text-neutral-400">
              TOTP is {user.totp_enabled ? 'active' : 'not yet activated'} on this account.
              E-mail one-time codes are always required at sign-in.
            </p>
            <span
              className={`badge mt-4 border px-3 py-1 ${
                user.totp_enabled
                  ? 'border-green-500/40 bg-green-500/10 text-green-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-400'
              }`}
            >
              {user.totp_enabled ? 'Authenticator active' : 'Authenticator inactive'}
            </span>
          </div>

          <div className="card">
            <h2 className="text-xl">Invitations</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Each link admits up to five people. You earn handshakes for every member who joins.
            </p>
            <button type="button" onClick={createInvite} className="btn-ghost mt-4"
              style={['green', 'green_plus'].includes(user?.handshake_level) ? { display: 'none' } : {}}
            >
              Generate new invite
            </button>
            {['green', 'green_plus'].includes(user?.handshake_level) && (
              <p className="mt-3 text-xs text-neutral-500">Пользователи с зелёным статусом не могут создавать приглашения.</p>
            )}
            <ul className="mt-4 divide-y divide-white/5">
              {invites.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 py-3">
                  <code className="min-w-0 flex-1 truncate text-xs text-gold">{invite.url}</code>
                  <span className="text-[11px] text-neutral-500">
                    {invite.use_count}/{invite.max_uses} used
                  </span>
                  <button
                    type="button"
                    aria-label="Copy invite"
                    onClick={() => copy(invite.url)}
                    className="text-neutral-400 hover:text-gold"
                  >
                    <ClipboardDocumentIcon className="h-4 w-4" />
                  </button>
                </li>
              ))}
              {!invites.length && (
                <li className="py-6 text-center text-sm text-neutral-600">No invites yet.</li>
              )}
            </ul>
          </div>

          <form onSubmit={requestVerification} className="card">
            <h2 className="text-xl">Request verification</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Tell us who you are and why your account should carry the golden badge.
            </p>
            <textarea
              rows={3}
              required
              className="input mt-4 resize-none"
              value={verificationReason}
              onChange={(event) => setVerificationReason(event.target.value)}
              placeholder="I run the @example trading desk…"
            />
            <button type="submit" className="btn-primary mt-4">
              Submit request
            </button>
          </form>
        </div>
      )}

      {tab === 'notifications' && prefs && (
        <div className="card space-y-4">
          <h2 className="text-xl">Delivery channels</h2>
          {[
            ['push_enabled', 'Push notifications (Firebase)'],
            ['email_enabled', 'E-mail notifications'],
            ['telegram_enabled', 'Telegram messages'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-3 text-sm text-neutral-300">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[#C9A84C]"
                checked={Boolean(prefs[key])}
                onChange={(event) => savePrefs({ [key]: event.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      )}

      {tab === 'privacy' && (
        <div className="card space-y-5">
          <div>
            <h2 className="text-xl">Export your data (GDPR)</h2>
            <p className="mt-2 text-sm text-neutral-400">
              We will e-mail you a machine-readable archive of everything we store about you.
            </p>
            <button type="button" onClick={requestGdpr} className="btn-ghost mt-4">
              Request data export
            </button>
          </div>
          <div className="divider" />
          <div>
            <h2 className="text-xl text-red-400">Danger zone</h2>
            <p className="mt-2 text-sm text-neutral-400">
              Account deletion is handled by support so that active escrow deals can be settled
              first. Open a support ticket from any chat to begin.
            </p>
          </div>
        </div>
      )}
    </Layout>
  );
}
