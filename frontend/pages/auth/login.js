import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Layout, { Logo } from '../../components/Layout';
import api, { apiError, tokens } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (router.query.username) setUsername(String(router.query.username));
    if (router.query.totp) setTotpCode(String(router.query.totp));
  }, [router.query.username, router.query.totp]);

  const signIn = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const { data } = await api.post('/accounts/login/', {
        username,
        password: password,
        totp_code: totpCode || undefined,
      });
      tokens.set({ access: data.access, refresh: data.refresh });
      await refresh();
      const next = router.query.next ? String(router.query.next) : '/chats';
      router.push(next);
    } catch (err) {
      setError(apiError(err, 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout title="Sign in" sidebar={false} fullBleed>
      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <Logo />
          </div>

          <div className="card">
            <h1 className="text-2xl">Welcome back</h1>
            <p className="mt-2 text-sm text-neutral-400">
              Sign in with your username and passphrase. If you enabled an authenticator app,
              enter the 6-digit code too.
            </p>

            <form onSubmit={signIn} className="mt-6 space-y-4">
              <div>
                <label className="label" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  required
                  className="input"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="nikolai"
                />
              </div>
              <div>
                <label className="label" htmlFor="pw">
                  Passphrase
                </label>
                <input
                  id="pw"
                  type="password"
                  required
                  className="input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div>
                <label className="label" htmlFor="totp-code">
                  Authenticator code
                </label>
                <input
                  id="totp-code"
                  maxLength={6}
                  inputMode="numeric"
                  className="input text-center font-mono text-xl tracking-[0.4em]"
                  value={totpCode}
                  onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {error && <p className="mt-4 text-xs text-red-400">{error}</p>}
          </div>

          <p className="mt-6 text-center text-sm text-neutral-500">
            Have an invite?{' '}
            <Link href="/auth/register" className="text-gold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </Layout>
  );
}
