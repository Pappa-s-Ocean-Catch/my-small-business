// Persistent cache for loaded image URLs
const loadedImageCache = new Set<string>();
import React, { useRef, useState, useEffect } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    placeholder?: React.ReactNode;
}



export const LazyImage: React.FC<LazyImageProps> = ({
    src,
    alt,
    className = '',
    placeholder = null,
    ...props
}) => {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [isInView, setIsInView] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [shouldShow, setShouldShow] = useState(false);

    // On mount, check if image is already loaded (from cache)
    useEffect(() => {
        const img = imgRef.current;
        let debounceTimeout: NodeJS.Timeout | null = null;
        // Persistent cache check
        if (loadedImageCache.has(src)) {
            setLoaded(true);
            setShouldShow(true);
            setIsInView(true);
            return;
        }
        if (img && img.complete && img.naturalWidth > 0) {
            loadedImageCache.add(src);
            setLoaded(true);
            setShouldShow(true);
            setIsInView(true);
            return;
        }
        let observer: IntersectionObserver | null = null;
        if (imgRef.current && !loaded) {
            observer = new window.IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        if (!loaded) {
                            if (debounceTimeout) clearTimeout(debounceTimeout);
                            debounceTimeout = setTimeout(() => {
                                setShouldShow(true);
                            }, 200);
                        }
                    }
                    // Do not unset shouldShow after loaded, to avoid blinking
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
            if (debounceTimeout) clearTimeout(debounceTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded, src]);


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
};
