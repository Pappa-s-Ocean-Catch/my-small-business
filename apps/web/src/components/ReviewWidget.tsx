import React, { useState, useEffect } from 'react';
import { FaStar } from 'react-icons/fa';
import { useInView } from '@/hooks/useInView';

interface ReviewWidgetProps {
    productId: string;
    className?: string;
    alwaysVisible?: boolean;
    debug?: boolean;
}

export const ReviewWidget: React.FC<ReviewWidgetProps> = ({ productId, className, alwaysVisible, debug }) => {
    const [open, setOpen] = useState(false);
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [initialFetchDone, setInitialFetchDone] = useState(false);
    const PAGE_SIZE = 10;
    const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0 });

    const fetchReviews = async (pageNum = 1) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/social-activity/getItemReviews?itemId=${productId}&limit=${PAGE_SIZE}&page=${pageNum}`);
            const data = await res.json();
            if (res.ok) {
                if (pageNum === 1) {
                    setReviews(data.reviews || []);
                } else {
                    setReviews(prev => [...prev, ...(data.reviews || [])]);
                }
                setAvg(data.avg || 0);
                setCount(data.count || 0);
                setHasMore((data.reviews?.length || 0) === PAGE_SIZE);
            }
        } finally {
            setLoading(false);
            setInitialFetchDone(true);
        }
    };

    useEffect(() => {
        const shouldFetch = alwaysVisible || inView;
        if (debug) {
            console.log('ReviewWidget shouldFetch:', shouldFetch, 'inView:', inView, 'for', productId);
        }
        if (!shouldFetch) return;
        fetchReviews(1);
        // eslint-disable-next-line
    }, [productId, inView, alwaysVisible, debug]);

    const handleLoadMore = () => {
        fetchReviews(page + 1);
        setPage(p => p + 1);
    };

    // Only show widget after first fetch, and only if loading or there are reviews
    const shouldShowWidget = initialFetchDone && (loading || count > 0);

    return (
        <>
            <div
                ref={ref}
                className={`flex items-center gap-1 bg-white/80 dark:bg-black/60 rounded-full px-2 py-1 shadow-sm text-xs cursor-pointer ${className || ''}`}
                style={{
                    position: 'absolute',
                    right: 8,
                    bottom: 8,
                    zIndex: 10,
                    opacity: shouldShowWidget ? 1 : 0,
                    pointerEvents: shouldShowWidget ? 'auto' : 'none',
                    transition: 'opacity 0.2s',
                }}
                onClick={(e) => {
                    e.stopPropagation();
                    setOpen(true);
                }}
                title="View all reviews"
            >
                <FaStar className="text-yellow-400" />
                <span className="font-semibold">{avg.toFixed(1)}</span>
                <span className="text-gray-500">/5</span>
                <span className="ml-1">({count})</span>
            </div>
            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6 relative">
                        <button
                            className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 dark:hover:text-white"
                            onClick={() => {
                                // Set a global flag to prevent navigation after closing
                                window.__justClosedReviewPopup = true;
                                setTimeout(() => {
                                    window.__justClosedReviewPopup = false;
                                }, 100);
                                setOpen(false);
                            }}
                        >
                            &times;
                        </button>
                        <h2 className="text-lg font-bold mb-2 flex items-center gap-2"><FaStar className="text-yellow-400" /> {avg.toFixed(1)} / 5 <span className="text-gray-500">({count} reviews)</span></h2>
                        {loading && <div className="text-center py-4">Loading...</div>}
                        {!loading && reviews.length === 0 && <div className="text-center py-4 text-gray-500">No reviews yet.</div>}
                        <ul className="divide-y divide-gray-200 dark:divide-neutral-800">
                            {reviews.map((r, idx) => (
                                <li key={r.id || idx} className="py-3">
                                    <div className="flex items-center gap-2 mb-1">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <FaStar key={star} className={`w-4 h-4 ${r.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`} />
                                        ))}
                                        <span className="text-xs text-gray-500 ml-2">{new Date(r.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="text-sm text-gray-800 dark:text-gray-200">{r.comment}</div>
                                </li>
                            ))}
                        </ul>
                        {hasMore && (
                            <div className="flex justify-center mt-4">
                                <button className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={handleLoadMore} disabled={loading}>
                                    {loading ? 'Loading...' : 'Load More'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
};
