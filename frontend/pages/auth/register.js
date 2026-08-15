import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout, { Logo } from '../../components/Layout';
import api, { apiError } from '../../lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    invite_token: '',
    username: '',
    password: '',
    password_confirm: '',
    phone: '',
    is_18_confirmed: false,
    tos_confirmed: false,
    newsletter_opt_in: false,
  });
  const [inviteState, setInviteState] = useState(null);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (router.query.invite && !form.invite_token) {
      setForm((prev) => ({ ...prev, invite_token: String(router.query.invite) }));
    }
  }, [router.query.invite, form.invite_token]);

  const set = (key) => (event) => {
    const value =
      event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const checkInvite = async () => {
    setError('');
    if (!form.invite_token) {
      setError('Требуется инвайт-токен — GoldenShake доступен только по приглашению.');
      return;
    }
    setBusy(true);
    try {
      const { data } = await api.get(
        `/accounts/invites/check/${encodeURIComponent(form.invite_token)}/`
      );
      setInviteState(data);
      if (data.valid) setStep(2);
      else setError('Эта ссылка-приглашение исчерпана или больше не активна.');
    } catch (err) {
      setError(apiError(err, 'Не удалось проверить ссылку-приглашение.'));
    } finally {
      setBusy(false);
    }
  };

  const submitRegistration = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/accounts/register/', {
        invite_token: form.invite_token,
        username: form.username,
        password: form.password,
        password_confirm: form.password_confirm,
        phone: form.phone || undefined,
        is_18_confirmed: form.is_18_confirmed,
        tos_confirmed: form.tos_confirmed,
        newsletter_opt_in: form.newsletter_opt_in,
      });
      setTotpSetup(data.totp_setup);
      setNotice('Аккаунт создан. Настройте аутентификатор и войдите.');
      setStep(3);
    } catch (err) {
      setError(apiError(err, 'Регистрация не выполнена.'));
    } finally {
      setBusy(false);
    }
  };

  const activateTotp = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      router.push(
        `/auth/login?username=${encodeURIComponent(form.username)}&totp=${encodeURIComponent(totpCode)}`
      );
    } catch (err) {
      setError(apiError(err, 'Could not start the login flow.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Создать аккаунт" sidebar={false} fullBleed>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="card">
            <div className="mb-6 flex items-center gap-2">
              {[1, 2, 3].map((n) => (
                <span
                  key={n}
                  className={`h-1 flex-1 rounded-full ${step >= n ? 'bg-gold' : 'bg-graphite-lighter'}`}
                />
              ))}
            </div>

            {step === 1 && (
              <>
                <h1 className="text-2xl">Введите приглашение</h1>
                <p className="mt-2 text-sm text-neutral-400">
                  GoldenShake доступен только по приглашению. Каждый участник может пригласить пять человек.
                </p>
                <div className="mt-6">
                  <label className="label" htmlFor="invite">
                    Код приглашения
                  </label>
                  <input
                    id="invite"
                    className="input font-mono"
                    value={form.invite_token}
                    onChange={set('invite_token')}
                    placeholder="a1b2c3d4e5f6…"
                  />
                </div>
                {inviteState?.valid && (
                  <p className="mt-3 text-xs text-green-400">
                    Valid invite from @{inviteState.inviter} · {inviteState.uses_left} осталось использований
                  </p>
                )}
                <button
                  type="button"
                  onClick={checkInvite}
                  disabled={busy}
                  className="btn-primary mt-6 w-full"
                >
                  {busy ? 'Проверка…' : 'Проверить приглашение'}
                </button>
              </>
            )}

            {step === 2 && (
              <form onSubmit={submitRegistration}>
                <h1 className="text-2xl">Создайте аккаунт</h1>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="label" htmlFor="username">
                      Имя пользователя
                    </label>
                    <input
                      id="username"
                      required
                      minLength={3}
                      maxLength={32}
                      className="input"
                      value={form.username}
                      onChange={set('username')}
                      placeholder="nikolai"
                    />
                  </div>

                  <div>
                    <label className="label" htmlFor="phone">
                      Телефон (необязательно)
                    </label>
                    <input
                      id="phone"
                      className="input"
                      value={form.phone}
                      onChange={set('phone')}
                      placeholder="+15551234567"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="label" htmlFor="pw1">
                        Пароль
                      </label>
                      <input
                        id="pw1"
                        type="password"
                        required
                        minLength={10}
                        className="input"
                        value={form.password}
                        onChange={set('password')}
                      />
                    </div>
                    <div>
                      <label className="label" htmlFor="pw2">
                        Repeat passphrase
                      </label>
                      <input
                        id="pw2"
                        type="password"
                        required
                        minLength={10}
                        className="input"
                        value={form.password_confirm}
                        onChange={set('password_confirm')}
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      required
                      checked={form.is_18_confirmed}
                      onChange={set('is_18_confirmed')}
                      className="mt-0.5 h-4 w-4 accent-[#C9A84C]"
                    />
                    I confirm that I am 18 years of age or older.
                  </label>

                  <label className="flex items-start gap-3 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      required
                      checked={form.tos_confirmed}
                      onChange={set('tos_confirmed')}
                      className="mt-0.5 h-4 w-4 accent-[#C9A84C]"
                    />
                    I accept the Terms of Service and the Privacy Policy.
                  </label>

                  <label className="flex items-start gap-3 text-xs text-neutral-400">
                    <input
                      type="checkbox"
                      checked={form.newsletter_opt_in}
                      onChange={set('newsletter_opt_in')}
                      className="mt-0.5 h-4 w-4 accent-[#C9A84C]"
                    />
                    Send me product updates (you can opt out any time).
                  </label>
                </div>

                <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
                  {busy ? 'Создание…' : 'Создать аккаунт'}
                </button>
              </form>
            )}

            {step === 3 && (
              <form onSubmit={activateTotp}>
                <h1 className="text-2xl">Two-factor authentication</h1>
                <p className="mt-2 text-sm text-neutral-400">
                  Scan the QR code with Google Authenticator, Aegis or 1&nbsp;Password.
                </p>

                {totpSetup?.qr_code && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={totpSetup.qr_code}
                    alt="TOTP QR code"
                    className="mx-auto mt-5 h-48 w-48 rounded-xl border border-gold/30 bg-white p-2"
                  />
                )}

                {totpSetup?.secret && (
                  <p className="mt-4 break-all rounded-lg bg-black/50 p-3 text-center font-mono text-xs text-gold">
                    {totpSetup.secret}
                  </p>
                )}

                <input
                  className="input mt-5 text-center font-mono text-xl tracking-[0.4em]"
                  maxLength={6}
                  inputMode="numeric"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />

                <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
                  {busy ? 'Finishing…' : 'Finish and sign in'}
                </button>
              </form>
            )}

            {notice && <p className="mt-4 text-xs text-gold">{notice}</p>}
            {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
          </div>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Already a member?{' '}
            <Link href="/auth/login" className="text-gold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
