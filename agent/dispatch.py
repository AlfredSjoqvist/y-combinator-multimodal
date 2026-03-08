"""
Explicitly dispatch the agent to join the 'storybox' room.
Run this after the agent is registered and participants are in the room.

Usage: python dispatch.py
"""

import os
from dotenv import load_dotenv
from livekit.api import LiveKitAPI, CreateAgentDispatchRequest

load_dotenv()

async def main():
    api = LiveKitAPI(
        url=os.environ["LIVEKIT_URL"],
        api_key=os.environ["LIVEKIT_API_KEY"],
        api_secret=os.environ["LIVEKIT_API_SECRET"],
    )

    dispatch = await api.agent_dispatch.create_dispatch(
        CreateAgentDispatchRequest(room="storybox", agent_name="")
    )
    print(f"Dispatched agent to room 'storybox': {dispatch}")
    await api.aclose()

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
