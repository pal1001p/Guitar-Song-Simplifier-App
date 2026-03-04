from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from app.api import routes


app = FastAPI(title="Guitar Song Simplifier API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Configure this w/ front-end domain for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include router with all endpoints (including WebSocket)
app.include_router(routes.router, tags=["api"])

# Print registered routes on startup (for debugging)
print("\n" + "="*50)
print("Registered API Routes:")
print("="*50)
for route in app.routes:
    if hasattr(route, 'path'):
        route_type = "WebSocket" if hasattr(route, 'endpoint') and 'websocket' in str(type(route)).lower() else (route.methods if hasattr(route, 'methods') else 'Unknown')
        print(f"  {route_type}: {route.path}")
print("="*50 + "\n")

