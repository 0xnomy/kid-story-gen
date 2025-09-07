/**
 * React PageFlip Flipbook Implementation
 * This script implements a realistic book flipping effect using react-pageflip
 * Displays AI-generated stories with images in an interactive flipbook format
 */

// Create a React component for the flipbook
class FlipbookApp extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            pages: [],
            currentPage: 0,
            totalPages: 0,
            loading: false,
            bookSize: this.calculateBookSize()
        };

        this.flipbook = React.createRef();
        this.mediaQueryHandler = this.handleMediaQueryChange.bind(this);
    }

    componentDidMount() {
        // Listen for window resize events
        window.addEventListener('resize', this.handleWindowResize);

        // Add media query listeners
        this.setupMediaListeners();

        // Initialize with welcome pages
        this.initializeBook();

        // Expose the flipbook API to the global scope for external access
        window.flipbookAPI = {
            addStoryPages: this.addStoryPages.bind(this),
            nextPage: this.nextPage.bind(this),
            prevPage: this.prevPage.bind(this),
            getPageCount: () => this.state.pages.length
        };
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.handleWindowResize);
        this.cleanupMediaListeners();
    }

    setupMediaListeners() {
        this.desktopQuery = window.matchMedia("(min-width: 1200px)");
        this.tabletQuery = window.matchMedia("(min-width: 768px) and (max-width: 1199px)");
        this.mobileQuery = window.matchMedia("(max-width: 767px)");

        // Add listeners
        this.desktopQuery.addListener(this.mediaQueryHandler);
        this.tabletQuery.addListener(this.mediaQueryHandler);
        this.mobileQuery.addListener(this.mediaQueryHandler);
    }

    cleanupMediaListeners() {
        this.desktopQuery.removeListener(this.mediaQueryHandler);
        this.tabletQuery.removeListener(this.mediaQueryHandler);
        this.mobileQuery.removeListener(this.mediaQueryHandler);
    }

    handleMediaQueryChange() {
        this.setState({ bookSize: this.calculateBookSize() });
    }

    calculateBookSize() {
        const width = window.innerWidth;

        if (width >= 1200) {
            // Desktop layout
            return {
                width: 800,
                height: 600,
                size: 'large',
                mode: 'double'
            };
        } else if (width >= 768) {
            // Tablet layout
            return {
                width: Math.min(600, width * 0.8),
                height: 500,
                size: 'medium',
                mode: 'double'
            };
        } else {
            // Mobile layout
            return {
                width: Math.min(350, width * 0.9),
                height: 400,
                size: 'small',
                mode: 'single'
            };
        }
    }

    handleWindowResize = () => {
        this.setState({ bookSize: this.calculateBookSize() });
    }

    // Initialize the book with welcome pages
    initializeBook() {
        const welcomePages = [
            {
                content: {
                    title: "Welcome to StoryWonders",
                    text: "This is your magical storybook! Start by entering a story prompt to generate a wonderful tale with illustrations.\n\nTo read your story:\n\n• Flip through pages with the navigation buttons\n• Drag page corners for a realistic page turn effect\n\nYour journey into AI-generated storytelling begins here!",
                    image: null
                },
                pageNumber: 1
            },
            {
                content: {
                    title: "How It Works",
                    text: "Behind the scenes, this storybook is created by AI:\n\n🤖 A language model generates the story text\n\n🎨 An image model creates beautiful illustrations\n\n📖 Real-time page turning lets you read like a real book\n\nReady to create? Enter your prompt and make a magical story!",
                    image: null
                },
                pageNumber: 2
            }
        ];

        this.setState({
            pages: welcomePages,
            totalPages: welcomePages.length
        });
    }

    // Method to add story pages from AI-generated content
    addStoryPages(story) {
        // Format the story data into pages
        const storyPages = [];

        // Add cover page
        storyPages.push({
            content: {
                title: story.title,
                text: `A magical story for ages ${story.age_range}`,
                image: story.pages[0].image_url
            },
            pageNumber: 1,
            type: 'cover'
        });

        // Add story pages
        story.pages.forEach((page, index) => {
            storyPages.push({
                content: {
                    title: `Chapter ${index + 1}`,
                    text: page.text,
                    image: page.image_url
                },
                pageNumber: index + 2,
                type: 'page'
            });
        });

        // Add end page
        storyPages.push({
            content: {
                title: "The End!",
                text: "Thank you for reading this magical story! Would you like to create another wonderful tale?",
                image: null
            },
            pageNumber: storyPages.length + 1,
            type: 'end'
        });

        // Update state with new pages
        this.setState({
            pages: storyPages,
            totalPages: storyPages.length,
            currentPage: 0
        });

        // Reset flipbook to first page
        if (this.flipbook.current) {
            this.flipbook.current.pageFlip().turnToPage(0);
        }
    }

    // Navigation methods
    nextPage = () => {
        if (this.flipbook.current) {
            this.flipbook.current.pageFlip().flipNext();
        }
    }

    prevPage = () => {
        if (this.flipbook.current) {
            this.flipbook.current.pageFlip().flipPrev();
        }
    }

    // Handle page change events
    handlePageChange = (e) => {
        this.setState({
            currentPage: e.data
        });
    }

    // Render page content
    renderPage(page, index) {
        const { content, pageNumber, type } = page;

        // Determine if this is a hard cover
        const isHardCover = type === 'cover' || type === 'end';

        // Generate className based on page type
        const pageClassName = `flipbook-page ${isHardCover ? 'hard-cover' : ''}`;

        return (
            <div className={pageClassName} key={index}>
                <div className="page-content">
                    {content.title && <h2 className="page-header">{content.title}</h2>}

                    {content.image && (
                        <div className="page-image-container">
                            <img
                                src={content.image}
                                alt={content.title || `Page ${pageNumber}`}
                                className="page-image"
                            />
                        </div>
                    )}

                    <div className="page-text">
                        {content.text && content.text.split('\n').map((paragraph, i) => (
                            <p key={i}>{paragraph}</p>
                        ))}
                    </div>

                    <div className="page-number">— {pageNumber} —</div>
                </div>
            </div>
        );
    }

    render() {
        const { pages, currentPage, totalPages, bookSize } = this.state;

        const flipbookProps = {
            width: bookSize.width,
            height: bookSize.height,
            size: bookSize.size,
            minWidth: 200,
            maxWidth: 1000,
            minHeight: 300,
            maxHeight: 800,
            maxShadowOpacity: 0.5,
            showCover: true,
            mobileScrollSupport: true,
            onFlip: this.handlePageChange,
            className: "stf__parent", // Required class for StPageFlip
            style: { margin: "0 auto" },
            startPage: 0,
            drawShadow: true,
            flippingTime: 1000,
            usePortrait: bookSize.mode === 'single',
            startZIndex: 0,
            autoSize: false,
            clickEventForward: true,
            useMouseEvents: true,
            swipeDistance: 30,
            showPageCorners: true,
            disableFlipByClick: false
        };

        return (
            React.createElement(
                "div",
                { className: "flipbook-container" },
                [
                    React.createElement(
                        "div",
                        { className: "page-counter", key: "counter" },
                        `Page ${currentPage + 1} of ${totalPages}`
                    ),
                    React.createElement(
                        HTMLFlipBook,
                        {
                            ...flipbookProps,
                            ref: this.flipbook,
                            key: "flipbook"
                        },
                        pages.map((page, i) => this.renderPage(page, i))
                    ),
                    React.createElement(
                        "div",
                        { className: "flipbook-controls", key: "controls" },
                        [
                            React.createElement(
                                "button",
                                {
                                    onClick: this.prevPage,
                                    disabled: currentPage === 0,
                                    className: "flipbook-btn prev-btn",
                                    key: "prev"
                                },
                                "← Previous"
                            ),
                            React.createElement(
                                "button",
                                {
                                    onClick: this.nextPage,
                                    disabled: currentPage === totalPages - 1,
                                    className: "flipbook-btn next-btn",
                                    key: "next"
                                },
                                "Next →"
                            )
                        ]
                    )
                ]
            )
        );
    }
}

// Initialize React app when page is loaded
document.addEventListener('DOMContentLoaded', () => {
    const flipbookContainer = document.getElementById('react-flipbook-container');

    if (flipbookContainer) {
        // First check if React and ReactDOM are loaded
        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
            console.error('React or ReactDOM not loaded. Please include React and ReactDOM scripts.');
            return;
        }

        // Check if HTMLFlipBook component is loaded
        if (typeof HTMLFlipBook === 'undefined') {
            console.error('react-pageflip not loaded. Please include react-pageflip script.');
            return;
        }

        // Render the React app
        ReactDOM.render(
            React.createElement(FlipbookApp),
            flipbookContainer
        );
    }
});

// Listen for story data from the main application
document.addEventListener('storyGenerated', function (e) {
    if (window.flipbookAPI && e.detail) {
        window.flipbookAPI.addStoryPages(e.detail);
    }
});
