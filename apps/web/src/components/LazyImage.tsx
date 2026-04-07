import React, { memo, useEffect, useRef, useState } from 'react';

// Persistent cache for loaded image URLs
const loadedImageCache = new Set<string>();
const requestedImageCache = new Set<string>();

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    placeholder?: React.ReactNode;
}



export const LazyImage: React.FC<LazyImageProps> = memo(({
    src,
    alt,
    className = '',
    placeholder = null,
    ...props
}) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const isCached = loadedImageCache.has(src);
    const isRequested = requestedImageCache.has(src);
    const [loaded, setLoaded] = useState<boolean>(isCached);
    const [shouldShow, setShouldShow] = useState<boolean>(isCached || isRequested);

    // Keep state in sync when src changes (avoids placeholder flash for cached images).
    useEffect(() => {
        const img = imgRef.current;
        const cached = loadedImageCache.has(src);
        const requested = requestedImageCache.has(src);
        if (cached || requested) {
            setLoaded(true);
            setShouldShow(true);
            return;
        }

        // Reset for a new uncached source.
        setLoaded(false);
        setShouldShow(false);

        if (img && img.complete && img.naturalWidth > 0) {
            loadedImageCache.add(src);
            setLoaded(true);
            setShouldShow(true);
            return;
        }

        let observer: IntersectionObserver | null = null;
        if (imgRef.current) {
            observer = new window.IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        requestedImageCache.add(src);
                        setShouldShow(true);
                        observer?.disconnect();
                    }
                },
                {
                    rootMargin: '200px', // preload before in view
                    threshold: 0.01,
                }
            );
            observer.observe(imgRef.current);
        }
        return () => {
            observer?.disconnect();
        };
    }, [src]);


    return (
        <span style={{ position: 'relative', display: 'block' }}>
            <img
                ref={imgRef}
                src={shouldShow || loaded ? src : undefined}
                alt={alt}
                className={className}
                onLoad={() => {
                    loadedImageCache.add(src);
                    setLoaded(true);
                    setShouldShow(true);
                }}
                loading="lazy"
                style={{
                    display: 'block',
                    objectFit: 'cover',
                    ...(props.style || {})
                }}
                {...props}
            />
            {!loaded && (
                <span
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        zIndex: 1,
                        pointerEvents: 'none',
                        background: 'inherit',
                    }}
                >
                    {placeholder}
                </span>
            )}
        </span>
    );
});
