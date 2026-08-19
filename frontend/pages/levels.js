import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeftIcon, CheckCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Layout from '../components/Layout';
import HandshakeIcon from '../components/HandshakeIcon';
import api from '../lib/api';
import { useAuth } from '../lib/auth';
import { LEVEL_THRESHOLDS, LEVEL_ORDER, RARITY_META } from '../lib/constants';

const LEVEL_DESCRIPTIONS = {
  green: 'Начальный ранг, присваивается каждому участнику платформы при регистрации.',
  green_plus: 'Ранг активного участника. Выдается при получении 100 уникальных зеленых рукопожатий.',
  blue: 'Ранг проверенного партнера. Выдается при наличии 1 синего рукопожатия.',
  blue_plus: 'Продвинутый ранг доверия. Требует 25 уникальных синих рукопожатий.',
  purple: 'Ранг признанного лидера. Выдается при наличии 1 фиолетового рукопожатия.',
  purple_plus: 'Элитный партнерский статус. Требует 25 уникальных фиолетовых рукопожатий.',
  red: 'Мастер сообщества. Выдается за обладание 1 красным рукопожатием.',
  red_plus: 'Верховный гарант доверия. Требует 25 уникальных красных рукопожатий.',
  gold: 'Легендарный статус GoldenShake. Выдается за 1 золотое рукопожатие.',
  gold_plus: 'Абсолютный ранг престижа. Выдается обладателям 10 уникальных золотых рукопожатий.',
};

export default function LevelsPage() {
  const { user } = useAuth();
  const [currentLevel, setCurrentLevel] = useState('green');

  useEffect(() => {
    if (user) {
      api.get('/coins/balance/').then(({ data }) => {
        if (data?.level) setCurrentLevel(data.level);
      }).catch(() => {});
    }
  }, [user]);

  // Выводим от начального уровня к максимальному
  const displayLevels = [...LEVEL_ORDER].reverse();

  return (
    <Layout title="Уровни рукопожатий">
      <div className="mx-auto max-w-4xl pb-12">
        {/* Кнопка назад */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/balance"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-graphite/60 px-3.5 py-2 text-xs font-semibold text-neutral-300 backdrop-blur-xl hover:border-gold/40 hover:text-gold transition"
          >
            <ArrowLeftIcon className="h-4 w-4" /> Назад к балансу
          </Link>
          <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-bold text-gold">
            <SparklesIcon className="h-4 w-4" /> Репутация и ранги
          </span>
        </div>

        {/* Заголовок */}
        <div className="mb-8 text-center sm:text-left">
          <h1 className="text-3xl font-display font-bold text-white sm:text-4xl">
            Лестница уровней доверия
          </h1>
          <p className="mt-2 text-sm text-neutral-400 max-w-2xl leading-relaxed">
            Каждое рукопожатие в GoldenShake — это уникальный цифровой токен. Ваш ранг строится на количестве уникальных рукопожатий, которые вы когда-либо держали на балансе.
          </p>
        </div>

        {/* Список карточек уровней */}
        <div className="space-y-3.5">
          {displayLevels.map((lvlKey) => {
            const rule = LEVEL_THRESHOLDS[lvlKey];
            const meta = RARITY_META[rule.rarity] || RARITY_META.green;
            const isPlus = lvlKey.includes('plus');
            const isCurrent = lvlKey === currentLevel;
            const levelIndex = displayLevels.indexOf(lvlKey);
            const userIndex = displayLevels.indexOf(currentLevel);
            const isUnlocked = userIndex >= levelIndex;

            return (
              <div
                key={lvlKey}
                className={`relative overflow-hidden rounded-2xl border p-5 transition-all backdrop-blur-xl ${
                  isCurrent
                    ? 'border-gold bg-gold/[0.08] shadow-gold-lg ring-1 ring-gold'
                    : isUnlocked
                      ? 'border-white/10 bg-graphite/60'
                      : 'border-white/5 bg-black/40 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Левая часть: Иконка и название */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border shadow-inner"
                      style={{
                        borderColor: `${meta.color}55`,
                        backgroundColor: `${meta.color}18`,
                      }}
                    >
                      <HandshakeIcon className="text-2xl" color={meta.color} />
                      {isPlus && (
                        <span
                          className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black border text-[11px] font-black"
                          style={{ borderColor: meta.color, color: meta.color }}
                        >
                          +
                        </span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-display text-lg font-bold text-white">
                          {meta.label} {isPlus ? '+' : ''}
                        </h3>
                        {isCurrent && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-black text-black uppercase tracking-wider">
                            <CheckCircleIcon className="h-3.5 w-3.5" /> Ваш уровень
                          </span>
                        )}
                        {isUnlocked && !isCurrent && (
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-neutral-300">
                            Пройден
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-neutral-400 leading-relaxed max-w-xl">
                        {LEVEL_DESCRIPTIONS[lvlKey] || 'Ранг доверия в экосистеме.'}
                      </p>
                    </div>
                  </div>

                  {/* Правая часть: Требование */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-0 border-white/5 gap-1">
                    <span className="text-[11px] uppercase tracking-wider text-neutral-500 font-semibold">
                      Требование
                    </span>
                    <div className="text-sm font-bold" style={{ color: meta.color }}>
                      {rule.min === 0 ? 'Без условий' : `${rule.min} ${meta.label}`}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Информационный блок внизу */}
        <div className="mt-8 rounded-2xl border border-white/10 bg-graphite/40 p-5 text-xs text-neutral-400 leading-relaxed">
          <h4 className="font-display font-semibold text-white text-sm mb-1.5 flex items-center gap-2">
            🤝 Как повышать уровень?
          </h4>
          <p>
            Приглашайте новых пользователей по реферальным ссылкам, успешно завершайте сделки в качестве продавца или покупателя через гарант-сервис, получайте донаты рукопожатиями в чатах и сжигайте монеты низкого ранга через <strong>Ковку</strong> для получения редких рукопожатий.
          </p>
        </div>
      </div>
    </Layout>
  );
}
