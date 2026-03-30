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

    useEffect(() => {
        let observer: IntersectionObserver | null = null;
        if (imgRef.current) {
            observer = new window.IntersectionObserver(
                ([entry]) => {
                    if (entry.isIntersecting) {
                        setIsInView(true);
                        setShouldShow(true);
                    } else {
                        setIsInView(false);
                        // Only unload if not loaded yet
                        setShouldShow((prev) => (loaded ? prev : false));
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    return (
        <span style={{ position: 'relative', display: 'block' }}>
            <img
                ref={imgRef}
                src={shouldShow ? src : undefined}
                alt={alt}
                className={className}
                onLoad={() => setLoaded(true)}
                loading="lazy"
                style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
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
