# Google AI Setup for Image Generation

This document explains how to set up Google Generative AI for AI-powered image generation in your small business application.

## Environment Variables

Add the following environment variable to your `.env.local` file:

```bash
# Google AI API Key
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
```

## Getting Your Google AI API Key

### Step 1: Create a Google AI Studio Account

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Accept the terms of service

### Step 2: Create an API Key

1. In Google AI Studio, click on "Get API Key" in the left sidebar
2. Click "Create API Key"
3. Choose your Google Cloud project (or create a new one)
4. Copy the generated API key

### Step 3: Configure Your Environment

1. Add the API key to your `.env.local` file:
   ```bash
   GOOGLE_AI_API_KEY=your_actual_api_key_here
   ```

2. For production deployment (Vercel), add the environment variable:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add a new variable:
     - **Name**: `GOOGLE_AI_API_KEY`
     - **Value**: Your Google AI API key
     - **Environment**: Production, Preview, Development

## Features Implemented

### ⚠️ AI Image Generation (Currently Limited)
- **Model**: Attempts to use `gemini-2.5-flash-image-preview` for image generation
- **Current Status**: Google's Gemini models are primarily text-based and don't support actual image generation yet
- **Behavior**: Models return text descriptions instead of images
- **Size Control**: Customizable max file size (50KB - 1000KB) with slider and number input (ready for when image generation works)
- **Fallback**: Traditional image upload is always available and fully functional
- **Future**: Will automatically work when Google adds image generation capabilities

### ✅ Traditional Image Upload
- Upload and manage product images via Vercel Blob storage
- Drag and drop support with preview
- Image validation and optimization
- Full integration with product forms

### ⚠️ Current AI Image Generation Workflow
1. **Configure**: Set max image size (50KB - 1000KB) using slider or number input
2. **Attempt Generation**: Tries to generate image using `gemini-2.5-flash-image-preview` model
3. **Fallback**: When image generation fails, shows user-friendly message
4. **Traditional Upload**: User can upload their own image using the traditional upload feature
5. **Save**: Image URL is saved to the product record

### ✅ Reference Image Support
- Upload reference images for style guidance
- AI uses reference images to improve generation quality
- Support for JPEG, PNG, and WebP formats

### ✅ Size Control Features
- **Range Slider**: Easy adjustment from 50KB to 1000KB
- **Number Input**: Precise size specification with validation
- **Smart Defaults**: Default 200KB for optimal balance
- **Size Guidance**: Built-in recommendations (200-500KB optimal)
- **AI Prompt Integration**: Size constraints passed to AI model for better results
- Automatic base64 conversion for API processing

## Usage

### For Regular Products (Inventory)
1. Go to Shop → Products
2. Click "Add Product" or edit existing product
3. Use the "Generate AI Image" button
4. Add context and optional reference image
5. Review the generated image
6. Click "Confirm & Upload" to save

### For Sale Products (Menu Items)
1. Go to Shop → Menu
2. Click "Add Sale Product" or edit existing product
3. Use the "Generate AI Image" button
4. AI automatically uses product name, description, and ingredients
5. Add additional context and reference image if needed
6. Review and confirm the generated image

## API Endpoints

- `POST /api/ai/generate-image` - Generate AI images
  - Requires admin authentication
  - Accepts product details and reference images
  - Returns base64 encoded image data

## Configuration Options

### Image Generation Parameters
- **Max Size**: 200KB (configurable)
- **Model**: Gemini 2.5 Flash Image Preview
- **Style**: Professional food photography
- **Format**: JPEG output

### Supported Inputs
- Product name (required)
- Description (optional)
- Ingredients list (optional)
- Additional context (optional)
- Reference image (optional)

## Troubleshooting

### Common Issues

1. **"GOOGLE_AI_API_KEY environment variable is not set"**
   - Ensure the API key is added to your `.env.local` file
   - Restart your development server after adding the variable

2. **"Image generation failed"**
   - Check your Google AI API key is valid
   - Ensure you have sufficient API quota
   - Verify your Google Cloud project has the necessary permissions

3. **"Upload failed"**
   - Check your Vercel Blob configuration
   - Ensure admin authentication is working
   - Verify file size limits

### API Quotas and Limits

- Google AI has usage quotas and rate limits
- Monitor your usage in Google AI Studio
- Consider implementing caching for frequently generated images
- Set up billing alerts in Google Cloud Console

## Security Notes

- API keys are server-side only
- All image generation requires admin authentication
- Generated images are stored in Vercel Blob with public access
- Reference images are processed in memory and not stored

## Cost Considerations

- Google AI charges per image generation
- Monitor usage in Google AI Studio dashboard
- Consider implementing user limits or approval workflows
- Cache frequently used images to reduce API calls

## Future Enhancements

- Batch image generation for multiple products
- Image style presets (restaurant, cafe, bakery, etc.)
- Automatic image optimization and compression
- Integration with product categories for better context
- A/B testing for different image styles
