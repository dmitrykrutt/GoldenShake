import Link from 'next/link';
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';
import { formatDateTime } from '../lib/constants';

export const DEAL_STATUS = {
  draft: { label: 'Draft', color: '#8A8A8E', icon: ClockIcon },
  awaiting_buyer: { label: 'Awaiting buyer', color: '#C9A84C', icon: ClockIcon },
  awaiting_payment: { label: 'Awaiting payment', color: '#C9A84C', icon: BanknotesIcon },
  paid: { label: 'Funds held in escrow', color: '#3B82F6', icon: ShieldCheckIcon },
  completed_by_seller: { label: 'Delivered — awaiting confirmation', color: '#A855F7', icon: ClockIcon },
  confirmed: { label: 'Confirmed by buyer', color: '#3FB950', icon: CheckCircleIcon },
  released: { label: 'Funds released', color: '#3FB950', icon: CheckCircleIcon },
  disputed: { label: 'Disputed', color: '#EF4444', icon: ExclamationTriangleIcon },
  refunded: { label: 'Refunded', color: '#EF4444', icon: BanknotesIcon },
  cancelled: { label: 'Cancelled', color: '#8A8A8E', icon: ExclamationTriangleIcon },
};

export function DealStatusBadge({ status }) {
  const meta = DEAL_STATUS[status] || DEAL_STATUS.draft;
  const Icon = meta.icon;
  return (
    <span
      className="badge border px-2.5 py-1"
      style={{
        color: meta.color,
        borderColor: `${meta.color}55`,
        backgroundColor: `${meta.color}1A`,
      }}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

const STEPS = [
  'awaiting_buyer',
  'awaiting_payment',
  'paid',
  'completed_by_seller',
  'confirmed',
  'released',
];

export function DealTimeline({ status }) {
  const currentIndex = STEPS.indexOf(status);
  return (
    <ol className="flex items-center gap-1">
      {STEPS.map((step, index) => {
        const done = currentIndex >= index && currentIndex !== -1;
        return (
          <li key={step} className="flex flex-1 items-center gap-1">
            <span
              title={DEAL_STATUS[step].label}
              className={`h-1.5 w-full rounded-full ${done ? 'bg-gold' : 'bg-graphite-lighter'}`}
            />
          </li>
        );
      })}
    </ol>
  );
}

export default function GarantDeal({ deal, currentUser, actions = null, compact = false }) {
  const isSeller = currentUser && deal.creator?.id === currentUser.id;
  const counterparty = isSeller ? deal.buyer : deal.creator;

  return (
    <div className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg">{deal.title || 'Guarantee deal'}</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            {isSeller ? 'You are the seller' : 'You are the buyer'}
            {counterparty ? ` · with @${counterparty.username}` : ' · buyer not joined yet'}
          </p>
        </div>
        <DealStatusBadge status={deal.status} />
      </div>

      {!compact && deal.description && (
        <p className="mt-4 whitespace-pre-wrap text-sm text-neutral-300">{deal.description}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <span className="label">Price</span>
          <p className="text-sm font-semibold text-white">
            {deal.price_crypto} {deal.crypto_currency}
          </p>
        </div>
        <div>
          <span className="label">Platform fee</span>
          <p className="text-sm font-semibold text-gold">
            {deal.platform_fee ?? '—'} ({deal.platform_fee_pct}%)
          </p>
        </div>
        <div>
          <span className="label">Seller receives</span>
          <p className="text-sm font-semibold text-white">{deal.seller_payout ?? '—'}</p>
        </div>
        <div>
          <span className="label">Created</span>
          <p className="text-sm text-neutral-400">{formatDateTime(deal.created_at)}</p>
        </div>
      </div>

      <div className="mt-5">
        <DealTimeline status={deal.status} />
      </div>

      {deal.room && (
        <Link
          href={`/chats/${deal.room}`}
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-gold hover:underline"
        >
          <ShieldCheckIcon className="h-4 w-4" />
          Open guarantee chat
        </Link>
      )}

      {actions && <div className="mt-5 flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}
