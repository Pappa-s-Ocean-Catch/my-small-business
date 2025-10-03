import { GoogleGenerativeAI, Part } from '@google/generative-ai';

// Initialize Google Generative AI
export function getGoogleGenAI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
  }
  
  return new GoogleGenerativeAI(apiKey);
}

// =========================
// Combo generation (text)
// =========================
export type ComboConstraints = {
  numCombos: number; // how many combos to propose
  itemsPerCombo?: number; // items per combo
  serves?: number; // intended serves per combo
  priceMin?: number;
  priceMax?: number;
  preferredCategories?: string[];
  dietaryNotes?: string; // e.g., halal-friendly, vegetarian options
  mealPeriod?: 'lunch' | 'dinner' | 'all_day';
  groupType?: 'couple' | 'friends' | 'family' | 'custom';
  peopleCount?: number; // for friends/custom; family defaults assumed (2 adults, 2 kids) unless provided
};

export type ComboProduct = {
  id: string;
  name: string;
  description?: string;
  categoryName?: string;
  price: number;
  ingredients?: Array<{ name: string; quantity?: string }>;
  popularityScore?: number; // optional metric
  costEstimate?: number; // optional COGS
};

export type ComboItem = {
  productId: string;
  name: string;
  quantity: number;
};

export type ComboRecommendation = {
  title: string;
  items: ComboItem[];
  suggestedBundlePrice: number;
  estimatedMarginPercent?: number;
  reasoning: string;
};

export async function generateCombos({
  constraints,
  products,
}: {
  constraints: ComboConstraints;
  products: ComboProduct[];
}): Promise<{ combos: ComboRecommendation[]; error?: string }> {
  try {
    const genAI = getGoogleGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

    const schema = {
      type: 'object',
      properties: {
        combos: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    productId: { type: 'string' },
                    name: { type: 'string' },
                    quantity: { type: 'number' },
                  },
                  required: ['productId', 'name', 'quantity'],
                },
              },
              suggestedBundlePrice: { type: 'number' },
              estimatedMarginPercent: { type: 'number' },
              reasoning: { type: 'string' },
            },
            required: ['title', 'items', 'suggestedBundlePrice', 'reasoning'],
          },
        },
      },
      required: ['combos'],
      additionalProperties: false,
    };

    const promptHeader =
      'You are a restaurant combo planner. Build combos to maximize revenue while respecting constraints. '
      + 'Use only the provided product list. Prefer popular, high-margin items when possible. '
      + 'Ensure variety and category balance when applicable. Output strictly valid JSON matching the provided schema. No extra text.';

    const parts: Part[] = [
      { text: `${promptHeader}\n\nConstraints (JSON):\n${JSON.stringify(constraints)}\n\nProducts (JSON):\n${JSON.stringify(products.slice(0, 300))}\n\nSchema (JSON):\n${JSON.stringify(schema)}` },
    ];

    const result = await model.generateContent(parts);
    const response = await result.response;
    const text = response.text();

    // Attempt to parse as JSON. Strip code fences if present.
    const jsonString = text
      .replace(/^```(json)?/i, '')
      .replace(/```$/i, '')
      .trim();

    const parsed = JSON.parse(jsonString) as { combos: ComboRecommendation[] };
    if (!parsed || !Array.isArray(parsed.combos)) {
      throw new Error('Invalid AI response format: missing combos array');
    }

    return { combos: parsed.combos };
  } catch (error) {
    console.error('Error generating combos:', error);
    return {
      combos: [],
      error: error instanceof Error ? error.message : 'Failed to generate combos',
    };
  }
}

// Generate image using Google's Gemini model
export async function generateProductImage({
  productName,
  description,
  ingredients,
  category,
  context,
  referenceImageBase64,
  maxSizeKB = 200
}: {
  productName: string;
  description?: string;
  ingredients?: string[];
  category?: string;
  context?: string;
  referenceImageBase64?: string;
  maxSizeKB?: number;
}): Promise<{ imageBase64: string; error?: string }> {
  try {
    const genAI = getGoogleGenAI();
    
    // Build the prompt - be very explicit about wanting an image
    let prompt = `Generate a high-quality, appetizing food product image for "${productName}". `;
    
    if (category) {
      prompt += `Category: ${category}. `;
    }
    
    if (description) {
      prompt += `Description: ${description}. `;
    }
    
    if (ingredients && ingredients.length > 0) {
      prompt += `Key ingredients: ${ingredients.join(', ')}. `;
    }
    
    if (context) {
      prompt += `Context: ${context}. `;
    }
    
    // Enhanced prompt for reference image usage
    if (referenceImageBase64) {
      prompt += `IMPORTANT: Use the provided reference image as your primary visual guide. Study the reference image carefully and create a new image that:
      - Maintains the realistic style, composition, and visual elements from the reference
      - Keeps the authentic look and feel of the reference image
      - Adds creative and attractive enhancements while staying true to the reference
      - Improves lighting, presentation, and visual appeal while preserving the core visual identity
      - Creates a more polished, professional version that builds upon the reference image
      - Maintains the same food item but with enhanced visual quality and attractiveness
      
      The reference image shows the actual product - use it as your foundation and enhance it creatively while keeping it realistic and authentic.
      
      IMPORTANT: Generate the image in JPEG format for web optimization and smaller file size.`;
    } else {
      prompt += `Create a professional, well-lit food photography image that showcases the product attractively. Style: clean, modern food photography with good composition and appetizing presentation. This should be a restaurant menu item photo - generate an actual image file, not just a description.
      
      IMPORTANT: Generate the image in JPEG format for web optimization and smaller file size.`;
    }
    
    // Use the correct model that supports image generation
    const modelsToTry = [
      'gemini-2.5-flash-image-preview',
      'gemini-2.0-flash-exp',
      'gemini-1.5-pro'
    ];
    
    let lastError = null;
    
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
    
        // Prepare the content parts
        const parts: Part[] = [
          {
            text: prompt
          }
        ];
        
        // Add reference image if provided
        if (referenceImageBase64) {
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: referenceImageBase64
            }
          });
          // Add specific instruction about the reference image
          parts.push({
            text: "This is the reference image. Use it as your primary visual guide to create an enhanced, more attractive version while maintaining the realistic and authentic qualities of the original."
          });
        }
        
        // Try streaming first for image generation
        let imageData = null;
        try {
          const result = await model.generateContentStream(parts);
          
          for await (const chunk of result.stream) {
            if (chunk.candidates?.[0]?.content?.parts) {
              for (const part of chunk.candidates[0].content.parts) {
                if (part.inlineData) {
                  imageData = part.inlineData;
                  break;
                }
              }
            }
            if (imageData) break;
          }
        } catch (streamError) {
          // Fallback to regular generateContent
          const result = await model.generateContent(parts);
          const response = await result.response;
          
          // Get the generated image - check multiple possible locations
          if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
              if (part.inlineData) {
                imageData = part.inlineData;
                break;
              }
            }
          }
        }
        
        // If still no image, log that no image was generated
        if (!imageData) {
          console.log('Model returned text instead of image or no image data found');
        }
        
        if (imageData) {
          // Convert to base64 and compress if needed
          const imageBase64 = imageData.data;
          
          // Check size and compress if necessary
          const sizeInBytes = (imageBase64.length * 3) / 4; // Approximate size
          const sizeInKB = sizeInBytes / 1024;
          
          if (sizeInKB > maxSizeKB) {
            console.warn(`Generated image is ${sizeInKB.toFixed(2)}KB, which exceeds the ${maxSizeKB}KB limit`);
          }
          
          return { imageBase64 };
        } else {
          console.log(`Model ${modelName} did not generate an image, trying next model...`);
          lastError = new Error(`Model ${modelName} did not generate an image`);
        }
        
      } catch (modelError) {
        lastError = modelError;
        continue; // Try next model
      }
    }
    
    // If we get here, all models failed to generate images
    console.error('All models failed to generate images. This may be due to API limitations or model availability.');
    
    // Return a helpful error message
    return { 
      imageBase64: '', 
      error: 'Unable to generate image at this time. Please try again later or use the traditional image upload feature.' 
    };
    
  } catch (error) {
    console.error('Error generating image:', error);
    return { 
      imageBase64: '', 
      error: error instanceof Error ? error.message : 'Failed to generate image' 
    };
  }
}

// Alternative: Use Gemini Pro Vision for image analysis and enhancement
export async function analyzeAndEnhanceImage(imageBase64: string, prompt: string): Promise<{ analysis: string; error?: string }> {
  try {
    const genAI = getGoogleGenAI();
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    
    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: imageBase64
        }
      },
      prompt
    ]);
    
    const response = await result.response;
    const analysis = response.text();
    
    return { analysis };
    
  } catch (error) {
    console.error('Error analyzing image:', error);
    return { 
      analysis: '', 
      error: error instanceof Error ? error.message : 'Failed to analyze image' 
    };
  }
}
