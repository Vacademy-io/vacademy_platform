import sys
import asyncio
from fastapi.testclient import TestClient

# Add local directory to path to allow imports
sys.path.append(".")

from ai_service.app.app_factory import create_app

def test_chat_endpoint():
    print("Initializing app...")
    app = create_app()
    client = TestClient(app)
    
    # Define test payload
    payload = {
        "prompt": "What is normalization in databases?",
        "context": {
            "page_id": "page-1",
            "slide_id": "slide-1",
            "slide_content": "Normalization is the process of organizing data in a database."
        }
    }
    
    print(f"Sending request to /ai-service/chat/v1/ask with payload: {payload}")
    
    try:
        response = client.post("/ai-service/chat/v1/ask", json=payload)
        
        print(f"Response Status Code: {response.status_code}")
        if response.status_code == 200:
            print("Response Body:")
            print(response.json())
            print("\n✅ Verification SUCCESS")
        else:
            print(f"Failed to get successful response. Body: {response.text}")
            print("\n❌ Verification FAILED")
            
    except Exception as e:
        print(f"An error occurred: {e}")
        print("\n❌ Verification FAILED")

if __name__ == "__main__":
    test_chat_endpoint()
