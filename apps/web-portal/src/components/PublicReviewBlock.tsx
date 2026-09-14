import React, { useEffect, useState, useRef } from 'react';
import { FaStar, FaUserCircle } from 'react-icons/fa';

interface Review {
    id: string;
    user_name: string;
    created_at: string;
    rating: number;
    comment: string;
    response?: string;
    replied_at?: string;
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
        <section className="max-w-6xl mx-auto my-16 p-0">
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-10 border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-10">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-4xl font-black text-gray-900">{avg.toFixed(1)}</span>
                                <div className="flex gap-0.5">
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <FaStar key={star} className={`w-5 h-5 ${avg >= star - 0.5 ? 'text-yellow-400' : 'text-gray-200'}`} />
                                    ))}
                                </div>
                            </div>
                            <div className="text-gray-500 font-medium text-sm uppercase tracking-wider mt-1">Average Rating</div>
                        </div>
                    </div>
                    <div className="bg-gray-50 px-6 py-3 rounded-xl border border-gray-100">
                        <div className="text-gray-900 font-bold text-xl">{count}</div>
                        <div className="text-gray-500 text-xs uppercase tracking-widest font-semibold">Verified Reviews</div>
                    </div>
                </div>

                <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                    {initialLoad && (
                        <div className="text-center py-12">
                            <div className="inline-block w-8 h-8 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
                            <div className="mt-4 text-gray-500 font-medium">Loading reviews...</div>
                        </div>
                    )}
                    {!initialLoad && reviews.length === 0 && (
                        <div className="text-center py-16">
                            <div className="text-5xl mb-4">✨</div>
                            <div className="text-gray-400 font-medium text-lg">Be the first to leave a review!</div>
                        </div>
                    )}
                    {reviews.map(r => (
                        <div key={r.id} className="py-8 first:pt-0">
                            <div className="flex gap-4 items-start relative">
                                <div className="flex-shrink-0 z-10">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 border border-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 shadow-sm">
                                        {r.user_name ? r.user_name[0].toUpperCase() : <FaUserCircle />}
                                    </div>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-base">{r.user_name}</h4>
                                            {r.created_at ? (
                                                <span className="text-[10px] uppercase font-bold tracking-widest text-gray-400">{new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                            ) : null}
                                        </div>
                                        <div className="flex gap-0.5 bg-yellow-50 px-2 py-1 rounded-lg border border-yellow-100">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <FaStar key={star} className={`w-3 h-3 ${r.rating >= star ? 'text-yellow-400' : 'text-gray-200'}`} />
                                            ))}
                                        </div>
                                    </div>
                                    {r.comment && (
                                        <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-line bg-gray-50/50 p-4 rounded-xl rounded-tl-none border border-gray-100/50 italic">
                                            "{r.comment}"
                                        </p>
                                    )}

                                    {/* Owner Response with Thread UI */}
                                    {r.response && (
                                        <div className="mt-4 flex gap-4 items-start group">
                                            {/* Thread Line - Adjusted to connect better whether or not there is a comment */}
                                            <div className="relative w-12 flex-shrink-0 flex justify-center">
                                                <div className={`absolute ${r.comment ? 'top-[-1rem]' : 'top-[-2.5rem]'} bottom-1/2 w-0.5 bg-gradient-to-b from-gray-200 to-rose-200 ml-0`}></div>
                                                <div className="absolute top-1/2 right-[0] w-6 h-0.5 bg-rose-200"></div>
                                            </div>

                                            <div className="flex-1">
                                                <div className="bg-rose-50/70 p-5 rounded-2xl border border-rose-100 relative overflow-hidden group-hover:bg-rose-50 transition-colors duration-300">
                                                    {/* Decorative subtle pattern or icon in background */}
                                                    <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none transform rotate-12">
                                                        <FaStar className="w-24 h-24 text-rose-500" />
                                                    </div>

                                                    <div className="flex items-center gap-2 mb-3">
                                                        <div className="w-7 h-7 rounded-full bg-rose-500 flex items-center justify-center text-white text-[10px] shadow-sm ring-4 ring-rose-50">
                                                            <FaStar className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div>
                                                            <div className="text-[11px] uppercase tracking-widest font-black text-rose-600 leading-none">Response from Owner</div>
                                                            {r.replied_at && (
                                                                <div className="text-[9px] text-rose-400 mt-0.5">{new Date(r.replied_at).toLocaleDateString()}</div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-sm text-gray-800 leading-relaxed relative z-10 whitespace-pre-line">
                                                        {r.response}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
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
