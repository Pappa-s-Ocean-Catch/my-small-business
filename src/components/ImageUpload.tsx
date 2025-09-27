"use client";

import { useState, useRef, useEffect } from 'react';
import { FaUpload, FaTimes, FaImage, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-toastify';

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (url: string | null) => void;
  type: 'product' | 'sale_product' | 'staff' | 'supplier' | 'brand';
  className?: string;
  disabled?: boolean;
}

export function ImageUpload({ 
  currentImageUrl, 
  onImageChange, 
  type, 
  className = '',
  disabled = false 
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  
  // Keep preview in sync if parent passes a new currentImageUrl (e.g., when editing existing staff)
  useEffect(() => {
    setPreviewUrl(currentImageUrl || null);
  }, [currentImageUrl]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      // Get the user's access token for authentication
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('No valid session found. Please log in again.');
        return;
      }

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Upload failed');
      }

      setPreviewUrl(result.url);
      onImageChange(result.url);
      toast.success('Image uploaded successfully!');

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = async () => {
    if (!previewUrl) return;

    try {
      // If it's a Vercel Blob URL, delete it from blob storage
      if (previewUrl.includes('blob.vercel-storage.com')) {
        // Get the user's access token for authentication
        const { getSupabaseClient } = await import("@/lib/supabase/client");
        const supabase = getSupabaseClient();
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.access_token) {
          const response = await fetch('/api/upload', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ url: previewUrl }),
          });

          if (!response.ok) {
            console.warn('Failed to delete image from blob storage');
          }
        }
      }

      setPreviewUrl(null);
      onImageChange(null);
      toast.success('Image removed successfully!');

    } catch (error) {
      console.error('Remove error:', error);
      toast.error('Failed to remove image');
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || uploading) return;

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
        return;
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        toast.error('File too large. Maximum size is 5MB.');
        return;
      }

      setUploading(true);

      const uploadFile = async () => {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('type', type);

          // Get the user's access token for authentication
          const { getSupabaseClient } = await import("@/lib/supabase/client");
          const supabase = getSupabaseClient();
          const { data: { session } } = await supabase.auth.getSession();
          
          if (!session?.access_token) {
            toast.error('No valid session found. Please log in again.');
            setUploading(false);
            return;
          }

          const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: formData,
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error || 'Upload failed');
          }

          setPreviewUrl(result.url);
          onImageChange(result.url);
          toast.success('Image uploaded successfully!');

        } catch (error) {
          console.error('Upload error:', error);
          toast.error(error instanceof Error ? error.message : 'Upload failed');
        } finally {
          setUploading(false);
        }
      };

      uploadFile();
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {type === 'product' ? 'Product Image' : 
         type === 'sale_product' ? 'Menu Item Image' :
         type === 'staff' ? 'Staff Photo' :
         type === 'supplier' ? 'Supplier Logo' :
         type === 'brand' ? 'Business Logo' : 'Image'}
      </label>

      {/* Hidden input (always mounted) so Change Image button can trigger it */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />
      
      {/* Image Preview */}
      {previewUrl && (
        <div className="relative inline-block">
          <img
            src={previewUrl}
            alt={`${type} preview`}
            className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-neutral-700"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Remove image"
            >
              <FaTimes className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Upload Area */}
      {!previewUrl && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className={`
            relative border-2 border-dashed border-gray-300 dark:border-neutral-600 
            rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-neutral-500 
            transition-colors cursor-pointer
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        >
          <div className="space-y-2">
            {uploading ? (
              <FaSpinner className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
            ) : (
              <FaImage className="w-8 h-8 text-gray-400 mx-auto" />
            )}
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {uploading ? (
                'Uploading...'
              ) : (
                <>
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    Click to upload
                  </span>
                  {' '}or drag and drop
                </>
              )}
            </div>
            
            <div className="text-xs text-gray-500 dark:text-gray-500">
              PNG, JPG, WebP up to 5MB
            </div>
          </div>
        </div>
      )}

      {/* Upload Button (when image exists) */}
      {previewUrl && !disabled && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
        >
          <FaUpload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Change Image'}
        </button>
      )}
    </div>
  );
}
