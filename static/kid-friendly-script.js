// Additional kid-friendly interactive animations
document.addEventListener('DOMContentLoaded', () => {
    // Add character parade auto-rotation
    const characterParade = document.querySelector('.character-parade');
    if (characterParade) {
        setInterval(() => {
            const characters = characterParade.querySelectorAll('.bouncing-character');
            const firstChar = characters[0].textContent;

            for (let i = 0; i < characters.length - 1; i++) {
                characters[i].textContent = characters[i + 1].textContent;
            }

            characters[characters.length - 1].textContent = firstChar;
        }, 5000);
    }

    // Add floating emojis when buttons are clicked
    function createFloatingEmoji(emoji, x, y) {
        const element = document.createElement('div');
        element.className = 'floating-emoji';
        element.textContent = emoji;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        document.body.appendChild(element);

        setTimeout(() => {
            element.remove();
        }, 2000);
    }

    // Random emoji for page turns
    const emojiList = ['✨', '🎉', '🌟', '🚀', '🦄', '🎈', '🐶', '🦁', '🐼', '🦊'];

    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', (e) => {
            const emoji = emojiList[Math.floor(Math.random() * emojiList.length)];
            createFloatingEmoji(emoji, e.clientX, e.clientY);
        });
    });

    // Make the book wiggle when hovering over it
    const bookElement = document.getElementById('book');
    if (bookElement) {
        bookElement.addEventListener('mouseenter', () => {
            bookElement.classList.add('wiggle-effect');
        });

        bookElement.addEventListener('mouseleave', () => {
            bookElement.classList.remove('wiggle-effect');
        });
    }

    // Add help tooltip on first visit
    if (!localStorage.getItem('storyWondersVisited')) {
        const helpBubble = document.createElement('div');
        helpBubble.className = 'help-bubble';
        helpBubble.innerHTML = `
            <div class="help-content">
                <div class="help-header">
                    <span class="help-title">Welcome to StoryWonders! 🎉</span>
                    <span class="close-help">✖</span>
                </div>
                <div class="help-body">
                    <p>Click the buttons to turn pages! 📚</p>
                    <p>Make your own story by typing an idea! 🦄</p>
                </div>
            </div>
        `;

        document.body.appendChild(helpBubble);

        helpBubble.querySelector('.close-help').addEventListener('click', () => {
            helpBubble.classList.add('fade-out');
            setTimeout(() => {
                helpBubble.remove();
            }, 500);
            localStorage.setItem('storyWondersVisited', 'true');
        });

        setTimeout(() => {
            helpBubble.classList.add('fade-out');
            setTimeout(() => {
                helpBubble.remove();
            }, 500);
        }, 8000);
    }

    // Make try again button functional
    const tryAgainBtn = document.querySelector('.try-again-btn');
    if (tryAgainBtn) {
        tryAgainBtn.addEventListener('click', () => {
            document.getElementById('error-message').classList.add('hidden');
        });
    }

    // Add custom cursor for kids
    const cursor = document.createElement('div');
    cursor.className = 'kid-cursor';
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
        cursor.style.left = `${e.clientX}px`;
        cursor.style.top = `${e.clientY}px`;
    });
});
