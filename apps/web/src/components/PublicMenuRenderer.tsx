'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { FaPlus, FaThumbsUp, FaThumbsDown, FaStar } from 'react-icons/fa';
import { Icon } from '@/components/Icon';
import Modal from '@/components/Modal';
import { ImageUpload } from '@/components/ImageUpload';
import { addItemReview, getItemReviews } from '@/app/actions/social-activity';
import dynamic from 'next/dynamic';

const LikeDislikeWidget = dynamic(() => import('@/components/LikeDislikeWidget').then(m => m.LikeDislikeWidget), { ssr: false });
const ReviewWidget = dynamic(() => import('@/components/ReviewWidget').then(m => m.ReviewWidget), { ssr: false });

export type PublicMenuScreenModel = {
  id: string;
  name: string;
  subtitle?: string | null;
  show_images: boolean;
  num_columns: number;
};

export type PublicSaleCategory = {
  id: string;
  name: string;
  parent_category_id?: string | null;
};

export type PublicSaleProduct = {
  id: string;
  name: string;
  description?: string | null;
  sale_price: number;
  image_url?: string | null;
  sale_category_id?: string | null;
  sub_category_id?: string | null;
};

export function PublicMenuRenderer({
  screen,
  categories,
  products,
  selectedCategoryIds,
  categoryColumnMap,
  onAddToCartClick
}: {
  screen: PublicMenuScreenModel;
  categories: PublicSaleCategory[];
  products: PublicSaleProduct[];
  selectedCategoryIds: string[];
  categoryColumnMap: Record<string, { columnIndex: number; sortOrder: number }>;
  onAddToCartClick?: (product: PublicSaleProduct) => void;
}) {
  const categoryChildrenMap = useMemo(() => {
    const children: Record<string, string[]> = {};
    for (const c of categories) {
      if (c.parent_category_id) {
        const parentId = c.parent_category_id;
        if (!children[parentId]) children[parentId] = [];
        children[parentId].push(c.id);
      }
    }
    return children;
  }, [categories]);

  // State for review modal
  const [reviewModalItem, setReviewModalItem] = useState<null | PublicSaleProduct>(null);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewPhoto, setReviewPhoto] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  // TODO: Fetch likes/reviews from backend for each item
  const [itemReviews, setItemReviews] = useState<Record<string, any[]>>({});
  const [reviewSummaries, setReviewSummaries] = useState<Record<string, { avg: number, count: number }>>({});

  useEffect(() => {
    async function fetchReviews() {
      const summaries: Record<string, { avg: number, count: number }> = {};
      const reviews: Record<string, any[]> = {};
      for (const item of products) {
        const res = await getItemReviews(item.id);
        if (res.reviews) {
          reviews[item.id] = res.reviews;
          const avg = res.reviews.length > 0 ? res.reviews.reduce((sum: number, r: any) => sum + (r.rating || 0), 0) / res.reviews.length : 0;
          summaries[item.id] = { avg, count: res.reviews.length };
        } else {
          reviews[item.id] = [];
          summaries[item.id] = { avg: 0, count: 0 };
        }
      }
      setItemReviews(reviews);
      setReviewSummaries(summaries);
    }
    fetchReviews();
  }, [products]);

  const getLikes = (itemId: string) => ({ likes: 12, dislikes: 2 }); // TODO: Replace with backend
  const getReviewSummary = (itemId: string) => reviewSummaries[itemId] || { avg: 0, count: 0 };

  const handleSubmitReview = async () => {
    if (!reviewModalItem || !reviewRating) return;
    setSubmittingReview(true);
    // TODO: Get userId from auth context
    const userId = 'mock-user-id';
    await addItemReview({ userId, itemId: reviewModalItem.id, rating: reviewRating, comment: reviewComment });
    // TODO: Save photo if uploaded
    setSubmittingReview(false);
    setReviewModalItem(null);
    setReviewRating(0);
    setReviewComment('');
    setReviewPhoto(null);
    // Optionally: show toast, refresh reviews
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: '#ff6363' }}>{screen.name}</h1>
        {screen.subtitle && <p className="text-sm text-neutral-600">{screen.subtitle}</p>}
      </div>
      {/* Mobile: single column, full width, preserving column + sort order */}
      <div className="md:hidden space-y-6">
        {selectedCategoryIds
          .map(id => categories.find(c => c.id === id))
          .filter((c): c is PublicSaleCategory => Boolean(c))
          .sort((a, b) => {
            const ca = categoryColumnMap[a.id]?.columnIndex ?? 0;
            const cb = categoryColumnMap[b.id]?.columnIndex ?? 0;
            if (ca !== cb) return ca - cb;
            const sa = categoryColumnMap[a.id]?.sortOrder ?? 0;
            const sb = categoryColumnMap[b.id]?.sortOrder ?? 0;
            return sa - sb;
          })
          .map(cat => {
            const includeIds = new Set<string>([cat.id, ...(categoryChildrenMap[cat.id] ?? [])]);
            const items = products
              .filter(p => {
                const saleCatOk = p.sale_category_id ? includeIds.has(p.sale_category_id) : false;
                const subCatOk = p.sub_category_id ? includeIds.has(p.sub_category_id) : false;
                return saleCatOk || subCatOk;
              })
              .slice() // copy before sort
              .sort((a, b) => {
                const sa = (a as any).sort_order ?? 0;
                const sb = (b as any).sort_order ?? 0;
                if (sa !== sb) return sa - sb;
                return (a.name ?? '').localeCompare(b.name ?? '');
              });
            if (items.length === 0) return null;
            return (
              <div key={cat.id} className="rounded-xl shadow-sm border bg-white overflow-hidden">
                <div className="px-4 py-3 font-bold text-lg" style={{ background: '#fff0e6', color: '#ff6363' }}>{cat.name}</div>
                <ul className="divide-y">
                  {items.map(item => {
                    const likes = getLikes(item.id);
                    const review = getReviewSummary(item.id);
                    return (
                      <li key={item.id}>
                        <div className="p-4 flex items-start justify-between gap-4 hover:bg-rose-50/50 transition-colors">
                          <Link
                            href={`/order/product/${item.id}`}
                            className="flex-1 min-w-0"
                            aria-label={`View details for ${item.name}`}
                          >
                            <div className="font-semibold text-neutral-900">{item.name}</div>
                            {item.description && <div className="text-sm text-neutral-600">{item.description}</div>}
                            <div className="flex items-center gap-3 mt-2">
                              {/* Like/Dislike */}
                              <span className="flex items-center gap-1 text-green-600"><Icon icon={FaThumbsUp} className="w-4 h-4" />{likes.likes}</span>
                              <span className="flex items-center gap-1 text-red-500"><Icon icon={FaThumbsDown} className="w-4 h-4" />{likes.dislikes}</span>
                              {/* Review summary */}
                              <span className="flex items-center gap-1 text-yellow-500">
                                <Icon icon={FaStar} className="w-4 h-4" />
                                {review.avg.toFixed(1)} ({review.count})
                              </span>
                              {/* Public reviews display */}
                              {itemReviews[item.id] && itemReviews[item.id].length > 0 && (
                                <div className="mt-2 space-y-2">
                                  {itemReviews[item.id].slice(0, 2).map((r, idx) => (
                                    <div key={r.id || idx} className="bg-gray-50 dark:bg-neutral-900 rounded p-2 border border-gray-200 dark:border-neutral-800">
                                      <div className="flex items-center gap-2 mb-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                          <Icon key={star} icon={FaStar} className={`w-4 h-4 ${r.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`} />
                                        ))}
                                        <span className="text-xs text-gray-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                                      </div>
                                      <div className="text-sm text-gray-800 dark:text-gray-200">{r.comment}</div>
                                      {/* TODO: Show review photo if available */}
                                    </div>
                                  ))}
                                  {itemReviews[item.id].length > 2 && (
                                    <div className="text-xs text-blue-600 mt-1">...and {itemReviews[item.id].length - 2} more reviews</div>
                                  )}
                                </div>
                              )}
                              <button
                                className="ml-2 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold hover:bg-blue-200"
                                onClick={e => { e.preventDefault(); e.stopPropagation(); setReviewModalItem(item); }}
                              >Review</button>
                            </div>
                          </Link>
                          {screen?.show_images && item.image_url && (
                            <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-md shrink-0" />
                          )}
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="font-bold text-neutral-900 whitespace-nowrap">${Number(item.sale_price).toFixed(2)}</span>
                            {onAddToCartClick && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onAddToCartClick(item);
                                }}
                                className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                aria-label={`Add ${item.name} to cart`}
                              >
                                <FaPlus className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                  {/* Review Modal (UI only, logic to be implemented) */}
                  <Modal
                    isOpen={!!reviewModalItem}
                    onClose={() => setReviewModalItem(null)}
                    title={reviewModalItem ? `Review ${reviewModalItem.name}` : ''}
                    size="md"
                  >
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Your Rating:</span>
                        {[1, 2, 3, 4, 5].map(star => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewRating(star)}
                            className="focus:outline-none"
                            aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                          >
                            <Icon icon={FaStar} className={`w-6 h-6 ${reviewRating >= star ? 'text-yellow-400' : 'text-gray-300'} cursor-pointer`} />
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="w-full border rounded p-2"
                        rows={3}
                        placeholder="Write your review..."
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                      />
                      <div>
                        <span className="font-semibold">Photo (optional):</span>
                        <ImageUpload
                          type="product"
                          currentImageUrl={reviewPhoto ?? undefined}
                          onImageChange={setReviewPhoto}
                          className="mt-2"
                        />
                      </div>
                      <div className="flex justify-end gap-2">
                        <button className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={() => setReviewModalItem(null)} disabled={submittingReview}>Cancel</button>
                        <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={handleSubmitReview} disabled={submittingReview || !reviewRating}>
                          {submittingReview ? 'Submitting...' : 'Submit Review'}
                        </button>
                      </div>
                    </div>
                  </Modal>
                </ul>
              </div>
            );
          })}
      </div>

      {/* Desktop: multi-column grid */}
      <div className={`hidden md:grid gap-6`} style={{ gridTemplateColumns: `repeat(${screen.num_columns || 3}, minmax(0, 1fr))` }}>
        {Array.from({ length: screen.num_columns || 3 }, (_, colIdx) => (
          <div key={colIdx} className="space-y-6">
            {selectedCategoryIds
              .map(id => categories.find(c => c.id === id))
              .filter((c): c is PublicSaleCategory => Boolean(c))
              .filter(cat => (categoryColumnMap[cat.id]?.columnIndex ?? 0) === colIdx)
              .sort((a, b) => {
                const sa = categoryColumnMap[a.id]?.sortOrder ?? 0;
                const sb = categoryColumnMap[b.id]?.sortOrder ?? 0;
                return sa - sb;
              })
              .map(cat => {
                const includeIds = new Set<string>([cat.id, ...(categoryChildrenMap[cat.id] ?? [])]);
                const items = products
                  .filter(p => {
                    const saleCatOk = p.sale_category_id ? includeIds.has(p.sale_category_id) : false;
                    const subCatOk = p.sub_category_id ? includeIds.has(p.sub_category_id) : false;
                    return saleCatOk || subCatOk;
                  })
                  .slice() // copy before sort
                  .sort((a, b) => {
                    const sa = (a as any).sort_order ?? 0;
                    const sb = (b as any).sort_order ?? 0;
                    if (sa !== sb) return sa - sb;
                    return (a.name ?? '').localeCompare(b.name ?? '');
                  });
                if (items.length === 0) return null;
                return (
                  <div key={cat.id} className="rounded-xl shadow-sm border bg-white overflow-hidden">
                    <div className="px-4 py-3 font-bold text-lg" style={{ background: '#fff0e6', color: '#ff6363' }}>{cat.name}</div>
                    <ul className="divide-y">
                      {items.map(item => (
                        <li key={item.id}>
                          <div className="p-4 flex items-start justify-between gap-4 hover:bg-rose-50/50 transition-colors">
                            <Link
                              href={`/order/product/${item.id}`}
                              className="flex-1 min-w-0"
                              aria-label={`View details for ${item.name}`}
                            >
                              <div className="font-semibold text-neutral-900">{item.name}</div>
                              {item.description && <div className="text-sm text-neutral-600">{item.description}</div>}
                            </Link>
                            {screen?.show_images && item.image_url && (
                              <img src={item.image_url} alt={item.name} className="w-16 h-16 object-cover rounded-md shrink-0" />
                            )}
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="font-bold text-neutral-900 whitespace-nowrap">${Number(item.sale_price).toFixed(2)}</span>
                              {onAddToCartClick && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onAddToCartClick(item);
                                  }}
                                  className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                                  aria-label={`Add ${item.name} to cart`}
                                >
                                  <FaPlus className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}


