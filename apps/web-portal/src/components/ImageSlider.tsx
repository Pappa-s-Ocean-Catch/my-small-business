import React, { useEffect, useRef, useState } from "react";

interface ImageSliderProps {
    images: string[];
    alt?: string;
    interval?: number; // in ms, default 10000
    className?: string;
}

const ImageSlider: React.FC<ImageSliderProps> = ({ images, alt = "", interval = 10000, className = "" }) => {
    const [current, setCurrent] = useState(0);
    const [thumbScroll, setThumbScroll] = useState(0); // index of first visible thumbnail
    const timer = useRef<NodeJS.Timeout | null>(null);
    const thumbListRef = useRef<HTMLDivElement>(null);

    // How many thumbnails to show at once (responsive)
    const maxThumbs = 4;

    useEffect(() => {
        if (images.length <= 1) return;
        timer.current = setInterval(() => {
            setCurrent((prev) => (prev + 1) % images.length);
        }, interval);
        return () => {
            if (timer.current) clearInterval(timer.current);
        };
    }, [images, interval]);

    if (!images.length) return null;

    // Scroll thumbnail list if needed
    const canScrollUp = thumbScroll > 0;
    const canScrollDown = images.length - thumbScroll > maxThumbs;

    const handleThumbScroll = (dir: 'up' | 'down') => {
        setThumbScroll((prev) => {
            if (dir === 'up') return Math.max(0, prev - 1);
            if (dir === 'down') return Math.min(images.length - maxThumbs, prev + 1);
            return prev;
        });
    };

    // Keep current image in view
    useEffect(() => {
        if (current < thumbScroll) setThumbScroll(current);
        else if (current >= thumbScroll + maxThumbs) setThumbScroll(current - maxThumbs + 1);
    }, [current, thumbScroll]);

    return (
        <div
            className={`relative flex items-center justify-center ${className}`}
            style={{ minHeight: '16rem', maxHeight: '24rem', overflow: 'hidden', width: '100%' }}
        >
            {images.length > 1 && (
                <div
                    className="flex flex-col gap-1 absolute left-2 top-4 z-10 bg-white/70 rounded p-1 shadow"
                    style={{ maxHeight: 'calc(100% - 2rem)', height: 'min(16rem, 80vw)', minHeight: '6rem', overflow: 'hidden' }}
                >
                    {canScrollUp && (
                        <button
                            className="w-10 h-6 flex items-center justify-center text-gray-600 hover:text-blue-600"
                            onClick={() => handleThumbScroll('up')}
                            aria-label="Scroll thumbnails up"
                        >
                            ▲
                        </button>
                    )}
                    <div
                        ref={thumbListRef}
                        className="flex flex-col gap-1 overflow-hidden"
                        style={{ maxHeight: `calc(${maxThumbs} * 3.25rem)` }}
                    >
                        {images.slice(thumbScroll, thumbScroll + maxThumbs).map((img, idx) => {
                            const realIdx = thumbScroll + idx;
                            return (
                                <button
                                    key={img + realIdx}
                                    className={`w-12 h-12 border-2 ${realIdx === current ? "border-blue-500" : "border-gray-300"} rounded overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-400`}
                                    onClick={() => setCurrent(realIdx)}
                                    aria-label={`Show image ${realIdx + 1}`}
                                    tabIndex={0}
                                    style={{
                                        backgroundImage: `url('${img}')`,
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        backgroundRepeat: 'no-repeat',
                                        width: '3rem',
                                        height: '3rem',
                                        display: 'block',
                                        borderRadius: '0.5rem',
                                        border: realIdx === current ? '2px solid #3b82f6' : '2px solid #d1d5db',
                                        boxShadow: realIdx === current ? '0 0 0 2px #2563eb33' : undefined,
                                    }}
                                />
                            );
                        })}
                    </div>
                    {canScrollDown && (
                        <button
                            className="w-10 h-6 flex items-center justify-center text-gray-600 hover:text-blue-600"
                            onClick={() => handleThumbScroll('down')}
                            aria-label="Scroll thumbnails down"
                        >
                            ▼
                        </button>
                    )}
                </div>
            )}
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                <div
                    className="w-full h-full rounded shadow"
                    style={{
                        backgroundImage: `url('${images[current]}')`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        maxHeight: '22rem',
                        minHeight: '16rem',
                        width: '100%',
                        transition: 'opacity 0.5s',
                        display: 'block',
                    }}
                    aria-label={alt}
                />
            </div>
        </div>
    );
};

export default ImageSlider;
