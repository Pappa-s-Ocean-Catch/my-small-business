import React, { useRef, useState, useEffect } from 'react';

interface MediaTabContentProps {
    productId?: string;
}

export function MediaTabContent({ productId }: MediaTabContentProps) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Handle drag events
    const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragleave' || e.type === 'dragover') setDragActive(e.type !== 'dragleave');
    };

    // Handle file selection
    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        setSelectedFiles(Array.from(files));
    };

    // Only create preview URLs on the client after mount
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (selectedFiles.length === 0) {
            setPreviewUrls([]);
            return;
        }
        const urls = selectedFiles.map(file => URL.createObjectURL(file));
        setPreviewUrls(urls);
        return () => {
            urls.forEach(url => URL.revokeObjectURL(url));
        };
    }, [selectedFiles]);

    // Handle drop
    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        handleFiles(e.dataTransfer.files);
    };

    // Handle click to open file dialog
    const handleClick = () => {
        inputRef.current?.click();
    };

    // Handle confirm upload (placeholder, implement actual upload logic)
    const handleConfirm = async () => {
        setUploading(true);
        // TODO: Implement upload logic (call backend API to upload and save media)
        setTimeout(() => {
            setUploading(false);
            setSelectedFiles([]);
            setPreviewUrls([]);
            // TODO: Refresh media list after upload
        }, 1500);
    };

    return (
        <div className="space-y-4">
            <h3 className="font-semibold text-lg">Product Media</h3>
            <p className="text-sm text-gray-500">Upload images or videos for this product. Drag and drop files below, preview before confirming upload.</p>
            <div
                className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center min-h-[180px] bg-gray-50 transition-colors ${dragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300'}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={handleClick}
                style={{ cursor: 'pointer' }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    className="hidden"
                    onChange={e => handleFiles(e.target.files)}
                />
                <span className="text-gray-400">Drag & drop images/videos here, or click to select files</span>
                {previewUrls.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                        {previewUrls.map((url, idx) => {
                            const file = selectedFiles[idx];
                            const isImage = file?.type.startsWith('image/');
                            const isVideo = file?.type.startsWith('video/');
                            return (
                                <div key={url} className="relative border rounded shadow-sm bg-white flex flex-col items-center p-2">
                                    {isImage && <img src={url} alt={file?.name} className="max-h-32 max-w-full object-contain" />}
                                    {isVideo && <video src={url} controls className="max-h-32 max-w-full" />}
                                    <div className="text-xs mt-1 truncate w-full text-center">{file?.name}</div>
                                </div>
                            );
                        })}
                    </div>
                )}
                {previewUrls.length > 0 && (
                    <button
                        type="button"
                        className="mt-4 px-4 py-2 bg-blue-600 text-white rounded shadow hover:bg-blue-700 disabled:opacity-50"
                        onClick={handleConfirm}
                        disabled={uploading}
                    >
                        {uploading ? 'Uploading...' : 'Confirm Upload'}
                    </button>
                )}
            </div>
        </div>
    );
}
