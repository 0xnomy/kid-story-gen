/**
 * Fairy tale voice effect for text-to-speech
 * This script enhances the speech synthesis to add a gentle fairy tale 
 * tone and better expression to the read-aloud feature
 */

document.addEventListener('DOMContentLoaded', () => {
    // Enhanced text preprocessing for better voice quality
    window.enhanceStoryText = function (text) {
        if (!text) return text;

        // Add slight pauses after punctuation for more natural reading
        text = text.replace(/\./g, '.<break time="400ms"/>');
        text = text.replace(/\!/g, '!<break time="500ms"/>');
        text = text.replace(/\?/g, '?<break time="500ms"/>');
        text = text.replace(/\,/g, ',<break time="200ms"/>');

        // Add emphasis to common fairy tale phrases
        text = text.replace(/Once upon a time/gi, '<emphasis level="moderate">Once upon a time</emphasis>');
        text = text.replace(/happily ever after/gi, '<emphasis level="moderate">happily ever after</emphasis>');
        text = text.replace(/the end/gi, '<emphasis level="strong">the end</emphasis>');

        // Add pitch changes for character dialogue
        const dialogueRegex = /"([^"]+)"/g;
        text = text.replace(dialogueRegex, (match, dialogue) => {
            return `<prosody pitch="+15%" rate="95%">"${dialogue}"</prosody>`;
        });

        // Add expression for emotions
        text = text.replace(/excited|happy|joyful/gi, match => `<prosody rate="110%" pitch="+10%">${match}</prosody>`);
        text = text.replace(/sad|unhappy|lonely/gi, match => `<prosody rate="90%" pitch="-10%">${match}</prosody>`);
        text = text.replace(/afraid|scared|frightened/gi, match => `<prosody rate="120%" pitch="+15%">${match}</prosody>`);

        return text;
    };

    // Add sound effects for certain story elements
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();

    window.playMagicSound = function () {
        // Create magical sound effect
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.5);

        gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 1);

        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);

        osc.start();
        osc.stop(audioContext.currentTime + 1);
    };

    // Observe DOM changes to detect when story pages are updated
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1 && node.classList?.contains('page')) {
                        // New page added, play magic sound
                        if (document.getElementById('sound-effects-enabled')?.checked) {
                            window.playMagicSound();
                        }
                    }
                }
            }
        }
    });

    // Start observing the book element
    const book = document.getElementById('book');
    if (book) {
        observer.observe(book, { childList: true, subtree: true });
    }

    // Add voice settings panel to allow fine-tuning
    function createVoiceSettingsPanel() {
        const settingsPanel = document.createElement('div');
        settingsPanel.className = 'voice-settings-panel';
        settingsPanel.innerHTML = `
            <button class="voice-settings-toggle">
                <span class="settings-icon">⚙️</span>
            </button>
            <div class="voice-settings-content">
                <h4>Voice Settings</h4>
                <div class="setting-group">
                    <label for="voice-pitch">Pitch</label>
                    <input type="range" id="voice-pitch" min="0.5" max="1.5" step="0.1" value="1.15">
                </div>
                <div class="setting-group">
                    <label for="voice-rate">Speed</label>
                    <input type="range" id="voice-rate" min="0.6" max="1.2" step="0.05" value="0.85">
                </div>
                <div class="setting-group">
                    <input type="checkbox" id="sound-effects-enabled" checked>
                    <label for="sound-effects-enabled">Sound effects</label>
                </div>
                <div class="setting-group">
                    <input type="checkbox" id="enhanced-expression" checked>
                    <label for="enhanced-expression">Enhanced expression</label>
                </div>
            </div>
        `;

        // Add to page
        document.querySelector('.story-viewer')?.appendChild(settingsPanel);

        // Toggle settings panel
        const toggleBtn = settingsPanel.querySelector('.voice-settings-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                settingsPanel.classList.toggle('open');
            });
        }

        // Save settings when changed
        settingsPanel.querySelectorAll('input').forEach(input => {
            input.addEventListener('change', () => {
                const settings = {
                    pitch: parseFloat(document.getElementById('voice-pitch').value),
                    rate: parseFloat(document.getElementById('voice-rate').value),
                    soundEffects: document.getElementById('sound-effects-enabled').checked,
                    enhancedExpression: document.getElementById('enhanced-expression').checked
                };

                localStorage.setItem('voiceSettings', JSON.stringify(settings));

                // If currently reading, restart with new settings
                if (window.isReadingAloud) {
                    window.stopReading();
                    window.startReading();
                }
            });
        });

        // Load saved settings
        const savedSettings = JSON.parse(localStorage.getItem('voiceSettings') || '{}');
        if (savedSettings.pitch) document.getElementById('voice-pitch').value = savedSettings.pitch;
        if (savedSettings.rate) document.getElementById('voice-rate').value = savedSettings.rate;
        if (savedSettings.soundEffects !== undefined) document.getElementById('sound-effects-enabled').checked = savedSettings.soundEffects;
        if (savedSettings.enhancedExpression !== undefined) document.getElementById('enhanced-expression').checked = savedSettings.enhancedExpression;
    }

    // Create settings panel when story viewer is shown
    const storyViewer = document.getElementById('story-viewer');
    if (storyViewer) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'attributes' &&
                    mutation.attributeName === 'class' &&
                    !storyViewer.classList.contains('hidden') &&
                    !document.querySelector('.voice-settings-panel')) {
                    createVoiceSettingsPanel();
                }
            }
        });

        observer.observe(storyViewer, { attributes: true });
    }

    // Override the readCurrentPage function to use our enhanced text processing
    const originalReadCurrentPageFn = window.readCurrentPage;
    if (originalReadCurrentPageFn) {
        window.readCurrentPage = function () {
            if (!speechSynthesis) return;

            // Cancel any ongoing speech
            speechSynthesis.cancel();

            // Get text content for current page
            let textToRead = "";

            if (window.currentPageIndex === 0) {
                // Cover page - read title with a friendly introduction
                textToRead = `Hello there! Let me read you a story called ${window.currentStory.title}. This story is perfect for children ages ${window.currentStory.age_range}. Let's begin our adventure!`;
            } else {
                // Regular page - read page text
                const pageIndex = window.currentPageIndex - 1;
                if (window.currentStory.pages[pageIndex]) {
                    textToRead = window.currentStory.pages[pageIndex].text;
                }
            }

            if (textToRead) {
                // Check if enhanced expression is enabled
                const settings = JSON.parse(localStorage.getItem('voiceSettings') || '{}');
                if (settings.enhancedExpression !== false) {
                    textToRead = window.enhanceStoryText(textToRead);
                }

                const speechUtterance = new SpeechSynthesisUtterance(textToRead);

                // Apply voice settings
                speechUtterance.rate = settings.rate || 0.85;
                speechUtterance.pitch = settings.pitch || 1.15;
                speechUtterance.volume = 1.0;

                // Use user-selected voice or find best female voice
                const userSelectedVoice = localStorage.getItem('preferredVoice');
                const voices = window.speechSynthesis.getVoices();
                let selectedVoice = null;

                if (userSelectedVoice) {
                    selectedVoice = voices.find(voice => voice.name === userSelectedVoice);
                }

                if (!selectedVoice) {
                    // Priority list for female voices
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

                // Add end-of-reading event to continue to next page in auto mode
                speechUtterance.onend = function () {
                    if (window.isReadingAloud && document.getElementById('auto-turn-pages')?.checked) {
                        setTimeout(() => window.nextPage(), 1000);
                    }
                };

                window.speechUtterance = speechUtterance;
                window.speechSynthesis.speak(speechUtterance);
            }
        };
    }
});
