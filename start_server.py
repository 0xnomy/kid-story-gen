import uvicorn
import os

if __name__ == "__main__":
    print("🚀 Starting Story Generator Server...")
    print("📍 Server will be available at: http://localhost:8000")
    print("📁 Static files served from: http://localhost:8000/static/")
    print("📖 Main interface: http://localhost:8000/static/index.html")
    print()
    
    # Change to the app directory
    os.chdir("d:/Internship/kid-story-gen")
    
    # Start the server
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
