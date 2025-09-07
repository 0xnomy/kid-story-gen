# StoryWonders

AI-powered children's storybook generator that creates custom stories with illustrations.

## Features

- AI story generation using Groq's Llama 4
- AI illustrations using Google Gemini 2.0 Flash
- Interactive page-turning with 3D flipbook
- Text-to-speech with natural voices
- Kid-friendly UI with animations
- Content filtering for child safety
- Mobile responsive design

## Quick Start

### Requirements
- Python 3.8+
- Groq API key
- Google Gemini API key

### Setup

1. Clone and install:
```bash
git clone https://github.com/0xnomy/kid-story-gen.git
cd kid-story-gen
pip install -r requirements.txt
```

2. Configure API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

3. Run the app:
```bash
python start_server.py
```

4. Open browser to `http://localhost:8000`

## Tech Stack

- **Backend**: FastAPI, Pydantic, httpx
- **Frontend**: HTML/CSS/JS, React PageFlip
- **AI**: Groq API (stories), Gemini API (images)

## API Endpoints

- `POST /generate` - Generate story with prompt and page count
- `GET /healthz` - Health check

## Usage

1. Enter a story prompt (e.g., "A brave dragon who makes friends")
2. Select number of pages (2-10)
3. Click "Make My Story"
4. Wait for AI to generate story and illustrations
5. Read interactively with page-turning and text-to-speech

## Configuration

- **Story length**: 40-60 words per page
- **Age range**: Optimized for 4-8 years
- **Content**: Educational with positive messages
- **Images**: Consistent character designs across pages

## Troubleshooting

**API key errors**: Verify keys in `.env` file
**Story generation fails**: Check Groq API key and internet connection
**Images not loading**: Verify Gemini API key
**Page turning issues**: Ensure JavaScript is enabled

## License

MIT License
