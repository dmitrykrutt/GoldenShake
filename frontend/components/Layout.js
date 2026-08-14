import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';
import {
  ArrowLeftOnRectangleIcon,
  Bars3Icon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../lib/auth';
import HandshakeBadge from './HandshakeBadge';
import Username from './Username';

const NAV = [
  { href: '/chats', label: 'Chats', icon: ChatBubbleLeftRightIcon },
  { href: '/balance', label: 'Balance', icon: CurrencyDollarIcon },
  { href: '/garant', label: 'Garant', icon: ShieldCheckIcon },
  { href: '/settings', label: 'Settings', icon: Cog6ToothIcon },
];

export function Logo({ compact = false }) {
  const { user } = useAuth();
  const logoHref = user ? '/chats' : '/';
  return (
    <Link href={logoHref} className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-gradient text-black shadow-gold">
        <SparklesIcon className="h-5 w-5" />
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-wide">
          Golden<span className="gold-text">Shake</span>
        </span>
      )}
    </Link>
  );
}

export default function Layout({ children, title = 'GoldenShake', sidebar = true, fullBleed = false }) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  const nav = [...NAV];
  if (user?.is_staff) {
    nav.push({ href: '/admin', label: 'Admin', icon: ShieldCheckIcon });
  }

  return (
    <>
      <Head>
        <title>{title === 'GoldenShake' ? title : `${title} · GoldenShake`}</title>
        <meta name="description" content="GoldenShake — premium end-to-end encrypted messenger." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0D0D0D" />
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <div className="flex min-h-screen bg-black">
        {sidebar && (
          <>
            <aside
              className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-white/5 bg-graphite/80 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0 ${
                open ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex h-16 items-center justify-between px-5">
                <Logo />
                <button
                  type="button"
                  aria-label="Close navigation"
                  className="text-neutral-400 lg:hidden"
                  onClick={() => setOpen(false)}
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="divider" />

              <nav className="flex-1 space-y-1 overflow-y-auto p-3 scrollbar-gold">
                {nav.map(({ href, label, icon: Icon }) => {
                  const active = router.pathname === href || router.pathname.startsWith(`${href}/`);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${
                        active
                          ? 'bg-gold/10 text-gold shadow-[inset_2px_0_0_0_#C9A84C]'
                          : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </Link>
                  );
                })}
              </nav>

              <div className="divider" />

              <div className="p-3">
                {user ? (
                  <div className="rounded-xl bg-black/40 p-3">
                    <Link
                      href={`/profile/${user.username}`}
                      className="flex items-center gap-3"
                      onClick={() => setOpen(false)}
                    >
                      {user.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar}
                          alt={user.username}
                          className="h-10 w-10 rounded-full object-cover ring-2 ring-gold/40"
                        />
                      ) : (
                        <UserCircleIcon className="h-10 w-10 text-neutral-600" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 truncate text-sm font-semibold text-white">
                          <Username user={user} />
                        </div>
                        <HandshakeBadge level={user.level || 'green'} size="sm" />
                      </div>
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 py-2 text-xs font-medium text-neutral-400 transition hover:border-red-500/40 hover:text-red-400"
                    >
                      <ArrowLeftOnRectangleIcon className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link href="/auth/login" className="btn-primary w-full">
                    Sign in
                  </Link>
                )}
              </div>
            </aside>

            {open && (
              <div
                className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
                onClick={() => setOpen(false)}
                aria-hidden="true"
              />
            )}
          </>
        )}

        <div className={`flex min-h-screen w-full flex-col ${sidebar ? 'lg:pl-64' : ''}`}>
          {sidebar && (
            <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/5 bg-black/70 px-4 backdrop-blur-xl lg:hidden">
              <button
                type="button"
                aria-label="Open navigation"
                onClick={() => setOpen(true)}
                className="text-neutral-300"
              >
                <Bars3Icon className="h-6 w-6" />
              </button>
              <Logo compact />
              <span className="font-display text-base font-semibold">{title}</span>
            </header>
          )}

          <main className={fullBleed ? 'flex-1' : 'mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6'}>
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
