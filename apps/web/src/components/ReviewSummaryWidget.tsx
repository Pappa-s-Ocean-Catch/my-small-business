import React, { useEffect, useState } from 'react';
import { FaStar } from 'react-icons/fa';

interface ReviewSummaryWidgetProps {
    scrollToId?: string;
}

export const ReviewSummaryWidget: React.FC<ReviewSummaryWidgetProps> = ({ scrollToId }) => {
    const [avg, setAvg] = useState(0);
    const [count, setCount] = useState(0);

    useEffect(() => {
        fetch('/api/public-reviews?page=1&limit=1')
            .then(res => res.json())
            .then(data => {
                setAvg(data.avg || 0);
                setCount(data.count || 0);
            });
    }, []);

    const handleClick = () => {
        if (scrollToId) {
            const el = document.getElementById(scrollToId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
            }
        }
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/90 shadow text-gray-900 font-semibold hover:bg-yellow-50 border border-yellow-200 transition-colors"
            aria-label="See customer reviews"
        >
            <span className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map(star => (
                    <FaStar key={star} className={`w-5 h-5 ${avg >= star - 0.5 ? 'text-yellow-400' : 'text-gray-200'}`} />
                ))}
            </span>
            <span className="text-lg font-bold">{avg.toFixed(1)}</span>
            <span className="text-gray-500 text-base">/5</span>
            <span className="text-gray-500 text-sm">({count} reviews)</span>
        </button>
    );
};
