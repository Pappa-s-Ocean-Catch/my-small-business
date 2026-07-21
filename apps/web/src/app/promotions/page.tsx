import Link from 'next/link';
import { getActivePromotions } from '@/app/actions/promotions';
import { getPromotionDetailsCopy, getPromotionDisplayTitle, isFreeItemPromotion, promotionLabel } from '@/lib/promotions';
import { OrderHeader } from '@/components/OrderHeader';
import { createServiceRoleClient } from '@my-small-business/supabase/server';

export const metadata = {
  title: 'Pappas Offers | Pappa\'s Ocean Catch',
  description: 'See the latest pickup and delivery offers currently available at Pappa\'s Ocean Catch.',
};

function formatWindowLabel(start: string | null, end: string | null) {
  if (!start && !end) return 'Available now';
  const startLabel = start
    ? new Date(start).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : 'Now';
  const endLabel = end
    ? new Date(end).toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    : 'Until further notice';
  return `${startLabel} - ${endLabel}`;
}

export default async function PublicPromotionsPage() {
  const result = await getActivePromotions();
  const promotions = result.data || [];
  const eligibleProductIds = Array.from(
    new Set(
      promotions
        .filter((promotion) => isFreeItemPromotion(promotion))
        .flatMap((promotion) => promotion.product_ids || [])
    )
  );

  let productNameById = new Map<string, string>();
  if (eligibleProductIds.length > 0) {
    const supabase = await createServiceRoleClient();
    const { data: products } = await supabase
      .from('sale_products')
      .select('id, name')
      .in('id', eligibleProductIds)
      .eq('is_active', true);

    productNameById = new Map((products || []).map((product) => [String(product.id), String(product.name)]));
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#fff7ed_0%,#ffffff_40%,#f8fafc_100%)]">
      <OrderHeader />
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center rounded-full bg-emerald-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.35em] text-emerald-700">
            Pappas Offers
          </div>
          <h1 className="mt-6 text-4xl font-black tracking-tight text-slate-950 sm:text-6xl">
            Current offers worth ordering for
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Every active promotion in one place. Spend-threshold offers, free-item events, and limited-time deals are listed here with the simple rules customers need before checkout.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/order"
              className="inline-flex items-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Start pickup order
            </Link>
            <Link
              href="/order/delivery"
              className="inline-flex items-center rounded-full bg-amber-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              Start delivery order
            </Link>
          </div>
        </div>

        {promotions.length === 0 ? (
          <div className="mt-14 rounded-[2rem] bg-white/80 p-10 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-black/5 backdrop-blur">
            <div className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-400">No live campaigns</div>
            <h2 className="mt-3 text-2xl font-bold text-slate-950">No active promotions right now</h2>
            <p className="mt-3 max-w-xl text-slate-600">
              We update this page whenever a new promotion goes live. Check back soon or head to the menu to see today&apos;s fresh favourites.
            </p>
          </div>
        ) : (
          <div className="mt-14 grid gap-6 lg:grid-cols-2">
            {promotions.map((promotion, index) => {
              const promotionSummary = promotion.description?.trim() || getPromotionDetailsCopy(promotion);

              return (
                <article
                  key={promotion.id}
                  className={`group relative overflow-hidden rounded-[2rem] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] ring-1 ring-black/5 ${index % 2 === 0
                      ? 'bg-[linear-gradient(135deg,#052e16_0%,#065f46_35%,#10b981_100%)] text-white'
                      : 'bg-[linear-gradient(135deg,#111827_0%,#1f2937_45%,#f59e0b_130%)] text-white'
                    }`}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.2),transparent_35%)] opacity-80" />
                  <div className="relative">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.32em] text-white/65">
                          {isFreeItemPromotion(promotion) ? 'Free item event' : promotion.applies_to === 'cart' ? 'Cart promotion' : 'Product promotion'}
                        </div>
                        <h2 className="mt-3 text-3xl font-black leading-tight">
                          {getPromotionDisplayTitle(promotion)}
                        </h2>
                      </div>
                      <div className="rounded-full bg-white/12 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
                        {isFreeItemPromotion(promotion) ? 'Pick your free item' : promotionLabel(promotion)}
                      </div>
                    </div>

                    <div className="mt-8 grid gap-5 sm:grid-cols-[1.3fr_0.7fr]">
                      <div>
                        <p className="text-base leading-7 text-white/88">
                          {promotionSummary}
                        </p>
                        {isFreeItemPromotion(promotion) && (promotion.product_ids || []).length > 0 && (
                          <div className="mt-5">
                            <div className="text-xs font-bold uppercase tracking-[0.28em] text-white/60">Eligible items</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {(promotion.product_ids || []).map((productId) => (
                                <span
                                  key={productId}
                                  className="rounded-full bg-white/12 px-3 py-1.5 text-sm text-white/90 backdrop-blur"
                                >
                                  {productNameById.get(productId) || 'Selected menu item'}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="rounded-[1.5rem] bg-white/10 p-5 backdrop-blur">
                        <div className="text-xs font-bold uppercase tracking-[0.28em] text-white/60">When</div>
                        <div className="mt-2 text-lg font-semibold">{formatWindowLabel(promotion.starts_at, promotion.ends_at)}</div>

                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
