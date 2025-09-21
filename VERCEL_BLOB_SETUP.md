# Vercel Blob Setup for Image Uploads

This document explains how to set up Vercel Blob for image uploads in OperateFlow.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Vercel Blob Storage
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token_here
```

## Getting Your Vercel Blob Token

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to your project
3. Go to Settings → Environment Variables
4. Add a new environment variable:
   - **Name**: `BLOB_READ_WRITE_TOKEN`
   - **Value**: Your Vercel Blob token (starts with `vercel_blob_rw_`)
   - **Environment**: Production, Preview, Development

## How to Get the Token

1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel env pull .env.local`
3. Or create a new Blob store in Vercel Dashboard and copy the token

## Features Implemented

### ✅ Image Upload for Products
- Upload images when creating/editing products
- Drag and drop support
- File validation (JPEG, PNG, WebP, max 5MB)
- Image preview and removal

### ✅ Image Upload for Sale Products (Menu Items)
- Upload images when creating/editing sale products
- Same drag and drop functionality
- Integrated with menu management

### ✅ Image Display
- Product cards show images
- Product tables show thumbnail images
- Sale product cards display images
- Responsive image sizing

### ✅ API Endpoints
- `POST /api/upload` - Upload images
- `DELETE /api/upload` - Delete images
- Admin-only access with authentication

## Usage

1. **Adding Images to Products**:
   - Go to Shop → Products
   - Click "Add Product" or edit existing product
   - Use the image upload component to add/change images

2. **Adding Images to Sale Products**:
   - Go to Shop → Menu
   - Click "Add Sale Product" or edit existing product
   - Use the image upload component to add/change images

## File Storage

- Images are stored in Vercel Blob storage
- URLs are saved in the database `image_url` field
- Images are automatically optimized by Vercel
- CDN delivery for fast loading

## Security

- Only admin users can upload/delete images
- File type validation (images only)
- File size limit (5MB max)
- JWT token authentication required for all operations
- Authorization header with Bearer token

## Troubleshooting

### "Upload failed" or "Unauthorized" error
- Check if `BLOB_READ_WRITE_TOKEN` is set correctly
- Verify the token has read/write permissions
- Ensure you're logged in as an admin user
- Check browser console for detailed error messages
- Verify your session is valid (try refreshing the page)

### Images not displaying
- Check if the image URL is valid
- Verify the image was uploaded successfully
- Check network tab for failed requests

### Build errors
- Ensure `@vercel/blob` package is installed
- Check that all imports are correct
- Verify TypeScript types are properly defined
