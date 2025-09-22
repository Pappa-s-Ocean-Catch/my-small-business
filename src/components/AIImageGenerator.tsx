"use client";

import { useState, useRef } from 'react';
import { FaMagic, FaCamera, FaSpinner, FaTimes, FaImage, FaUpload } from 'react-icons/fa';
import { toast } from 'react-toastify';

interface AIImageGeneratorProps {
  onImageGenerated: (imageUrl: string) => void;
  currentImageUrl?: string;
  productName: string;
  description?: string;
  ingredients?: string[];
  className?: string;
  disabled?: boolean;
}

export function AIImageGenerator({ 
  onImageGenerated, 
  currentImageUrl,
  productName,
  description,
  ingredients,
  className = '',
  disabled = false 
}: AIImageGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [generatedImageBlob, setGeneratedImageBlob] = useState<string | null>(null);
  const [context, setContext] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceImageBase64, setReferenceImageBase64] = useState<string | null>(null);
  const [maxSizeKB, setMaxSizeKB] = useState(200);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleGenerateImage = async () => {
    if (!productName.trim()) {
      toast.error('Product name is required for image generation');
      return;
    }

    setIsGenerating(true);

    try {
      // Get the user's access token for authentication
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('No valid session found. Please log in again.');
        return;
      }

      const response = await fetch('/api/ai/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          productName: productName.trim(),
          description: description?.trim(),
          ingredients: ingredients?.filter(ing => ing.trim()),
          context: context.trim(),
          referenceImageBase64,
          maxSizeKB: maxSizeKB
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Image generation failed');
      }

      // Convert base64 to blob URL for preview
      const imageBlob = await fetch(`data:image/jpeg;base64,${result.imageBase64}`).then(r => r.blob());
      const imageUrl = URL.createObjectURL(imageBlob);
      
      setGeneratedImageBlob(imageUrl);
      setShowGenerator(false);
      setShowPreview(true);
      toast.success('AI image generated! Please review and confirm.');

    } catch (error) {
      console.error('Image generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
      
      // Show a more user-friendly message for unsupported image generation
      if (errorMessage.includes('not currently supported')) {
        toast.info('AI image generation is not available yet. Please use the traditional image upload below.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!generatedImageBlob) return;

    setIsUploading(true);

    try {
      // Convert blob URL back to file for upload
      const response = await fetch(generatedImageBlob);
      const blob = await response.blob();
      const file = new File([blob], 'ai-generated-image.jpg', { type: 'image/jpeg' });

      // Get the user's access token for authentication
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        toast.error('No valid session found. Please log in again.');
        return;
      }

      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'sale_product');

      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      // Clean up blob URL
      URL.revokeObjectURL(generatedImageBlob);
      
      // Set the final image URL
      onImageGenerated(uploadResult.url);
      setShowPreview(false);
      setGeneratedImageBlob(null);
      toast.success('AI image uploaded successfully!');

    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCancelPreview = () => {
    if (generatedImageBlob) {
      URL.revokeObjectURL(generatedImageBlob);
    }
    setGeneratedImageBlob(null);
    setShowPreview(false);
    setShowGenerator(true);
  };

  const handleReferenceImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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

    try {
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setReferenceImage(previewUrl);

      // Convert to base64 for API
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data:image/...;base64, prefix
        const base64Data = base64.split(',')[1];
        setReferenceImageBase64(base64Data);
      };
      reader.readAsDataURL(file);

    } catch (error) {
      console.error('Error processing reference image:', error);
      toast.error('Failed to process reference image');
    }
  };

  const removeReferenceImage = () => {
    if (referenceImage) {
      URL.revokeObjectURL(referenceImage);
    }
    setReferenceImage(null);
    setReferenceImageBase64(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Current Image Display */}
      {currentImageUrl && (
        <div className="relative inline-block">
          <img
            src={currentImageUrl}
            alt="Current product image"
            className="w-32 h-32 object-cover rounded-lg border border-gray-200 dark:border-neutral-700"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => onImageGenerated('')}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              title="Remove image"
            >
              <FaTimes className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* AI Generator Toggle */}
      {!currentImageUrl && (
        <button
          type="button"
          onClick={() => setShowGenerator(!showGenerator)}
          disabled={disabled || isGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FaMagic className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate AI Image'}
        </button>
      )}

      {/* AI Generated Image Preview */}
      {showPreview && generatedImageBlob && (
        <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-neutral-800">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <FaImage className="w-4 h-4 text-green-600" />
            AI Generated Image Preview
          </div>

          {/* Preview Image */}
          <div className="flex justify-center">
            <img
              src={generatedImageBlob}
              alt="AI Generated Preview"
              className="max-w-full max-h-64 object-contain rounded-lg border border-gray-200 dark:border-neutral-700"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmUpload}
              disabled={disabled || isUploading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <FaUpload className="w-4 h-4" />
                  Confirm & Upload
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={handleCancelPreview}
              disabled={isUploading}
              className="px-4 py-2 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {/* Info Text */}
          <div className="text-xs text-gray-500 dark:text-gray-500 text-center">
            Review the generated image. Click &quot;Confirm & Upload&quot; to save it to your product.
          </div>
        </div>
      )}

      {/* AI Generator Panel */}
      {showGenerator && !currentImageUrl && !showPreview && (
        <div className="border border-gray-200 dark:border-neutral-700 rounded-lg p-4 space-y-4 bg-gray-50 dark:bg-neutral-800">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <FaMagic className="w-4 h-4 text-purple-600" />
            AI Image Generator
          </div>

          {/* Product Info Display */}
          <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
            <div><strong>Product:</strong> {productName}</div>
            {description && <div><strong>Description:</strong> {description}</div>}
            {ingredients && ingredients.length > 0 && (
              <div><strong>Ingredients:</strong> {ingredients.join(', ')}</div>
            )}
          </div>

          {/* Context Input */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Additional Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 bg-white dark:bg-neutral-900 text-sm"
              placeholder="e.g., 'rustic presentation', 'modern plating', 'family-style serving', 'gourmet restaurant style'"
              disabled={disabled || isGenerating}
            />
          </div>

          {/* Max Size Control */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Max Image Size (KB)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="50"
                max="1000"
                step="50"
                value={maxSizeKB}
                onChange={(e) => setMaxSizeKB(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 dark:bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                disabled={disabled || isGenerating}
              />
              <div className="flex items-center gap-2 min-w-0">
                <input
                  type="number"
                  min="50"
                  max="1000"
                  step="50"
                  value={maxSizeKB}
                  onChange={(e) => setMaxSizeKB(Math.max(50, Math.min(1000, parseInt(e.target.value) || 200)))}
                  className="w-20 px-2 py-1 text-sm rounded border bg-white dark:bg-neutral-900 text-gray-700 dark:text-gray-300"
                  disabled={disabled || isGenerating}
                />
                <span className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">KB</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500">
              Smaller sizes = faster generation, larger sizes = higher quality. Recommended: 200-500KB
            </div>
          </div>

          {/* Reference Image Upload */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Reference Image (Optional)
            </label>
            
            {referenceImage ? (
              <div className="relative inline-block">
                <img
                  src={referenceImage}
                  alt="Reference"
                  className="w-24 h-24 object-cover rounded-lg border border-gray-200 dark:border-neutral-700"
                />
                <button
                  type="button"
                  onClick={removeReferenceImage}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  title="Remove reference image"
                >
                  <FaTimes className="w-2 h-2" />
                </button>
              </div>
            ) : (
              <div
                onClick={() => !disabled && !isGenerating && fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 dark:hover:border-neutral-500 transition-colors"
              >
                <FaCamera className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Click to add reference image
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  PNG, JPG, WebP up to 5MB
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleReferenceImageUpload}
              className="hidden"
              disabled={disabled || isGenerating}
            />
          </div>

          {/* Generate Button */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGenerateImage}
              disabled={disabled || isGenerating || !productName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <FaSpinner className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FaMagic className="w-4 h-4" />
                  Generate Image
                </>
              )}
            </button>
            
            <button
              type="button"
              onClick={() => setShowGenerator(false)}
              disabled={isGenerating}
              className="px-4 py-2 bg-gray-200 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>

          {/* Info Text */}
          <div className="text-xs text-gray-500 dark:text-gray-500">
            AI will generate a professional food product image based on your product details. 
            Reference images help improve style and composition.
          </div>
        </div>
      )}

      {/* Change Image Button (when image exists) */}
      {currentImageUrl && !disabled && !showPreview && (
        <button
          type="button"
          onClick={() => setShowGenerator(!showGenerator)}
          disabled={isGenerating || isUploading}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
        >
          <FaMagic className="w-4 h-4" />
          {isGenerating ? 'Generating...' : 'Generate New AI Image'}
        </button>
      )}
    </div>
  );
}
