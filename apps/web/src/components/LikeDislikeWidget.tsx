import React, { useEffect, useState } from 'react';
import { FaThumbsUp, FaThumbsDown } from 'react-icons/fa';
import { useInView } from '@/hooks/useInView';

interface LikeDislikeWidgetProps {
    productId: string;
    className?: string;
}

export const LikeDislikeWidget: React.FC<LikeDislikeWidgetProps> = ({ productId, className }) => {
    const [likes, setLikes] = useState(0);
    const [dislikes, setDislikes] = useState(0);
    const [loading, setLoading] = useState(true);
    const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0 });

    useEffect(() => {
        if (!inView) return;
        const fetchCounts = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/social-activity/getItemLikesCount?itemId=${productId}`);
                const data = await res.json();
                if (res.ok) {
                    setLikes(data.likes || 0);
                    setDislikes(data.dislikes || 0);
                } else {
                    setLikes(0);
                    setDislikes(0);
                }
            } catch {
                setLikes(0);
                setDislikes(0);
            } finally {
                setLoading(false);
            }
        };
        fetchCounts();
    }, [productId, inView]);

    if (!loading && likes === 0 && dislikes === 0) return null;

    return (
        <div
            ref={ref}
            className={`flex items-center gap-2 bg-white/80 dark:bg-black/60 rounded-full px-2 py-1 shadow-sm text-xs ${className || ''}`}
            style={{ position: 'absolute', left: 8, bottom: 8, zIndex: 10 }}
        >
            <span className="flex items-center gap-1 text-green-600"><FaThumbsUp /> {loading ? '-' : likes}</span>
            <span className="flex items-center gap-1 text-red-600"><FaThumbsDown /> {loading ? '-' : dislikes}</span>
        </div>
    );
};
