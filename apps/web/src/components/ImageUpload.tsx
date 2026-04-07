"use client";

import { useState, useRef, useEffect } from "react";
import { FaUpload, FaTimes, FaImage, FaSpinner, FaExchangeAlt } from "react-icons/fa";
import { toast } from "react-toastify";
import { Icon } from "@/components/Icon";
import { isVercelBlobUrl } from "@/lib/vercel-blob-url";

interface ImageUploadProps {
  currentImageUrl?: string;
  onImageChange: (url: string | null) => void;
  type: "product" | "sale_product" | "staff" | "supplier" | "brand";
  className?: string;
  disabled?: boolean;
}

function shouldDeleteRemoteStorage(url: string): boolean {
  if (url.includes("blob.vercel-storage.com")) return true;
  const bunnyBase =
    process.env.NEXT_PUBLIC_BUNNY_CDN_PUBLIC_URL?.replace(/\/$/, "") ?? "";
  return Boolean(bunnyBase && url.startsWith(bunnyBase));
}

export function ImageUpload({
  currentImageUrl,
  onImageChange,
  type,
  className = "",
  disabled = false,
}: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentImageUrl || null,
  );

  useEffect(() => {
    setPreviewUrl(currentImageUrl || null);
  }, [currentImageUrl]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadDestinationRef = useRef<"vercel" | "bunny">("vercel");

  const openFilePicker = (destination: "vercel" | "bunny") => {
    uploadDestinationRef.current = destination;
    fileInputRef.current?.click();
  };

  const performUpload = async (
    file: File,
    destination: "vercel" | "bunny",
  ): Promise<void> => {
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error(
        "Invalid file type. Only JPEG, PNG, and WebP images are allowed.",
      );
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);
      formData.append("destination", destination);

      const { getSupabaseClient } = await import(
        "@my-small-business/supabase/client"
      );
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("No valid session found. Please log in again.");
        return;
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result: { error?: string; url?: string } = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      if (!result.url) {
        throw new Error("Upload response missing URL");
      }

      setPreviewUrl(result.url);
      onImageChange(result.url);
      toast.success(
        destination === "bunny"
          ? "Image uploaded to Bunny CDN."
          : "Image uploaded to Vercel.",
      );
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
      uploadDestinationRef.current = "vercel";
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const destination = uploadDestinationRef.current;
    await performUpload(file, destination);
  };

  const handleRemoveImage = async () => {
    if (!previewUrl) return;

    try {
      if (shouldDeleteRemoteStorage(previewUrl)) {
        const { getSupabaseClient } = await import(
          "@my-small-business/supabase/client"
        );
        const supabase = getSupabaseClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.access_token) {
          const response = await fetch("/api/upload", {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ url: previewUrl }),
          });

          if (!response.ok) {
            console.warn("Failed to delete image from remote storage");
          }
        }
      }

      setPreviewUrl(null);
      onImageChange(null);
      toast.success("Image removed successfully!");
    } catch (error) {
      console.error("Remove error:", error);
      toast.error("Failed to remove image");
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (disabled || uploading || migrating) return;

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      void performUpload(file, "vercel");
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleMigrateVercelToBunny = async () => {
    if (!previewUrl || !isVercelBlobUrl(previewUrl)) {
      toast.error("Current image is not hosted on Vercel Blob.");
      return;
    }

    setMigrating(true);
    try {
      const { getSupabaseClient } = await import(
        "@my-small-business/supabase/client"
      );
      const supabase = getSupabaseClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        toast.error("No valid session found. Please log in again.");
        return;
      }

      const response = await fetch("/api/upload/migrate-vercel-to-bunny", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ vercelUrl: previewUrl, type }),
      });

      const result: {
        error?: string;
        url?: string;
        warning?: string;
      } = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Migration failed");
      }

      if (!result.url) {
        throw new Error("Migration response missing URL");
      }

      setPreviewUrl(result.url);
      onImageChange(result.url);
      if (result.warning) {
        toast.warning(result.warning);
      }
      toast.success("Image migrated from Vercel to Bunny. Save to update the record.");
    } catch (error) {
      console.error("Migrate error:", error);
      toast.error(error instanceof Error ? error.message : "Migration failed");
    } finally {
      setMigrating(false);
    }
  };

  const labelText =
    type === "product"
      ? "Product Image"
      : type === "sale_product"
        ? "Menu Item Image"
        : type === "staff"
          ? "Staff Photo"
          : type === "supplier"
            ? "Supplier Logo"
            : type === "brand"
              ? "Business Logo"
              : "Image";

  return (
    <div className={`space-y-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {labelText}
      </label>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading || migrating}
      />

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
              <Icon icon={FaTimes} className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {!previewUrl && (
        <div className="space-y-2">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className={`
            relative border-2 border-dashed border-gray-300 dark:border-neutral-600 
            rounded-lg p-6 text-center hover:border-gray-400 dark:hover:border-neutral-500 
            transition-colors cursor-pointer
            ${disabled ? "opacity-50 cursor-not-allowed" : ""}
            ${uploading || migrating ? "opacity-50 cursor-not-allowed" : ""}
          `}
            onClick={() =>
              !disabled && !uploading && !migrating && openFilePicker("vercel")
            }
            onKeyDown={(e) => {
              if (
                (e.key === "Enter" || e.key === " ") &&
                !disabled &&
                !uploading &&
                !migrating
              ) {
                e.preventDefault();
                openFilePicker("vercel");
              }
            }}
            role="button"
            tabIndex={disabled || uploading || migrating ? -1 : 0}
          >
            <div className="space-y-2">
              {uploading || migrating ? (
                <Icon
                  icon={FaSpinner}
                  className="w-8 h-8 text-gray-400 mx-auto animate-spin"
                />
              ) : (
                <Icon
                  icon={FaImage}
                  className="w-8 h-8 text-gray-400 mx-auto"
                />
              )}

              <div className="text-sm text-gray-600 dark:text-gray-400">
                {uploading ? (
                  "Uploading..."
                ) : (
                  <>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      Click to upload to Vercel
                    </span>{" "}
                    or drag and drop
                  </>
                )}
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-500">
                PNG, JPG, WebP up to 5MB (drop zone uses Vercel)
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (!disabled && !uploading && !migrating) openFilePicker("bunny");
            }}
            disabled={disabled || uploading || migrating}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors disabled:opacity-50"
          >
            <Icon icon={FaUpload} className="w-4 h-4" />
            Upload to Bunny
          </button>
        </div>
      )}

      {previewUrl && !disabled && (
        <div className="flex flex-wrap gap-2">
          {isVercelBlobUrl(previewUrl) && (
            <button
              type="button"
              onClick={() => void handleMigrateVercelToBunny()}
              disabled={uploading || migrating}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 rounded-lg border border-teal-200 dark:border-teal-800 hover:bg-teal-100 dark:hover:bg-teal-950/60 transition-colors disabled:opacity-50"
            >
              <Icon
                icon={migrating ? FaSpinner : FaExchangeAlt}
                className={`w-4 h-4 ${migrating ? "animate-spin" : ""}`}
              />
              {migrating ? "Migrating..." : "Migrate Vercel → Bunny"}
            </button>
          )}
          <button
            type="button"
            onClick={() => openFilePicker("vercel")}
            disabled={uploading || migrating}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-neutral-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-neutral-600 transition-colors disabled:opacity-50"
          >
            <Icon icon={FaUpload} className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload to Vercel"}
          </button>
          <button
            type="button"
            onClick={() => openFilePicker("bunny")}
            disabled={uploading || migrating}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 rounded-lg border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/60 transition-colors disabled:opacity-50"
          >
            <Icon icon={FaUpload} className="w-4 h-4" />
            {uploading ? "Uploading..." : "Upload to Bunny"}
          </button>
        </div>
      )}
    </div>
  );
}
