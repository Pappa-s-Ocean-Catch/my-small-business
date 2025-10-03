"use client";

import { useState } from "react";
import { FaMagic, FaSpinner } from "react-icons/fa";
import { toast } from "react-toastify";
import { useAdmin } from "@/hooks/useAdmin";

interface ImagePlaceholderProps {
  productName: string;
  description?: string;
  ingredients?: string[];
  category?: string;
  onImageGenerated: (imageUrl: string) => void;
  className?: string;
}

export function ImagePlaceholder({ 
  productName, 
  description, 
  ingredients, 
  category,
  onImageGenerated,
  className = "" 
}: ImagePlaceholderProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { isAdmin } = useAdmin();

  const handleQuickGenerate = async () => {
    if (!isAdmin) {
      toast.error('Admin access required to generate images');
      return;
    }

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

      // Generate image with default settings
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
          category: category?.trim(),
          context: '', // No additional context for quick generation
          referenceImageBase64: null, // No reference image for quick generation
          maxSizeKB: 300 // Increased size for better quality
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Image generation failed');
      }

      // Convert base64 to blob URL
      const imageBlob = await fetch(`data:image/jpeg;base64,${result.imageBase64}`).then(r => r.blob());
      const imageUrl = URL.createObjectURL(imageBlob);
      
      // Auto-confirm and upload
      const originalFile = new File([imageBlob], 'ai-generated-image.jpg', { type: 'image/jpeg' });
      
      // Compress the JPEG image
      const compressedFile = await compressImage(originalFile, 300);
      
      console.log(`Quick generation - Image compressed: ${(originalFile.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB`);
      
      // Upload to Vercel Blob
      const formData = new FormData();
      formData.append('file', compressedFile);
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
      URL.revokeObjectURL(imageUrl);
      
      // Set the final image URL
      onImageGenerated(uploadResult.url);
      toast.success('AI image generated and uploaded successfully!');

    } catch (error) {
      console.error('Quick generation error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to generate image';
      
      // Show a more user-friendly message for unsupported image generation
      if (errorMessage.includes('not currently supported') || errorMessage.includes('Unable to generate image')) {
        toast.info('AI image generation is not available yet. Please use the traditional image upload feature.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Convert PNG to JPEG for better compression
  const convertPngToJpeg = (file: File, maxSizeKB: number): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1200px width/height for higher quality)
        const maxDimension = 1200;
        let { width, height } = img;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels to achieve target size
        const tryCompress = (quality: number): void => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file); // Fallback to original
              return;
            }
            
            const sizeKB = blob.size / 1024;
            
            if (sizeKB <= maxSizeKB || quality <= 0.1) {
              // Create new file with compressed blob
              const compressedFile = new File([blob], file.name.replace('.png', '.jpg'), { 
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              // Try with lower quality
              tryCompress(quality - 0.1);
            }
          }, 'image/jpeg', quality);
        };
        
        // Start with 0.9 quality for higher image quality
        tryCompress(0.9);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  // Image compression utility (for JPEG files)
  const compressImage = (file: File, maxSizeKB: number): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1200px width/height for higher quality)
        const maxDimension = 1200;
        let { width, height } = img;
        
        if (width > height && width > maxDimension) {
          height = (height * maxDimension) / width;
          width = maxDimension;
        } else if (height > maxDimension) {
          width = (width * maxDimension) / height;
          height = maxDimension;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // Draw and compress
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Try different quality levels to achieve target size
        const tryCompress = (quality: number): void => {
          canvas.toBlob((blob) => {
            if (!blob) {
              resolve(file); // Fallback to original
              return;
            }
            
            const sizeKB = blob.size / 1024;
            
            if (sizeKB <= maxSizeKB || quality <= 0.1) {
              // Create new file with compressed blob
              const compressedFile = new File([blob], file.name, { 
                type: 'image/jpeg',
                lastModified: Date.now()
              });
              resolve(compressedFile);
            } else {
              // Try with lower quality
              tryCompress(quality - 0.1);
            }
          }, 'image/jpeg', quality);
        };
        
        // Start with 0.9 quality for higher image quality
        tryCompress(0.9);
      };
      
      img.src = URL.createObjectURL(file);
    });
  };

  return (
    <div className={`h-48 bg-gray-100 dark:bg-neutral-700 relative group cursor-pointer hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors ${className}`}>
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
        {isGenerating ? (
          <>
            <FaSpinner className="w-8 h-8 animate-spin mb-2" />
            <span className="text-sm">Generating...</span>
          </>
        ) : (
          <>
            <FaMagic className="w-8 h-8 mb-2" />
            <span className="text-sm text-center px-4">
              {isAdmin ? 'Click to generate AI image' : 'No image available'}
            </span>
          </>
        )}
      </div>
      
      {isAdmin && !isGenerating && (
        <button
          onClick={handleQuickGenerate}
          className="absolute inset-0 w-full h-full bg-transparent hover:bg-black/10 transition-colors"
          title="Generate AI image for this product"
        />
      )}
    </div>
  );
}
