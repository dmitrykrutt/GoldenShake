import '../styles/globals.css';
import { AuthProvider } from '../lib/auth';

export default function GoldenShakeApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
    </AuthProvider>
  );
}
