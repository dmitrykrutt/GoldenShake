import '../styles/globals.css';
import { useRouter } from 'next/router';
import { AnimatePresence, motion } from 'framer-motion';
import { AuthProvider } from '../lib/auth';
import { I18nProvider } from '../lib/i18n';

export default function GoldenShakeApp({ Component, pageProps }) {
  const router = useRouter();
  return (
    <I18nProvider>
      <AuthProvider>
        <AnimatePresence mode="wait">
          <motion.div
            key={router.pathname}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <Component {...pageProps} />
          </motion.div>
        </AnimatePresence>
      </AuthProvider>
    </I18nProvider>
  );
}
