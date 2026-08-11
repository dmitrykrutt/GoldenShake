import Link from 'next/link';
import Layout from '../components/Layout';

export default function NotFound() {
  return (
    <Layout title="Not found" sidebar={false}>
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
        <h1 className="font-display text-7xl gold-text">404</h1>
        <p className="text-neutral-400">This handshake leads nowhere.</p>
        <Link href="/" className="btn-primary">
          Back home
        </Link>
      </div>
    </Layout>
  );
}
