import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  ChatBubbleLeftRightIcon,
  CurrencyDollarIcon,
  ShieldCheckIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  UserIcon,
} from '@heroicons/react/24/outline';
import {
  HomeIcon as HomeIconSolid,
  ChatBubbleLeftRightIcon as ChatIconSolid,
  CurrencyDollarIcon as CurrencyIconSolid,
  ShieldCheckIcon as ShieldIconSolid,
} from '@heroicons/react/24/solid';
import { useAuth } from '../lib/auth';
import Username from './Username';
import LogoIcon from './LogoIcon';

export function Logo({ className = '', size = 'default' }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoIcon className={size === 'lg' ? 'h-11 w-11' : size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'} />
      <span className={`font-display font-bold tracking-tight text-white ${size === 'lg' ? 'text-2xl' : 'text-xl'}`}>
        GoldenShake
      </span>
    </Link>
  );
}

const DESKTOP_NAV = [
  { href: '/feed', label: 'Лента', icon: HomeIcon },
  { href: '/chats', label: 'Чаты', icon: ChatBubbleLeftRightIcon },
  { href: '/balance', label: 'Баланс', icon: CurrencyDollarIcon },
  { href: '/garant', label: 'Гарант', icon: ShieldCheckIcon },
  { href: '/settings', label: 'Настройки', icon: Cog6ToothIcon },
];

export default function Layout({ children, title, fullBleed = false, isChatRoom = false }) {
  const router = useRouter();
  const { user, logout } = useAuth();

  const isCurrent = (href) => {
    if (href === '/feed') return router.pathname === '/' || router.pathname === '/feed';
    if (href === '/chats') return router.pathname === '/chats' || router.pathname.startsWith('/chats/');
    return router.pathname.startsWith(href);
  };

  const isProfileActive = user && (router.asPath === `/profile/${user.username}` || router.pathname.startsWith('/profile'));

  return (
    <>
      <Head>
        <title>{title ? `${title} · GoldenShake` : 'GoldenShake'}</title>
      </Head>

      <div className="flex h-[100dvh] w-full overflow-hidden bg-black text-neutral-200">
        {/* Сайдбар для компьютеров */}
        <aside className="hidden md:flex w-64 flex-col justify-between border-r border-white/5 bg-graphite/40 p-4 backdrop-blur-2xl shrink-0">
          <div>
            <div className="px-2 py-3">
              <Logo />
            </div>

            <nav className="mt-6 space-y-1.5">
              {DESKTOP_NAV.map((item) => {
                const Icon = item.icon;
                const active = isCurrent(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                      active
                        ? 'bg-gold-gradient text-black font-bold shadow-gold'
                        : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {user ? (
            <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3">
              <Link href={`/profile/${user.username}`} className="flex items-center gap-3">
                {user.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar} alt={user.username} className="h-10 w-10 rounded-full object-cover ring-1 ring-gold/30" />
                ) : (
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-graphite font-display text-xs font-bold text-gold ring-1 ring-gold/30">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white">
                    <Username user={user} />
                  </p>
                  <p className="text-[10px] text-neutral-500">@{user.username}</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={logout}
                className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/5 py-1.5 text-xs text-neutral-400 hover:bg-white/5 hover:text-red-400"
              >
                <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" /> Выход
              </button>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              <Link
                href="/auth/login"
                className="btn-primary flex w-full items-center justify-center gap-2 py-2 text-xs font-bold"
              >
                <ArrowLeftOnRectangleIcon className="h-4 w-4" /> Вход
              </Link>
              <Link
                href="/auth/register"
                className="btn-dark flex w-full items-center justify-center py-2 text-xs"
              >
                Регистрация
              </Link>
            </div>
          )}
        </aside>

        <div className="flex flex-1 flex-col h-full overflow-hidden min-w-0 relative">
          {!isChatRoom && (
            <header className="flex md:hidden items-center justify-between border-b border-white/5 bg-black/80 px-4 py-2.5 backdrop-blur-xl shrink-0">
              <Logo size="sm" />
              {!user && (
                <Link href="/auth/login" className="btn-primary py-1 px-3 text-xs font-semibold">
                  Вход
                </Link>
              )}
            </header>
          )}

          <main className={`flex-1 min-w-0 h-full overflow-hidden ${fullBleed ? '' : 'overflow-y-auto p-4 pb-20 md:p-8 md:pb-8'}`}>
            {children}
          </main>

          {/* Нижний бар для мобильных: Лента -> Баланс -> Чаты -> Гарант -> Профиль */}
          {!isChatRoom && (
            <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-black/90 px-3 pt-1.5 pb-[max(6px,env(safe-area-inset-bottom))] backdrop-blur-2xl">
              <div className="flex items-center justify-around">
                {/* 1. Лента (Домой) */}
                <Link
                  href="/feed"
                  className={`flex flex-col items-center gap-0.5 py-1 px-2 transition ${
                    isCurrent('/feed') ? 'text-gold' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {isCurrent('/feed') ? (
                    <HomeIconSolid className="h-6 w-6" />
                  ) : (
                    <HomeIcon className="h-6 w-6" />
                  )}
                  <span className="text-[10px] font-medium">Лента</span>
                </Link>

                {/* 2. Баланс */}
                <Link
                  href="/balance"
                  className={`flex flex-col items-center gap-0.5 py-1 px-2 transition ${
                    isCurrent('/balance') ? 'text-gold' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {isCurrent('/balance') ? (
                    <CurrencyIconSolid className="h-6 w-6" />
                  ) : (
                    <CurrencyDollarIcon className="h-6 w-6" />
                  )}
                  <span className="text-[10px] font-medium">Баланс</span>
                </Link>

                {/* 3. Чаты (Крупная центральная кнопка) */}
                <Link
                  href="/chats"
                  className="flex flex-col items-center -mt-4 transition group"
                >
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
                      isCurrent('/chats')
                        ? 'bg-gold-gradient text-black shadow-gold'
                        : 'border border-gold/30 bg-graphite text-gold'
                    }`}
                  >
                    {isCurrent('/chats') ? (
                      <ChatIconSolid className="h-6 w-6" />
                    ) : (
                      <ChatBubbleLeftRightIcon className="h-6 w-6" />
                    )}
                  </div>
                  <span className={`text-[10px] font-semibold mt-0.5 ${isCurrent('/chats') ? 'text-gold' : 'text-neutral-400'}`}>
                    Чаты
                  </span>
                </Link>

                {/* 4. Гарант */}
                <Link
                  href="/garant"
                  className={`flex flex-col items-center gap-0.5 py-1 px-2 transition ${
                    isCurrent('/garant') ? 'text-gold' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {isCurrent('/garant') ? (
                    <ShieldIconSolid className="h-6 w-6" />
                  ) : (
                    <ShieldCheckIcon className="h-6 w-6" />
                  )}
                  <span className="text-[10px] font-medium">Гарант</span>
                </Link>

                {/* 5. Профиль */}
                <Link
                  href={user ? `/profile/${user.username}` : '/auth/login'}
                  className={`flex flex-col items-center gap-0.5 py-1 px-2 transition ${
                    isProfileActive ? 'text-gold' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {user?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatar}
                      alt=""
                      className={`h-6 w-6 rounded-full object-cover ring-1 transition ${
                        isProfileActive ? 'ring-gold ring-2' : 'ring-white/20'
                      }`}
                    />
                  ) : user ? (
                    <div
                      className={`grid h-6 w-6 place-items-center rounded-full bg-graphite text-[10px] font-bold text-gold ring-1 ${
                        isProfileActive ? 'ring-gold ring-2' : 'ring-white/20'
                      }`}
                    >
                      {user.username.slice(0, 2).toUpperCase()}
                    </div>
                  ) : (
                    <UserIcon className="h-6 w-6" />
                  )}
                  <span className="text-[10px] font-medium">Профиль</span>
                </Link>
              </div>
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
