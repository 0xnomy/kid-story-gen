/**
 * StoryWonders - Interactive Children's Storybook Web Application
 * Main JavaScript file handling UI interactions, API calls, and story display
 */

// DOM Elements
const storyForm = document.getElementById('story-form');
const storyViewer = document.getElementById('story-viewer');
const storyPromptInput = document.getElementById('story-prompt');
const pageCountInput = document.getElementById('page-count');
const pageCountValue = document.getElementById('page-count-value');
const generateBtn = document.getElementById('generate-btn');
const loadingIndicator = document.getElementById('loading');
const backToFormBtn = document.getElementById('back-to-form');
const toggleReadAloudBtn = document.getElementById('toggle-read-aloud');
const readAloudText = document.getElementById('read-aloud-text');
const bookElement = document.getElementById('book');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const currentPageIndicator = document.getElementById('current-page');
const totalPagesIndicator = document.getElementById('total-pages');
const errorMessage = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const closeError = document.querySelector('.close-error');

// State management
let currentStory = null;
let currentPageIndex = 0;
let isReadingAloud = false;
let speechSynthesis = window.speechSynthesis;
let speechUtterance = null;
// Traditional view mode only

// Initialize
document.addEventListener('DOMContentLoaded', initialize);

// Initialize speech synthesis voices
let availableVoices = [];

function initSpeechSynthesisVoices() {
    // Some browsers (like Chrome) load voices asynchronously
    window.speechSynthesis.onvoiceschanged = function () {
        availableVoices = window.speechSynthesis.getVoices();
        createVoiceSelector();
    };

    // For browsers that load voices immediately
    if (window.speechSynthesis.getVoices().length > 0) {
        availableVoices = window.speechSynthesis.getVoices();
        createVoiceSelector();
    }
}

function createVoiceSelector() {
    // Create voice selector if it doesn't exist and we have a book controls section
    const topControls = document.querySelector('.book-controls.top-controls');
    if (!topControls || document.getElementById('voice-selector')) return;

    // Filter to get only female voices
    const femaleVoices = availableVoices.filter(voice =>
        voice.name.includes("Female") ||
        voice.name.includes("Samantha") ||
        voice.name.includes("Victoria") ||
        voice.name.includes("Karen") ||
        voice.name.includes("Zira") ||
        voice.name.toLowerCase().includes("girl") ||
        voice.name.includes("woman")
    );

    // If we have female voices, create a selector
    if (femaleVoices.length > 0) {
        const voiceSelectorContainer = document.createElement('div');
        voiceSelectorContainer.className = 'voice-selector-container';
        voiceSelectorContainer.id = 'voice-selector';

        const selectElement = document.createElement('select');
        selectElement.id = 'voice-select';
        selectElement.className = 'voice-select';

        // Add a default option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = '🎤 Choose a reading voice';
        selectElement.appendChild(defaultOption);

        // Add all female voices
        femaleVoices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            selectElement.appendChild(option);
        });

        // Add event listener to change voice
        selectElement.addEventListener('change', function () {
            const selectedVoiceName = this.value;
            const selectedVoice = availableVoices.find(v => v.name === selectedVoiceName);

            if (selectedVoice) {
                // Save preference
                localStorage.setItem('preferredVoice', selectedVoiceName);

                // If currently reading, restart with new voice
                if (isReadingAloud) {
                    stopReading();
                    startReading();
                }
            }
        });

        // Set previously selected voice if available
        const savedVoice = localStorage.getItem('preferredVoice');
        if (savedVoice && femaleVoices.some(v => v.name === savedVoice)) {
            selectElement.value = savedVoice;
        }

        voiceSelectorContainer.appendChild(selectElement);
        topControls.appendChild(voiceSelectorContainer);
    }
}

function initialize() {
    // Set up event listeners
    pageCountInput.addEventListener('input', updatePageCountDisplay);
    generateBtn.addEventListener('click', handleGenerateStory);

    // Initialize speech synthesis voices
    initSpeechSynthesisVoices();
    backToFormBtn.addEventListener('click', resetToForm);
    toggleReadAloudBtn.addEventListener('click', toggleReadAloud);
    prevPageBtn.addEventListener('click', goToPreviousPage);
    nextPageBtn.addEventListener('click', goToNextPage);
    closeError.addEventListener('click', hideError);

    // Set initial page count display
    updatePageCountDisplay();

    // Create placeholder image for fallbacks
    createPlaceholderImage();
}

// Helper functions
function updatePageCountDisplay() {
    pageCountValue.textContent = pageCountInput.value;
}

function showLoading() {
    loadingIndicator.classList.remove('hidden');
    generateBtn.disabled = true;
}

function hideLoading() {
    loadingIndicator.classList.add('hidden');
    generateBtn.disabled = false;
}

function showError(message) {
    errorText.textContent = message;
    errorMessage.classList.remove('hidden');

    // Auto-hide after 8 seconds
    setTimeout(() => {
        hideError();
    }, 8000);
}

function hideError() {
    errorMessage.classList.add('hidden');
}

function resetToForm() {
    // Stop any ongoing speech
    if (isReadingAloud) {
        stopReading();
    }

    // Reset state
    currentStory = null;
    currentPageIndex = 0;

    // Flipbook code removed    // Show form, hide story viewer
    storyForm.classList.remove('hidden');
    storyViewer.classList.add('hidden');

    // Clear form for new input
    storyPromptInput.focus();
}

function showStoryViewer() {
    storyForm.classList.add('hidden');
    storyViewer.classList.remove('hidden');
}

// API interaction
async function handleGenerateStory() {
    const prompt = storyPromptInput.value.trim();
    const pageCount = parseInt(pageCountInput.value, 10);

    if (!prompt) {
        showError('Please enter a story prompt');
        return;
    }

    // Show loading state
    showLoading();

    try {
        const response = await fetch('/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_prompt: prompt,
                max_pages: pageCount
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to generate story');
        }

        const storyData = await response.json();

        // Save story to state and display it
        currentStory = storyData;
        displayStory(currentStory);

        // Switch to story viewer
        showStoryViewer();

    } catch (error) {
        showError(error.message || 'An error occurred while generating your story');
        console.error('Story generation error:', error);
    } finally {
        hideLoading();
    }
}

// Story display
function displayStory(story) {
    // Reset current page
    currentPageIndex = 0;

    // Update title and age range
    document.getElementById('story-title').textContent = story.title;
    document.getElementById('age-range').textContent = story.age_range;

    // Set cover image (use first page image)
    if (story.pages && story.pages.length > 0) {
        const coverImage = document.getElementById('cover-image');
        if (coverImage) {
            coverImage.style.backgroundImage = `url('${story.pages[0].image_url}')`;
        }
    }

    // Update traditional book if it's visible
    if (!document.getElementById('traditional-book').classList.contains('hidden')) {
        // Clear existing pages (except cover)
        const existingPages = document.querySelectorAll('.page:not(.cover-page)');
        existingPages.forEach(page => page.remove());

        // Add pages to the book
        story.pages.forEach((page, index) => {
            const pageElement = createPageElement(page);
            // Set initial z-index for proper stacking (higher index = lower in stack)
            pageElement.style.zIndex = story.pages.length - index;
            bookElement.appendChild(pageElement);
        });

        // Update page indicators
        totalPagesIndicator.textContent = story.pages.length + 1; // +1 for cover
        currentPageIndicator.textContent = 1; // Start at cover

        // Reset navigation buttons
        updateNavigationButtons();
    }

    // Send the story data to the React flipbook
    const storyEvent = new CustomEvent('storyGenerated', {
        detail: story
    });

    document.dispatchEvent(storyEvent);

    // Flipbook initialization removed
}

function createPageElement(page) {
    const pageElement = document.createElement('div');
    pageElement.classList.add('page');
    pageElement.id = `page-${page.index}`;

    const pageContent = document.createElement('div');
    pageContent.classList.add('page-content');

    // Page image
    const pageImage = document.createElement('div');
    pageImage.classList.add('page-image');
    pageImage.style.backgroundImage = `url('${page.image_url}')`;

    // Page text
    const pageText = document.createElement('p');
    pageText.classList.add('page-text');
    pageText.textContent = page.text;

    // Page number
    const pageNumber = document.createElement('div');
    pageNumber.classList.add('page-number');
    pageNumber.textContent = `Page ${page.index}`;

    // Assemble the page
    pageContent.appendChild(pageImage);
    pageContent.appendChild(pageText);
    pageContent.appendChild(pageNumber);
    pageElement.appendChild(pageContent);

    return pageElement;
}

// Navigation
function updateNavigationButtons() {
    // Disable previous button if on first page (cover)
    prevPageBtn.disabled = currentPageIndex === 0;

    // Disable next button if on last page
    nextPageBtn.disabled = currentPageIndex === currentStory.pages.length;

    // Update page indicator
    currentPageIndicator.textContent = currentPageIndex + 1;
}

function goToPreviousPage() {
    if (currentPageIndex > 0) {
        // Stop reading if active
        if (isReadingAloud) {
            stopReading();
        }

        // First decrement the page index
        currentPageIndex--;

        // Find the page we need to unflip
        const pageToUnflip = currentPageIndex === 0
            ? document.getElementById('cover-page')
            : document.getElementById(`page-${currentPageIndex}`);

        // Unflip the page with animation
        if (pageToUnflip) {
            pageToUnflip.classList.remove('flipped');
        }

        // Update navigation buttons to reflect new page
        updateNavigationButtons();

        // Start reading this page if read-aloud is active
        if (isReadingAloud) {
            // Small delay to let animation complete
            setTimeout(() => {
                readCurrentPage();
            }, 500);
        }
    }
}

function goToNextPage() {
    if (currentPageIndex < currentStory.pages.length) {
        // Stop reading if active
        if (isReadingAloud) {
            stopReading();
        }

        // Get the current page to flip
        const pageToFlip = currentPageIndex === 0
            ? document.getElementById('cover-page')
            : document.getElementById(`page-${currentPageIndex}`);

        // Apply flip animation to current page
        if (pageToFlip) {
            pageToFlip.classList.add('flipped');

            // Use a small timeout to allow the animation to start
            setTimeout(() => {
                // After animation starts, increment page index
                currentPageIndex++;
                updateNavigationButtons();

                // Start reading this page if read-aloud is active
                if (isReadingAloud) {
                    // Small delay to let animation complete
                    setTimeout(() => {
                        readCurrentPage();
                    }, 300);
                }
            }, 50);
        } else {
            // Fallback if page element isn't found
            currentPageIndex++;
            updateNavigationButtons();
        }
    }
}

// Text-to-speech functionality
function toggleReadAloud() {
    if (isReadingAloud) {
        stopReading();
    } else {
        startReading();
    }

    // Flipbook reading code removed
}

function startReading() {
    // Play a fun sound effect when starting to read
    playReadingStartSound();

    isReadingAloud = true;
    readAloudText.textContent = "Stop Reading";
    toggleReadAloudBtn.classList.add('active');

    // Show a friendly reading indicator
    showReadingIndicator();

    // Start reading after a short delay to allow the sound to play
    setTimeout(() => {
        readCurrentPage();
    }, 500);
}

function stopReading() {
    isReadingAloud = false;
    readAloudText.textContent = "Read To Me!";
    toggleReadAloudBtn.classList.remove('active');

    // Hide the reading indicator
    hideReadingIndicator();

    if (speechSynthesis) {
        speechSynthesis.cancel();
    }
}

// Play a fun sound effect when starting to read
function playReadingStartSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create oscillators for a magical sound
    const osc1 = audioContext.createOscillator();
    const osc2 = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
    osc1.frequency.linearRampToValueAtTime(783.99, audioContext.currentTime + 0.3); // G5

    osc2.frequency.setValueAtTime(659.25, audioContext.currentTime); // E5
    osc2.frequency.linearRampToValueAtTime(987.77, audioContext.currentTime + 0.3); // B5

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(audioContext.destination);

    osc1.start();
    osc2.start();
    osc1.stop(audioContext.currentTime + 0.5);
    osc2.stop(audioContext.currentTime + 0.5);
}

// Show a friendly reading indicator
function showReadingIndicator() {
    // Create or show reading indicator if it doesn't exist
    let readingIndicator = document.getElementById('reading-indicator');

    if (!readingIndicator) {
        readingIndicator = document.createElement('div');
        readingIndicator.id = 'reading-indicator';
        readingIndicator.innerHTML = `
            <div class="reading-icon">🧚</div>
            <div class="reading-waves">
                <span></span>
                <span></span>
                <span></span>
            </div>
        `;
        document.querySelector('.book-controls.top-controls').appendChild(readingIndicator);
    }

    readingIndicator.classList.add('active');
}

// Hide the reading indicator
function hideReadingIndicator() {
    const readingIndicator = document.getElementById('reading-indicator');
    if (readingIndicator) {
        readingIndicator.classList.remove('active');
    }
}

function readCurrentPage() {
    if (!speechSynthesis) return;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Get text content for current page
    let textToRead = "";

    if (currentPageIndex === 0) {
        // Cover page - read title with a friendly introduction
        textToRead = `Hello there! Let me read you a story called ${currentStory.title}. This story is perfect for children ages ${currentStory.age_range}. Let's begin our adventure!`;
    } else {
        // Regular page - read page text with some expression
        const pageIndex = currentPageIndex - 1;
        if (currentStory.pages[pageIndex]) {
            textToRead = currentStory.pages[pageIndex].text;
        }
    }

    if (textToRead) {
        speechUtterance = new SpeechSynthesisUtterance(textToRead);

        // Enhanced voice settings for a more natural, child-friendly female voice
        speechUtterance.rate = 0.85; // Slightly slower for better comprehension
        speechUtterance.pitch = 1.15; // Higher pitch for a more female sound
        speechUtterance.volume = 1.0; // Full volume

        // Check for user-selected voice first
        const userSelectedVoice = localStorage.getItem('preferredVoice');
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice = null;

        if (userSelectedVoice) {
            // Use the user's selected voice
            selectedVoice = voices.find(voice => voice.name === userSelectedVoice);
        }

        // If no user-selected voice or it's not available, fall back to prioritized list
        if (!selectedVoice) {
            // Priority list for female voices (in order of preference)
            const preferredVoices = [
                "Google UK English Female",
                "Microsoft Zira",
                "Samantha",
                "Victoria",
                "Google US English Female",
                "Microsoft Linda",
                "Karen",
                "Moira",
                "Fiona"
            ];

            // Try to find one of our preferred voices
            for (const voiceName of preferredVoices) {
                const foundVoice = voices.find(voice =>
                    voice.name === voiceName ||
                    voice.name.includes(voiceName)
                );

                if (foundVoice) {
                    selectedVoice = foundVoice;
                    break;
                }
            }

            // If none of our preferred voices are found, fall back to any female voice
            if (!selectedVoice) {
                selectedVoice = voices.find(voice =>
                    voice.name.includes("Female") ||
                    voice.name.toLowerCase().includes("girl") ||
                    voice.name.includes("woman") ||
                    voice.name.includes("female")
                );
            }
        }

        if (selectedVoice) {
            speechUtterance.voice = selectedVoice;
            console.log("Using voice: " + selectedVoice.name);
        }

        // Add a small pause between sentences for more natural reading
        textToRead = textToRead.replace(/\./g, '. <break time="500ms"/>');

        // Add end-of-reading event to continue to next page in auto mode
        speechUtterance.onend = function () {
            if (isReadingAloud && document.getElementById('auto-turn-pages')?.checked) {
                setTimeout(() => nextPage(), 1000);
            }
        };

        speechSynthesis.speak(speechUtterance);
    }
}

// Create placeholder image
function createPlaceholderImage() {
    // Create a placeholder image in case of image generation failure
    const img = new Image();
    img.onload = function () {
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 300;
        const ctx = canvas.getContext('2d');

        // Draw background
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, 400, 300);

        // Draw text
        ctx.fillStyle = '#999999';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Image unavailable', 200, 150);

        // Convert to blob and save
        canvas.toBlob(blob => {
            const placeholderUrl = URL.createObjectURL(blob);

            // Create the placeholder image in the static directory
            // Note: This can't actually save to disk from client-side JS
            // This would require backend support to save the placeholder
        });
    };
    img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
}

// Mobile touch events for page turning
document.addEventListener('DOMContentLoaded', () => {
    let touchStartX = 0;
    let touchEndX = 0;

    const book = document.getElementById('book');

    book.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    });

    book.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
    });

    function handleSwipe() {
        const swipeThreshold = 50;

        if (touchEndX < touchStartX - swipeThreshold) {
            // Swiped left - next page
            goToNextPage();
        } else if (touchEndX > touchStartX + swipeThreshold) {
            // Swiped right - previous page
            goToPreviousPage();
        }
    }
});
