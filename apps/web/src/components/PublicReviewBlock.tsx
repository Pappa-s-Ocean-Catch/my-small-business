import React, { useEffect, useState, useRef } from 'react';
import { FaStar, FaUserCircle } from 'react-icons/fa';

interface Review {
    id: string;
    user_name: string;
    created_at: string;
    rating: number;
    comment: string;
    response?: string;
}

const PAGE_SIZE = 10;

export const PublicReviewBlock: React.FC = () => {
    const [reviews, setReviews] = useState<Review[]>([]);
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [initialLoad, setInitialLoad] = useState(true);
    const loaderRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        setLoading(true);
        fetch(`/api/public-reviews?page=${page}&limit=${PAGE_SIZE}`)
            .then(res => res.json())
            .then(data => {
                if (page === 1) {
                    setReviews(data.reviews || []);
                } else {
                    setReviews(prev => [...prev, ...(data.reviews || [])]);
                }
                setAvg(data.avg || 0);
                setCount(data.count || 0);
                setHasMore((data.reviews?.length || 0) === PAGE_SIZE);
            })
            .finally(() => {
                setLoading(false);
                setInitialLoad(false);
            });
        // eslint-disable-next-line
    }, [page]);

    // Infinite scroll
    useEffect(() => {
        if (!hasMore || loading) return;
        const observer = new window.IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
                setPage(p => p + 1);
            }
        });
        if (loaderRef.current) {
            observer.observe(loaderRef.current);
        }
        return () => {
            if (loaderRef.current) observer.unobserve(loaderRef.current);
        };
    }, [hasMore, loading]);

    // Calculate active stars for overall rating
    const activeStars = Math.round(avg);

    return (
        <section className="max-w-4xl mx-auto my-16 p-0">
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <span className="flex gap-1">
                            {[1, 2, 3, 4, 5].map(star => (
                                <FaStar key={star} className={`w-8 h-8 ${avg >= star - 0.5 ? 'text-yellow-400' : 'text-gray-200'}`} />
                            ))}
                        </span>
                        <span className="text-2xl font-bold text-black ml-2">{avg.toFixed(1)}<span className="text-lg font-normal text-gray-500">/5</span></span>
                    </div>
                    <div className="text-gray-500 text-base md:text-right">Based on {count} review{count === 1 ? '' : 's'}</div>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-neutral-800 max-h-[400px] overflow-y-auto">
                    {initialLoad && (
                        <div className="text-center py-8 text-gray-400">Loading reviews…</div>
                    )}
                    {!initialLoad && reviews.length === 0 && (
                        <div className="text-center py-8 text-gray-400">No reviews yet.</div>
                    )}
                    {reviews.map(r => (
                        <div key={r.id} className="flex gap-4 py-6 items-start">
                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center text-2xl text-gray-400">
                                    {r.user_name ? r.user_name[0].toUpperCase() : <FaUserCircle />}
                                </div>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                    <div>
                                        <span className="font-semibold text-gray-900">{r.user_name}</span>
                                        {r.created_at ? (
                                            <div className="text-xs text-gray-500 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</div>
                                        ) : null}
                                    </div>
                                    <span className="flex gap-0.5 ml-2">
                                        {[1, 2, 3, 4, 5].map(star => (
                                            <FaStar key={star} className={`w-4 h-4 ${r.rating >= star ? 'text-yellow-400' : 'text-gray-300'}`} />
                                        ))}
                                    </span>
                                </div>
                                <div className="text-sm text-gray-800 whitespace-pre-line">{r.comment}</div>
                                {r.response && (
                                    <div className="mt-3 ml-6 pl-4 border-l-2 border-rose-200">
                                        <div className="text-xs text-rose-600 font-semibold mb-1">Shop Owner Reply</div>
                                        <div className="text-sm text-gray-700 whitespace-pre-line">{r.response}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {loading && !initialLoad && (
                        <div className="text-center py-4 text-gray-400">Loading more…</div>
                    )}
                    <div ref={loaderRef} />
                    {!hasMore && !loading && reviews.length > 0 && (
                        <div className="text-center text-gray-400 text-sm py-4">No more reviews.</div>
                    )}
                </div>
            </div>
        </section>
    );
};
