import { GoogleGenerativeAI, Part } from '@google/generative-ai';

// Initialize Google Generative AI
export function getGoogleGenAI() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
  }
  
  return new GoogleGenerativeAI(apiKey);
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
    
    prompt += `Create a professional, well-lit food photography image that showcases the product attractively. Style: clean, modern food photography with good composition and appetizing presentation. This should be a restaurant menu item photo - generate an actual image file, not just a description.`;
    
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
              mimeType: 'image/jpeg',
              data: referenceImageBase64
            }
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
