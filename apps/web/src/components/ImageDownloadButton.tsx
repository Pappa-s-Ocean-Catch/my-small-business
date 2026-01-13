"use client";

import { useState } from "react";
import { FaDownload, FaSpinner } from "react-icons/fa";

interface ImageDownloadButtonProps {
  imageUrl: string;
  fileName: string;
  className?: string;
}

export function ImageDownloadButton({ imageUrl, fileName, className = "" }: ImageDownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (!imageUrl) return;

    setDownloading(true);
    try {
      // Fetch the image
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error('Failed to fetch image');
      
      const blob = await response.blob();
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'image.jpg';
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading image:', error);
      // You could add a toast notification here
    } finally {
      setDownloading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className={`
        absolute top-2 right-2 bg-black/70 hover:bg-black/90 text-white 
        p-2 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      title="Download image"
    >
      {downloading ? (
        <FaSpinner className="w-4 h-4 animate-spin" />
      ) : (
        <FaDownload className="w-4 h-4" />
      )}
    </button>
  );
}
