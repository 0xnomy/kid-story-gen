// Book Interaction JavaScript
document.addEventListener('DOMContentLoaded', function () {
    // Variables to track book state
    let currentPage = 0;
    let totalPages = 0;
    let isAnimating = false;
    let touchStartX = 0;
    let touchEndX = 0;
    const minSwipeDistance = 50; // Minimum distance for a swipe to register

    // Initialize the book
    function initializeBook() {
        // Calculate total pages
        const pages = document.querySelectorAll('.page');
        totalPages = pages.length;

        // Set initial state
        updatePageState();

        // Setup event listeners for page turning
        setupEventListeners();

        // Set initial focus for keyboard navigation
        document.querySelector('.book').setAttribute('tabindex', '0');
    }

    // Set up event listeners
    function setupEventListeners() {
        // Left edge click (previous page)
        const leftTurnAreas = document.querySelectorAll('.left-turn');
        leftTurnAreas.forEach(area => {
            area.addEventListener('click', goToPreviousPage);
        });

        // Right edge click (next page)
        const rightTurnAreas = document.querySelectorAll('.right-turn');
        rightTurnAreas.forEach(area => {
            area.addEventListener('click', goToNextPage);
        });

        // Keyboard navigation
        document.addEventListener('keydown', handleKeyDown);

        // Touch events for mobile
        setupTouchEvents();

        // Handle preload completion
        window.addEventListener('load', () => {
            document.querySelector('.book-container').classList.add('loaded');
        });
    }

    // Handle keyboard navigation
    function handleKeyDown(e) {
        if (isAnimating) return;

        switch (e.key) {
            case 'ArrowLeft':
                goToPreviousPage();
                break;
            case 'ArrowRight':
                goToNextPage();
                break;
        }
    }

    // Touch event setup
    function setupTouchEvents() {
        const book = document.querySelector('.book');

        book.addEventListener('touchstart', function (e) {
            touchStartX = e.changedTouches[0].screenX;
        }, { passive: true });

        book.addEventListener('touchend', function (e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, { passive: true });
    }

    // Handle swipe gestures
    function handleSwipe() {
        const swipeDistance = touchEndX - touchStartX;

        if (Math.abs(swipeDistance) > minSwipeDistance) {
            if (swipeDistance > 0) {
                goToPreviousPage(); // Right swipe (previous page)
            } else {
                goToNextPage(); // Left swipe (next page)
            }
        }
    }

    // Go to previous page
    function goToPreviousPage() {
        if (isAnimating || currentPage <= 0) return;

        isAnimating = true;
        currentPage--;

        // Get current page element and remove flipped class
        const pageToUnflip = document.querySelector(`.page[data-page="${currentPage}"]`);
        pageToUnflip.classList.add('returning');

        setTimeout(() => {
            pageToUnflip.classList.remove('flipped', 'returning');
            isAnimating = false;
            updatePageState();
        }, 600); // Match CSS transition duration
    }

    // Go to next page
    function goToNextPage() {
        if (isAnimating || currentPage >= totalPages - 1) return;

        isAnimating = true;

        // Get current page element and add flipped class
        const pageToFlip = document.querySelector(`.page[data-page="${currentPage}"]`);
        pageToFlip.classList.add('turning');

        setTimeout(() => {
            pageToFlip.classList.add('flipped');
            pageToFlip.classList.remove('turning');
            currentPage++;
            isAnimating = false;
            updatePageState();
        }, 600); // Match CSS transition duration
    }

    // Update page state and UI elements
    function updatePageState() {
        // Update book positioning based on current page
        adjustBookPosition();

        // Update accessibility attributes
        updateAccessibility();

        // Update any page indicators if they exist
        updatePageIndicators();
    }

    // Adjust the book position to show the open spread properly
    function adjustBookPosition() {
        const book = document.querySelector('.book');
        const rotationDegree = Math.min(currentPage * 2, 10); // Limit rotation

        // Rotate book slightly as pages turn
        book.style.transform = `rotateY(${rotationDegree}deg)`;
    }

    // Update accessibility attributes
    function updateAccessibility() {
        const pages = document.querySelectorAll('.page');

        pages.forEach((page, index) => {
            const isCurrentPage = index === currentPage;
            const isFlipped = index < currentPage;

            // Set aria attributes for accessibility
            page.setAttribute('aria-hidden', isFlipped ? 'true' : 'false');

            if (isCurrentPage) {
                page.setAttribute('tabindex', '0');
            } else {
                page.setAttribute('tabindex', '-1');
            }
        });

        // Announce page changes for screen readers
        const liveRegion = document.getElementById('book-live-region');
        if (liveRegion) {
            liveRegion.textContent = `Page ${currentPage + 1} of ${totalPages}`;
        }
    }

    // Update page indicators if they exist
    function updatePageIndicators() {
        const pageIndicator = document.getElementById('page-indicator');
        if (pageIndicator) {
            pageIndicator.textContent = `${currentPage + 1} / ${totalPages}`;
        }
    }

    // Connect with story generation
    function generateStoryAndPopulateBook() {
        const form = document.getElementById('story-form');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            const generateButton = document.querySelector('.generate-button');
            const loadingIndicator = document.getElementById('loading-indicator');

            try {
                // Show loading state
                generateButton.disabled = true;
                loadingIndicator.style.display = 'flex';

                // Get form data
                const formData = new FormData(form);
                const storyTitle = formData.get('storyTitle');
                const characterName = formData.get('characterName');
                const storyTheme = formData.get('storyTheme');
                const ageRange = formData.get('ageRange');

                // Send request to backend
                const response = await fetch('/generate', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        storyTitle,
                        characterName,
                        storyTheme,
                        ageRange
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to generate story');
                }

                const data = await response.json();

                // Hide the form and show the book
                document.getElementById('story-generator-container').style.display = 'none';
                document.getElementById('book-container').style.display = 'block';

                // Populate book with story data
                populateBook(data);

                // Reset to first page and initialize book
                currentPage = 0;
                initializeBook();

            } catch (error) {
                console.error('Error generating story:', error);
                alert('Error generating story. Please try again.');
            } finally {
                // Reset UI state
                generateButton.disabled = false;
                loadingIndicator.style.display = 'none';
            }
        });
    }

    // Populate book with story content
    function populateBook(storyData) {
        const book = document.querySelector('.book');
        const pages = storyData.pages;

        // Create front cover
        const frontCover = document.createElement('div');
        frontCover.className = 'page front-cover cover-page';
        frontCover.setAttribute('data-page', '0');

        frontCover.innerHTML = `
            <div class="page-content">
                <h1>${storyData.title}</h1>
                <div class="cover-image-container">
                    <div class="cover-image" style="background-image: url('${pages[0].image}')"></div>
                </div>
                <div class="age-range">For ages ${storyData.ageRange}</div>
            </div>
        `;

        book.appendChild(frontCover);

        // Create story pages
        for (let i = 0; i < pages.length; i++) {
            const page = document.createElement('div');
            page.className = 'page';
            page.setAttribute('data-page', i + 1);

            page.innerHTML = `
                <div class="page-content">
                    <div class="page-text">
                        <p>${pages[i].text}</p>
                    </div>
                    <div class="page-image">
                        <img src="${pages[i].image}" alt="Illustration for page ${i + 1}">
                    </div>
                </div>
            `;

            book.appendChild(page);
        }

        // Create back cover
        const backCover = document.createElement('div');
        backCover.className = 'page back-cover';
        backCover.setAttribute('data-page', pages.length + 1);

        backCover.innerHTML = `
            <div class="back-cover-content">
                <h2>The End</h2>
                <p>Created with AI story generation</p>
                <button id="create-new-story" class="button">Create New Story</button>
            </div>
        `;

        book.appendChild(backCover);

        // Add event listener for new story button
        document.getElementById('create-new-story').addEventListener('click', function () {
            // Reset the form
            document.getElementById('story-form').reset();

            // Show the form and hide the book
            document.getElementById('story-generator-container').style.display = 'block';
            document.getElementById('book-container').style.display = 'none';

            // Clear the book
            book.innerHTML = '';
        });
    }

    // Initialize the page
    if (document.querySelector('.book')) {
        initializeBook();
    }

    // Setup story generation if form exists
    generateStoryAndPopulateBook();
});
