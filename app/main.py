"""
Main FastAPI application module for the children's storybook generator.
Handles API endpoints, story generation, and image creation.
"""
import os
import re
import uuid
import asyncio
import logging
import json
import base64
from typing import List, Optional, Dict, Any
import httpx
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends, Request, Query
from fastapi.responses import JSONResponse, FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from dotenv import load_dotenv
from PIL import Image
from google import genai
from google.genai import types
import io
import time

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")  # For Gemini image generation

# Configure logging
logging.basicConfig(level=logging.INFO,
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Kids Storybook Generator",
             description="API for generating interactive children's stories with illustrations")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define data models using Pydantic
class StoryPage(BaseModel):
    index: int
    text: str = Field(..., max_length=450)  # Approx. 60 words
    art_prompt: str
    image_url: Optional[str] = None

class Story(BaseModel):
    title: str
    age_range: str
    pages: List[StoryPage]

class StoryRequest(BaseModel):
    user_prompt: str
    max_pages: int = Field(default=8, ge=2, le=10)  # Minimum 2 pages, maximum 10 pages

# Content filtering patterns
INAPPROPRIATE_PATTERNS = [
    r'\b(death|dead|kill|murder|blood|gore|scary|horror|monster|nightmare|gun|weapon)\b',
    r'\b(violence|violent|hurt|pain|suffer|cruel|evil|devil|demon|hell)\b',
]

# Semaphore to limit concurrent image generation
image_semaphore = asyncio.Semaphore(2)

# Setup base directories using absolute paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DIR = os.path.join(BASE_DIR, "static")
DATA_DIR = os.path.join(BASE_DIR, "data")
ILLUSTRATIONS_DIR = os.path.join(DATA_DIR, "illustrations")

# Ensure directories exist
os.makedirs(ILLUSTRATIONS_DIR, exist_ok=True)

# Mount static files with absolute paths
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/data", StaticFiles(directory=DATA_DIR), name="data")

@app.get("/")
async def root():
    """Root endpoint to redirect to the main application page."""
    return RedirectResponse(url="/static/index.html")

@app.get("/healthz")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy"}

async def filter_content(text: str) -> bool:
    """
    Check if text contains inappropriate content for children.
    
    Args:
        text: Text to check
        
    Returns:
        True if content is clean, False if inappropriate
    """
    for pattern in INAPPROPRIATE_PATTERNS:
        if re.search(pattern, text.lower()):
            return False
    return True

async def generate_story_from_llm(prompt: str, max_pages: int) -> Dict[str, Any]:
    """
    Generate a structured story using Groq's Llama 4 API.
    
    Args:
        prompt: User's story prompt
        max_pages: Maximum number of pages for the story
        
    Returns:
        JSON structure with story data
    """
    system_prompt = (
        "You are an expert children's book author specialized in creating engaging, age-appropriate stories for children. "
        "Generate a rich, immersive, and educational children's story (ages 4-8) as valid JSON only. No markdown formatting. "
        f"Create exactly {max_pages} pages with a clear beginning, middle, and end narrative structure. "
        "Structure: {\"title\": \"Story Title\", \"age_range\": \"4-8\", "
        "\"pages\": [{\"index\": 1, \"text\": \"Page text (max 60 words, 2-4 sentences)\", \"art_prompt\": \"Detailed art description\"}]}. "
        
        "Story guidelines:"
        "- Make the story educational, family-friendly, and engaging for children"
        "- Include a positive message or lesson that's age-appropriate"
        "- Feature diverse characters with distinct personalities"
        "- Create a clear narrative arc with mild tension and resolution"
        "- Use sensory language to make the story immersive"
        "- Include some repetition or predictable patterns that children enjoy"
        "- Each page should have 2-4 sentences (maximum 60 words) to create a more immersive experience"
        "- Use language appropriate for ages 4-8 (simple vocabulary with occasional new words to enhance learning)"
        "- Include vivid sensory details like sounds, smells, textures, and feelings to make the story come alive"
        "- Add dialogue when appropriate to make characters more relatable"
        "- Include small moments of wonder, surprise, or humor to keep students engaged"
        
        "Character consistency guidelines:"
        "- Give each main character a unique and distinctive appearance, name and personality"
        "- For each character, provide clear descriptions of their physical features (hair color/style, eye color, clothing, etc.)"
        "- Introduce main characters in the first few pages with detailed descriptions"
        "- Maintain consistent character traits and appearances throughout all pages"
        "- Reference the same characters throughout the story using the same names and attributes"
        
        "For art_prompt, provide highly detailed visual descriptions that:"
        "- Specify main characters by name with their exact appearance details (e.g., 'Max, the small brown bear with round glasses and a red bowtie')"
        "- For recurring characters, always describe them with the same visual attributes in every prompt"
        "- Describe the setting with specific details (time of day, weather, location)"
        "- Include key objects or elements that are important to the story"
        "- Suggest a mood or atmosphere for the illustration"
        "- Mention color preferences or visual style elements when relevant"
        "- Are descriptive enough for an AI image generator to create a cohesive illustration"
        "- Focus on a single, clear scene that matches the text for that page"
        "- IMPORTANT: Always use the exact same descriptions for recurring characters to ensure visual consistency"
    )
    
    # Prepare the payload for Groq API with enhanced user prompt
    user_prompt = (
        f"Create an engaging and educational children's story about: {prompt}. "
        "Make it immersive with vivid descriptions and sensory details. "
        "Include educational elements that will help students learn while being entertained. "
        "Focus on creating memorable characters and interesting situations that spark imagination. "
        "The story should be both entertaining and have a subtle lesson or educational value."
    )
    
    payload = {
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "model": "llama3-70b-8192",
        "temperature": 0.7,
        "max_tokens": 3072,  # Increased token limit for longer content
        "top_p": 0.9
    }
    
    # Retry logic for API call
    max_retries = 3
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                headers = {
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                }
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    json=payload,
                    headers=headers
                )
                
                if response.status_code == 200:
                    result = response.json()
                    story_json_text = result["choices"][0]["message"]["content"]
                    
                    # Extract JSON from the response
                    # Sometimes the model includes ```json and ``` markers
                    json_pattern = r'```json\s*(.*?)\s*```'
                    json_match = re.search(json_pattern, story_json_text, re.DOTALL)
                    if json_match:
                        story_json_text = json_match.group(1)
                    else:
                        # Try to find JSON between curly braces if no code blocks found
                        json_pattern = r'(\{.*?\})'
                        json_match = re.search(json_pattern, story_json_text, re.DOTALL)
                        if json_match:
                            story_json_text = json_match.group(1)
                    
                    # Clean up any remaining markdown or text
                    story_json_text = re.sub(r'```.*?```', '', story_json_text, flags=re.DOTALL)
                    
                    # Strip any trailing text after the last closing curly brace
                    last_brace_index = story_json_text.rstrip().rfind('}')
                    if last_brace_index != -1:
                        story_json_text = story_json_text[:last_brace_index + 1]
                    
                    # Clean up whitespace and remove any non-JSON content
                    story_json_text = story_json_text.strip()
                    logger.info(f"Processed JSON text: {story_json_text[:50]}...")
                    
                    try:
                        story_data = json.loads(story_json_text)
                        
                        # Validate story structure
                        if "title" not in story_data or "pages" not in story_data:
                            logger.error("Invalid story structure received")
                            raise ValueError("Invalid story structure")
                        
                        # Ensure age_range is present
                        if "age_range" not in story_data:
                            story_data["age_range"] = "4-8"
                            
                        # Ensure all pages have required fields
                        for page in story_data["pages"]:
                            if "index" not in page or "text" not in page or "art_prompt" not in page:
                                logger.error("Invalid page structure received")
                                raise ValueError("Invalid page structure")
                                
                        return story_data
                    except json.JSONDecodeError as e:
                        logger.error(f"Failed to parse JSON from LLM: {e}")
                        logger.debug(f"Raw response: {story_json_text}")
                        
                        if attempt == max_retries - 1:
                            raise HTTPException(status_code=500, detail="Failed to generate valid story structure")
                else:
                    logger.error(f"API error: {response.status_code} - {response.text}")
                    if attempt == max_retries - 1:
                        raise HTTPException(status_code=response.status_code, 
                                           detail=f"Error from story generation API: {response.text}")
        except httpx.RequestError as e:
            logger.error(f"Request error: {e}")
            if attempt == max_retries - 1:
                raise HTTPException(status_code=500, detail=f"Connection error: {str(e)}")
        
        # Exponential backoff
        await asyncio.sleep(retry_delay * (2 ** attempt))

# Original generate_image function has been replaced by generate_image_with_character_consistency using Gemini API

async def generate_image_with_character_consistency(art_prompt: str, page_index: int, 
                                       character_descriptions: dict = None, 
                                       previous_prompts: list = None) -> str:
    """
    Generate an illustration with consistent characters across pages using Gemini API.
    
    Args:
        art_prompt: Description of the image to generate
        page_index: Page number for the illustration
        character_descriptions: Dictionary of character descriptions extracted from the story
        previous_prompts: List of previous prompts used for earlier pages
        
    Returns:
        URL path to the saved image
    """
    # Base enhanced prompt
    base_style = (
        "Style: Vibrant children's picture book illustration with soft rounded edges, "
        "bright cheerful colors, simple approachable shapes, friendly expressive characters with clear emotions, "
        "warm golden lighting with soft shadows, clean uncluttered composition, "
        "rich texture details, illustration style similar to popular children's books, "
        "no text overlay, 3:4 aspect ratio, soft depth of field with foreground elements in focus, "
        "appealing to children ages 4-8, wholesome and engaging, masterful professional illustration"
    )
    
    # Customize prompt based on character consistency needs
    if page_index > 1 and character_descriptions:
        # Add character descriptions for consistency
        character_details = ". ".join([f"{name}: {desc}" for name, desc in character_descriptions.items()])
        enhanced_prompt = (
            f"Create a high-quality children's book illustration of {art_prompt}. "
            f"Maintain consistent character appearances where: {character_details}. "
            f"{base_style}"
        )
    else:
        enhanced_prompt = f"Create a high-quality children's book illustration of {art_prompt}. {base_style}"
    
    # Ensure the prompt is safe
    if not await filter_content(art_prompt):
        logger.warning(f"Potentially inappropriate art prompt filtered: {art_prompt}")
        enhanced_prompt = (
            "Create a high-quality children's book illustration of a friendly cute animal character smiling in a sunny magical forest with flowers and butterflies. "
            f"{base_style}"
        )
    
    # Add reference to previous prompts for consistency if available
    if previous_prompts and page_index > 1:
        enhanced_prompt += f" Maintain visual consistency with previous illustrations in the same story."
    
    # Generate a unique filename
    image_filename = f"page_{page_index}_{uuid.uuid4()}.png"
    image_path = os.path.join(ILLUSTRATIONS_DIR, image_filename)
    image_url = f"/data/illustrations/{image_filename}"
    
    # Retry logic
    max_retries = 3
    retry_delay = 1
    
    # Get Gemini API key from environment
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    if not gemini_api_key:
        logger.error("GEMINI_API_KEY not found in environment variables")
        return "/static/placeholder_image.png"
    
    async with image_semaphore:  # Limit concurrent requests
        for attempt in range(max_retries):
            try:
                # Create a synchronous function for the thread pool
                def generate_with_gemini():
                    try:
                        from google import genai
                        from google.genai import types
                        from io import BytesIO
                        
                        # Initialize Gemini client
                        client = genai.Client(api_key=gemini_api_key)
                        
                        logger.info(f"Generating image with Gemini for page {page_index} with prompt: {enhanced_prompt[:100]}...")
                        
                        # Generate image using Gemini 2.0 Flash Preview Image Generation
                        response = client.models.generate_content(
                            model="gemini-2.0-flash-preview-image-generation",
                            contents=enhanced_prompt,
                            config=types.GenerateContentConfig(
                                response_modalities=['TEXT', 'IMAGE']
                            )
                        )
                        
                        # Extract image from response
                        for part in response.candidates[0].content.parts:
                            if part.inline_data is not None:
                                # Convert the inline data to PIL Image
                                image_data = part.inline_data.data
                                image = Image.open(BytesIO(image_data))
                                logger.info(f"Gemini API response received for page {page_index}")
                                return image
                        
                        # If no image found in response
                        logger.error(f"No image data found in Gemini response for page {page_index}")
                        return None
                        
                    except Exception as e:
                        logger.error(f"Error in Gemini API request: {str(e)}")
                        return None
                
                # Run the synchronous Gemini request in a thread pool
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(None, generate_with_gemini)
                
                if result:
                    logger.info(f"Got result for page {page_index}, processing...")
                    
                    # Handle the result - we should get a PIL Image object
                    if isinstance(result, Image.Image):
                        logger.info(f"Result is a PIL Image object")
                        result.save(image_path)
                        logger.info(f"Image for page {page_index} saved to {image_path}")
                        return image_url
                    else:
                        logger.error(f"Unknown result type from Gemini API: {type(result)}")
                
                # If we reached this point, something went wrong
                logger.error(f"Failed to generate or save image for page {page_index} on attempt {attempt+1}")
                
                if attempt == max_retries - 1:
                    # If all retries fail, return placeholder image
                    logger.warning(f"All retries failed for page {page_index}, using placeholder")
                    return "/static/placeholder_image.png"
                    
            except Exception as e:
                logger.error(f"Error generating image for page {page_index}: {str(e)}")
                if attempt == max_retries - 1:
                    # Return placeholder on failure
                    return "/static/placeholder_image.png"
            
            # Wait before retry
            wait_time = retry_delay * (2 ** attempt)
            logger.info(f"Retrying page {page_index} in {wait_time}s (attempt {attempt+1}/{max_retries})")
            await asyncio.sleep(wait_time)
    
    # If all else fails
    return "/static/placeholder_image.png"

async def extract_character_descriptions(pages):
    """
    Extract character descriptions from story pages to maintain consistency.
    
    Args:
        pages: List of story pages
        
    Returns:
        Dictionary of character names and their descriptions
    """
    characters = {}
    character_pattern = r'([A-Z][a-z]+ (?:[A-Z][a-z]+ )?(?:the |is a |was a )?[a-z]+)'
    
    # Process first few pages to extract character descriptions
    for page in pages[:min(3, len(pages))]:
        art_prompt = page.get("art_prompt", "")
        text = page.get("text", "")
        
        # Look for character descriptions in both text and art prompt
        combined_text = f"{text} {art_prompt}"
        
        # Try to identify characters and their descriptions
        matches = re.findall(character_pattern, combined_text)
        
        for match in matches:
            name_parts = match.split(' ')
            if len(name_parts) >= 2:
                potential_name = name_parts[0]
                # If it looks like a name (capitalized) add it to our characters dictionary
                if potential_name[0].isupper():
                    description_start_idx = combined_text.find(match)
                    if description_start_idx >= 0:
                        # Get a chunk of text after the character mention
                        description_text = combined_text[description_start_idx:description_start_idx+100]
                        characters[potential_name] = description_text.split('.')[0]
    
    return characters

@app.post("/generate", response_model=Story)
async def generate_story(request: StoryRequest):
    """
    Generate a complete story with text and illustrations.
    
    Args:
        request: Story request with user prompt and parameters
        
    Returns:
        Complete story with text and image URLs
    """
    # Validate user prompt
    if not request.user_prompt or len(request.user_prompt.strip()) < 3:
        raise HTTPException(status_code=400, detail="Please provide a valid story prompt")
    
    if not await filter_content(request.user_prompt):
        raise HTTPException(status_code=400, 
                          detail="Your prompt contains content that isn't appropriate for children")
    
    # Generate story structure from LLM
    try:
        story_data = await generate_story_from_llm(request.user_prompt, request.max_pages)
        
        # Extract character descriptions to maintain consistency across pages
        character_descriptions = await extract_character_descriptions(story_data["pages"])
        logger.info(f"Extracted characters: {character_descriptions}")
        
        # Keep track of prompts used for each page for consistency
        used_prompts = []
        
        # Generate images sequentially to maintain character consistency
        logger.info(f"Generating images for {len(story_data['pages'])} pages sequentially")
        for i, page in enumerate(story_data["pages"]):
            try:
                logger.info(f"Processing page {i+1}/{len(story_data['pages'])}: {page['art_prompt'][:50]}...")
                image_url = await generate_image_with_character_consistency(
                    page["art_prompt"], 
                    page["index"],
                    character_descriptions,
                    used_prompts
                )
                page["image_url"] = image_url
                used_prompts.append(page["art_prompt"])
                logger.info(f"Completed page {i+1}/{len(story_data['pages'])}: {image_url}")
            except Exception as e:
                logger.error(f"Error generating image for page {page['index']}: {str(e)}")
                page["image_url"] = "/static/placeholder_image.png"
        
        # Create and return the story object
        story = Story(
            title=story_data["title"],
            age_range=story_data["age_range"],
            pages=[StoryPage(**page) for page in story_data["pages"]]
        )
        
        return story
    except Exception as e:
        logger.error(f"Error generating story: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Story generation failed: {str(e)}")

# Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
