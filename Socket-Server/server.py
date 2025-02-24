import os
import json
import asyncio
import websockets
import logging
from openai import AsyncOpenAI
from dotenv import load_dotenv
import uvloop

# Load API key from .env file
load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize OpenAI client
client = AsyncOpenAI(api_key=OPENAI_API_KEY)

# Configure logging
logging.basicConfig(level=logging.INFO)

async def handle_message(websocket):  # Removed 'path' parameter as it's not needed
    logging.info("Client connected to WebSocket")
    try:
        while True:
            message = await websocket.recv()
            user_input = message.strip()
            logging.info(f"Received from client: {user_input}")
            
            try:
                response = await client.chat.completions.create(
                    model="gpt-4",
                    messages=[
                        {"role": "system", "content": "You are a helpful Doctor. Whatever input you get, ask a question from the patient to gather personal information. Do not answer more than one line. Answer in the shortest way possible."},
                        {"role": "user", "content": user_input},
                    ]
                )
                
                content = response.choices[0].message.content.strip()
                
                if content:
                    await websocket.send(json.dumps({
                        "response": content,
                        "isComplete": True
                    }))
            except Exception as e:
                logging.error(f"OpenAI API error: {e}")
                await websocket.send(json.dumps({
                    "error": "Error processing your request",
                    "details": str(e)
                }))
    
    except websockets.exceptions.ConnectionClosed:
        logging.info("Client disconnected")
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
    finally:
        logging.info("Connection closed")

async def main():
    async with websockets.serve(handle_message, "0.0.0.0", 5000, max_size=2**20) as server:
        logging.info("WebSocket server running on ws://0.0.0.0:5000")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    uvloop.install()
    asyncio.run(main())