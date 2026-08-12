import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion } from 'framer-motion';
import {
  BoltIcon,
  ChatBubbleLeftRightIcon,
  LockClosedIcon,
  ShieldCheckIcon,
  SparklesIcon,
  UserGroupIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import Layout, { Logo } from '../components/Layout';
import { useAuth } from '../lib/auth';

const FEATURES = [
  {
    icon: LockClosedIcon,
    title: 'End-to-end encryption',
    body: 'Every message is sealed with XSalsa20-Poly1305 via libsodium before it ever touches our servers.',
  },
  {
    icon: UserGroupIcon,
    title: 'Invite-only network',
    body: 'Membership is earned. Each member holds five invitations — no invite, no entry.',
  },
  {
    icon: SparklesIcon,
    title: 'Handshake reputation',
    body: 'Earn green handshakes, forge them into blue, purple, red and gold. Your level is your reputation.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Crypto escrow (Garant)',
    body: 'Trade safely: funds are held by the platform until both sides confirm. 5% flat fee, disputes reviewed by staff.',
  },
  {
    icon: VideoCameraIcon,
    title: 'Encrypted calls',
    body: 'Peer-to-peer WebRTC audio and video with signalling over authenticated WebSockets.',
  },
  {
    icon: BoltIcon,
    title: 'Realtime everything',
    body: 'Typing indicators, read receipts, presence and push notifications delivered in milliseconds.',
  },
];

const LEVELS = [
  { name: 'Green', color: '#3FB950', note: 'Entry level' },
  { name: 'Blue', color: '#3B82F6', note: '50 green' },
  { name: 'Purple', color: '#A855F7', note: '10 blue' },
  { name: 'Red', color: '#EF4444', note: '10 purple' },
  { name: 'Gold', color: '#FFD700', note: '10 red' },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/chats');
    }
  }, [user, loading, router]);

  if (loading || user) return null;

  return (
    <Layout title="GoldenShake — premium secure messenger" sidebar={false} fullBleed>
      <div className="relative overflow-hidden">
        <header className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-5">
          <Logo />
          <nav className="flex items-center gap-3">
            <Link href="/auth/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/auth/register" className="btn-primary">
              Join with invite
            </Link>
          </nav>
        </header>

        <section className="relative mx-auto max-w-7xl px-5 pb-24 pt-16 text-center sm:pt-24">
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-gold/10 blur-[120px]" />

          <motion.span
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="badge border border-gold/30 bg-gold/10 px-4 py-1.5 text-gold"
          >
            <SparklesIcon className="h-3.5 w-3.5" /> Invite-only · End-to-end encrypted
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mx-auto mt-6 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl"
          >
            Conversations worth <span className="gold-text">protecting</span>.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="mx-auto mt-6 max-w-2xl text-base text-neutral-400 sm:text-lg"
          >
            GoldenShake is a private messenger for people who trade trust. Encrypted chats,
            crypto escrow, reputation handshakes and hardware-grade two-factor authentication —
            wrapped in black and gold.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-4"
          >
            <Link href="/auth/register" className="btn-primary px-7 py-3 text-base">
              Redeem your invite
            </Link>
            <Link href="/garant" className="btn-ghost px-7 py-3 text-base">
              Explore Garant escrow
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="mx-auto mt-16 max-w-3xl"
          >
            <div className="glass-gold animate-floaty rounded-3xl p-5 text-left">
              <div className="flex items-center gap-2 border-b border-white/5 pb-3">
                <span className="h-3 w-3 rounded-full bg-red-500/70" />
                <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <span className="h-3 w-3 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs text-neutral-500">
                  goldenshake · @nikolai · Gold Handshake
                </span>
              </div>
              <div className="space-y-3 pt-4 text-sm">
                <div className="flex justify-start">
                  <p className="max-w-[70%] rounded-2xl rounded-bl-md border border-white/5 bg-graphite px-4 py-2.5">
                    Escrow is funded. 1 200 USDT locked. 🔒
                  </p>
                </div>
                <div className="flex justify-end">
                  <p className="max-w-[70%] rounded-2xl rounded-br-md border border-gold/30 bg-gold/10 px-4 py-2.5">
                    Received. Shipping the keys now — check the locked file.
                  </p>
                </div>
                <div className="flex justify-start">
                  <p className="max-w-[70%] rounded-2xl rounded-bl-md border border-gold/25 bg-black/50 px-4 py-2.5 text-gold">
                    🤝 Sent you 10 Purple handshakes
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-5 py-20">
          <h2 className="text-center text-3xl sm:text-4xl">
            Built for <span className="gold-text">high-trust</span> communities
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-neutral-400">
            Every feature is designed around a single principle: your data belongs to you.
          </p>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }, index) => (
              <motion.article
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="card transition hover:border-gold/30 hover:shadow-gold"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gold/10 text-gold">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-4 text-lg">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{body}</p>
              </motion.article>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-16">
          <div className="card">
            <h2 className="text-center text-2xl">The handshake ladder</h2>
            <p className="mt-2 text-center text-sm text-neutral-400">
              Coins are earned by inviting members, closing garant deals and receiving donations.
            </p>
            <div className="mt-8 grid gap-4 sm:grid-cols-5">
              {LEVELS.map((level) => (
                <div
                  key={level.name}
                  className="rounded-2xl border p-5 text-center transition hover:-translate-y-1"
                  style={{ borderColor: `${level.color}44`, backgroundColor: `${level.color}0F` }}
                >
                  <span
                    className="mx-auto grid h-12 w-12 place-items-center rounded-full text-xl"
                    style={{ backgroundColor: `${level.color}22`, color: level.color }}
                  >
                    🤝
                  </span>
                  <p className="mt-3 font-semibold" style={{ color: level.color }}>
                    {level.name}
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">{level.note}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-5 py-20 text-center">
          <div className="glass-gold rounded-3xl p-10">
            <ChatBubbleLeftRightIcon className="mx-auto h-12 w-12 text-gold" />
            <h2 className="mt-5 text-3xl">Ready to shake on it?</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm text-neutral-400">
              GoldenShake is invite-only. Ask a member for a link, or request access from support.
            </p>
            <Link href="/auth/register" className="btn-primary mt-7 px-8 py-3 text-base">
              Create your account
            </Link>
          </div>
        </section>

        <footer className="border-t border-white/5 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-5 text-xs text-neutral-500 sm:flex-row sm:justify-between">
            <Logo />
            <p>© {new Date().getFullYear()} GoldenShake. All rights reserved.</p>
            <div className="flex gap-4">
              <Link href="/settings" className="hover:text-gold">
                Privacy
              </Link>
              <Link href="/settings" className="hover:text-gold">
                Terms
              </Link>
              <a href="/api/docs/" className="hover:text-gold">
                API
              </a>
            </div>
          </div>
        </footer>
      </div>
    </Layout>
  );
}
