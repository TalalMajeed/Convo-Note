import os
import json
import asyncio
import websockets
import logging
from openai import AsyncOpenAI
from dotenv import load_dotenv
import uvloop
from datetime import datetime
import uuid
import random

load_dotenv()
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
client = AsyncOpenAI(api_key=OPENAI_API_KEY)

logging.basicConfig(level=logging.INFO)

conversations = {}

class PatientConversation:
    def __init__(self, client_id):
        self.client_id = client_id
        self.data = {
            "name": "",
            "address": "",
            "problem": "",
            "description": "",
            "analysis": ""
        }
        self.conversation_history = []
        self.current_question = None
        
    def is_complete(self):
        # Strict checking of all fields
        return all(value.strip() != "" for field, value in self.data.items())

    def get_name_question(self):
        questions = [
            "Hi there! I'm Sarah. Could you please tell me your name?",
            "Hello! Before we begin, may I know your name?",
            "Welcome to our clinic. Who do I have the pleasure of speaking with today?",
            "Good day! Could you start by telling me your name, please?"
        ]
        return random.choice(questions)

    def get_address_question(self):
        name = self.data["name"].split()[0] if self.data["name"] else ""
        questions = [
            f"Thanks {name}! And what's your current address?",
            f"Where are you currently residing, {name}?",
            f"Could you share your home address with me, {name}?",
            f"What address should we have on file for you, {name}?"
        ]
        return random.choice(questions)

    def get_problem_question(self):
        name = self.data["name"].split()[0] if self.data["name"] else ""
        questions = [
            f"So {name}, what brings you in today?",
            f"What seems to be bothering you, {name}?",
            f"How can we help you today, {name}?",
            f"{name}, could you tell me what's been troubling you?",
            f"What's the main reason for your visit today, {name}?"
        ]
        return random.choice(questions)

    def get_description_question(self):
        name = self.data["name"].split()[0] if self.data["name"] else ""
        questions = [
            f"I see. And {name}, when did these symptoms first start?",
            f"Could you tell me more about that, {name}? Any other symptoms you've noticed?",
            f"{name}, have you noticed any patterns with these symptoms?",
            f"And how long has this been going on, {name}?",
            f"Can you describe the discomfort in more detail, {name}?"
        ]
        return random.choice(questions)

    def get_analysis_question(self):
        name = self.data["name"].split()[0] if self.data["name"] else ""
        questions = [
            f"Just a few more questions, {name}. Have you taken any medications for this?",
            f"{name}, is there any family history of similar issues?",
            f"Have you had anything like this before, {name}?",
            f"And {name}, does anything make it feel better or worse?",
            f"Last thing, {name} - how has this been affecting your daily activities?"
        ]
        return random.choice(questions)
    
    def get_next_question(self):
        for field, value in self.data.items():
            if value.strip() == "":
                if field == "name":
                    return self.get_name_question()
                elif field == "address":
                    return self.get_address_question()
                elif field == "problem":
                    return self.get_problem_question()
                elif field == "description":
                    return self.get_description_question()
                elif field == "analysis":
                    return self.get_analysis_question()
        return None

    def save_to_file(self):
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"patient_{self.client_id}_{timestamp}.json"
        data = {
            "patient_data": self.data,
            "conversation_history": self.conversation_history
        }
        with open(filename, 'w') as f:
            json.dump(data, f, indent=4)
        return filename

async def process_response(message, conversation):
    try:
        # Parse JSON input if it's in JSON format
        try:
            message_data = json.loads(message)
            if "transcript" in message_data:
                message = message_data["transcript"]
        except json.JSONDecodeError:
            # If not JSON, use the message as is
            pass

        current_field = ""
        for field, value in conversation.data.items():
            if value.strip() == "":
                current_field = field
                break

        system_prompt = f"""You are an AI medical assistant extracting patient information from a conversation.
        Currently collecting: {current_field}
        Previous information: {json.dumps(conversation.data)}
        
        Extract the relevant information from the patient's response for the {current_field} field.
        Return ONLY the extracted information, nothing else.
        For addresses, ensure you get a complete address.
        For problems, get the main health concern.
        For descriptions, get detailed symptoms and duration.
        For analysis, get relevant medical history and impact on daily life.
        If the information isn't clear or complete, return UNCLEAR."""

        response = await client.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ]
        )
        
        extracted_info = response.choices[0].message.content.strip()
        
        if extracted_info != "UNCLEAR":
            conversation.data[current_field] = extracted_info
            
        return extracted_info
            
    except Exception as e:
        logging.error(f"OpenAI API error: {e}")
        return None

async def handle_message(websocket):
    client_id = str(uuid.uuid4())
    logging.info(f"New client connected: {client_id}")
    conversations[client_id] = PatientConversation(client_id)
    
    try:
        conversation = conversations[client_id]
        next_question = conversation.get_next_question()
        await websocket.send(json.dumps({
            "response": next_question,
            "isComplete": False
        }))
        conversation.current_question = next_question
        
        while True:
            message = await websocket.recv()
            logging.info(f"Received from client {client_id}: {message}")
            
            # Store raw message in conversation history
            conversation.conversation_history.append({"user": message})
            
            extracted_info = await process_response(message, conversation)
            
            if extracted_info == "UNCLEAR":
                clarification_questions = [
                    "Could you please provide more details about that?",
                    "I need a bit more information. Could you elaborate?",
                    "Could you be more specific about that?",
                    "I need to get complete information. Could you tell me more?"
                ]
                await websocket.send(json.dumps({
                    "response": random.choice(clarification_questions),
                    "isComplete": False
                }))
                continue
            
            conversation.conversation_history.append({"assistant": extracted_info})
            
            # Double-check completion status
            if conversation.is_complete():
                name = conversation.data["name"].split()[0]
                closing_messages = [
                    f"Thank you {name}, I've got all the information I need.",
                    f"Thanks for your patience, {name}. The doctor will be with you shortly.",
                    f"All done, {name}! Someone will be with you in a moment.",
                    f"Thank you for providing all that information, {name}. Please take a seat in the waiting area."
                ]
                
                filename = conversation.save_to_file()
                logging.info(f"Conversation saved to {filename}")
                
                await websocket.send(json.dumps({
                    "response": random.choice(closing_messages),
                    "data": conversation.data,
                    "isComplete": True
                }))
                
                del conversations[client_id]
                return
            
            next_question = conversation.get_next_question()
            conversation.current_question = next_question
            
            await websocket.send(json.dumps({
                "response": next_question,
                "isComplete": False
            }))
            
    except websockets.exceptions.ConnectionClosed:
        logging.info(f"Client {client_id} disconnected")
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
    finally:
        if client_id in conversations:
            del conversations[client_id]
        logging.info(f"Connection closed for client {client_id}")

async def main():
    async with websockets.serve(handle_message, "0.0.0.0", 5000, max_size=2**20) as server:
        logging.info("WebSocket server running on ws://0.0.0.0:5000")
        await asyncio.Future()

if __name__ == "__main__":
    uvloop.install()
    asyncio.run(main())