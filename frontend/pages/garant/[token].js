import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import GarantDeal from '../../components/GarantDeal';
import api, { apiError } from '../../lib/api';
import { useRequireAuth } from '../../lib/auth';

export default function GarantDealPage() {
  const router = useRouter();
  const { token } = router.query;
  const { user } = useRequireAuth();

  const [deal, setDeal] = useState(null);
  const [payment, setPayment] = useState(null);
  const [disputeText, setDisputeText] = useState('');
  const [showDispute, setShowDispute] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const { data } = await api.get(`/garant/deals/by-token/${token}/`);
      setDeal(data);
    } catch (err) {
      setError(apiError(err, 'Deal not found.'));
    }
  }, [token]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const run = async (fn, successMessage) => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      await fn();
      if (successMessage) setNotice(successMessage);
      await load();
    } catch (err) {
      setError(apiError(err, 'Action failed.'));
    } finally {
      setBusy(false);
    }
  };

  const agree = () =>
    run(
      () => api.post(`/garant/deals/by-token/${token}/agree/`),
      'You joined the deal. A guarantee chat has been opened.'
    );

  const pay = () =>
    run(async () => {
      const { data } = await api.post(`/garant/deals/${deal.id}/pay/`);
      setPayment(data);
      if (data.pay_url) window.open(data.pay_url, '_blank', 'noopener,noreferrer');
    }, 'Invoice created — complete the payment in CryptoPay.');

  const complete = () =>
    run(
      () => api.post(`/garant/deals/${deal.id}/complete/`),
      'Marked as delivered. Waiting for the buyer to confirm.'
    );

  const confirm = () =>
    run(
      () => api.post(`/garant/deals/${deal.id}/confirm/`),
      'Confirmed. Funds are being released to the seller.'
    );

  const refund = () =>
    run(
      () => api.post(`/garant/deals/${deal.id}/refund/`),
      'Refund requested. Funds returned to your fiat balance.'
    );

  const cancel = () => run(() => api.post(`/garant/deals/${deal.id}/cancel/`), 'Deal cancelled.');

  const openDispute = (event) => {
    event.preventDefault();
    return run(async () => {
      await api.post(`/garant/deals/${deal.id}/dispute/`, { description: disputeText });
      setShowDispute(false);
      setDisputeText('');
    }, 'Dispute opened. Our staff will review it shortly.');
  };

  if (!deal) {
    return (
      <Layout title="Garant deal">
        {error ? <p className="text-sm text-red-400">{error}</p> : <div className="skeleton h-56 w-full" />}
      </Layout>
    );
  }

  const isSeller = deal.creator?.id === user?.id;
  const isBuyer = deal.buyer?.id === user?.id;
  const canAgree = !deal.buyer && !isSeller && ['draft', 'awaiting_buyer'].includes(deal.status);

  return (
    <Layout title={deal.title || 'Garant deal'}>
      {notice && <p className="mb-4 text-xs text-green-400">{notice}</p>}
      {error && <p className="mb-4 text-xs text-red-400">{error}</p>}

      <GarantDeal
        deal={deal}
        currentUser={user}
        actions={
          <>
            {canAgree && (
              <button type="button" onClick={agree} disabled={busy} className="btn-primary">
                Agree to terms
              </button>
            )}
            {isBuyer && deal.status === 'awaiting_payment' && (
              <button type="button" onClick={pay} disabled={busy} className="btn-primary">
                Pay {deal.price_crypto} {deal.crypto_currency}
              </button>
            )}
            {isSeller && deal.status === 'paid' && (
              <button type="button" onClick={complete} disabled={busy} className="btn-primary">
                Я выполнил заказ
              </button>
            )}
            {isBuyer && deal.status === 'completed_by_seller' && (
              <button
                type="button"
                onClick={() => setShowConfirmDialog(true)}
                disabled={busy}
                className="btn-primary"
              >
                Подтвердить получение
              </button>
            )}
            {isBuyer && ['paid', 'awaiting_payment'].includes(deal.status) && (
              <button type="button" onClick={refund} disabled={busy} className="btn-dark">
                Вернуть деньги
              </button>
            )}
            {['paid', 'completed_by_seller'].includes(deal.status) && (isBuyer || isSeller) && (
              <button
                type="button"
                onClick={() => setShowDispute(true)}
                disabled={busy}
                className="btn-dark"
              >
                Open dispute
              </button>
            )}
            {isSeller && ['draft', 'awaiting_buyer', 'awaiting_payment'].includes(deal.status) && !deal.buyer && (
              <button type="button" onClick={cancel} disabled={busy} className="btn-dark">
                Cancel deal
              </button>
            )}
          </>
        }
      />

      {payment?.pay_url && (
        <div className="card mt-6">
          <h2 className="text-lg">Payment invoice</h2>
          <p className="mt-2 text-sm text-neutral-400">
            Invoice {payment.cryptopay_invoice_id} for {payment.amount} {payment.currency} ·{' '}
            {payment.status}
          </p>
          <a
            href={payment.pay_url}
            target="_blank"
            rel="noreferrer noopener"
            className="btn-primary mt-4"
          >
            Open CryptoPay
          </a>
        </div>
      )}

      {deal.disputes?.length > 0 && (
        <div className="card mt-6">
          <h2 className="text-lg text-red-400">Disputes</h2>
          <ul className="mt-3 space-y-3">
            {deal.disputes.map((dispute) => (
              <li key={dispute.id} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-xs text-neutral-500">
                  @{dispute.complainant?.username} · {dispute.status}
                </p>
                <p className="mt-1 text-sm text-neutral-300">{dispute.description}</p>
                {dispute.resolution_note && (
                  <p className="mt-2 text-xs text-gold">Staff: {dispute.resolution_note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <form onSubmit={openDispute} className="w-full max-w-md rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Open a dispute</h2>
            <p className="mt-1 text-xs text-neutral-400">
              Describe what went wrong. Staff will review the guarantee chat history.
            </p>
            <textarea
              required
              rows={5}
              className="input mt-4 resize-none"
              value={disputeText}
              onChange={(event) => setDisputeText(event.target.value)}
            />
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowDispute(false)}
                className="btn-dark flex-1"
              >
                Cancel
              </button>
              <button type="submit" disabled={busy} className="btn-primary flex-1">
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl glass-gold p-6">
            <h2 className="font-display text-xl">Подтвердить получение?</h2>
            <p className="mt-3 text-sm text-neutral-400">
              Вы уверены? После подтверждения деньги будут переведены продавцу.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirmDialog(false)}
                className="btn-dark flex-1"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setShowConfirmDialog(false);
                  confirm();
                }}
                className="btn-primary flex-1"
              >
                Подтвердить
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
