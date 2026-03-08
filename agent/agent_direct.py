"""
Direct agent runner - bypasses cli.run_app subprocess spawning.
Use this if 'python agent.py dev' shows no output on Windows.

Usage: python agent_direct.py
"""

import asyncio
import json
import logging
import os
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.DEBUG, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("storybox-sage")

from livekit import rtc, api
from livekit.agents import Agent, AgentSession, JobContext, function_tool
from livekit.agents.voice.events import RunContext
from livekit.agents.voice.room_io import RoomOutputOptions, RoomInputOptions
from livekit.plugins import google
from google.genai import types as genai_types


SAGE_SYSTEM_PROMPT = """\
You are a chill creative companion helping someone plan a visual story. Talk like a friend, not a narrator.

RULES:
- Keep every reply to ONE short sentence. Like "Oh nice, sci-fi vibes?" or "Love that."
- React genuinely to what they say. Sound interested, not scripted.
- Ask a quick follow-up only if needed. Don't interrogate.
- NEVER list things. NEVER give long answers. Talk like texting but out loud.

YOUR JOB:
- They describe what kind of visual story they want
- You react, riff on it, maybe suggest a twist - keep it fun
- CRITICAL: After EVERY single exchange where the user speaks, you MUST call the update_story_summary tool.
  Build a running summary of their story concept: genre, mood, characters, setting, plot points, visual style.
  The summary should read like an image generation prompt with visual details, atmosphere, and story elements.
  Example: "A noir detective thriller set in rainy Tokyo at night. Dark moody streets, neon reflections, a lone figure in a trench coat."
  Each time, build on the previous summary - add new details, refine existing ones.
"""

_room_ref = None


async def send_command(command: dict):
    if not _room_ref:
        return
    try:
        data = json.dumps(command).encode("utf-8")
        await _room_ref.local_participant.publish_data(data, reliable=True)
        logger.info(f"Sent to frontend: {command}")
    except Exception as e:
        logger.error(f"Failed to send command: {e}")


class StoryboxSage(Agent):
    def __init__(self):
        super().__init__(instructions=SAGE_SYSTEM_PROMPT)

    @function_tool
    async def update_story_summary(self, ctx: RunContext, summary: str) -> str:
        """Update the story concept shown on the display screen. You MUST call this after every exchange.

        Args:
            summary: A descriptive summary of the story concept so far. Include visual details, atmosphere, style, characters, setting, and plot points.
        """
        logger.info(f">>> STORY SUMMARY UPDATE: {summary}")
        await send_command({"type": "wizard_status", "text": summary})
        return f"Summary updated: {summary}"


async def main():
    global _room_ref

    url = os.environ["LIVEKIT_URL"]
    api_key = os.environ["LIVEKIT_API_KEY"]
    api_secret = os.environ["LIVEKIT_API_SECRET"]

    logger.info(f"Connecting to {url} as agent...")

    # Generate agent token
    token = (
        api.AccessToken(api_key, api_secret)
        .with_identity("agent")
        .with_name("Storybox Agent")
        .with_kind("agent")
        .with_grants(api.VideoGrants(
            room_join=True,
            room="storybox",
            can_subscribe=True,
            can_publish=True,
            can_publish_data=True,
        ))
    ).to_jwt()

    # Connect directly to the room
    room = rtc.Room()
    _room_ref = room

    @room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"Participant connected: {participant.identity}")

    @room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        logger.info(f"Participant disconnected: {participant.identity}")

    @room.on("track_subscribed")
    def on_track_sub(track, pub, participant):
        logger.info(f"Track subscribed: kind={track.kind} from={participant.identity}")

    await room.connect(url, token)
    logger.info(f"Connected to room: {room.name}")
    logger.info(f"Local participant: {room.local_participant.identity}")

    for pid, p in room.remote_participants.items():
        logger.info(f"  Remote participant: {p.identity}")

    # Create Gemini model
    model = google.realtime.RealtimeModel(
        voice="Charon",
        instructions=SAGE_SYSTEM_PROMPT,
        enable_affective_dialog=True,
        input_audio_transcription=genai_types.AudioTranscriptionConfig(),
        output_audio_transcription=genai_types.AudioTranscriptionConfig(),
    )
    logger.info("Gemini Realtime model created")

    session = AgentSession(
        llm=model,
        allow_interruptions=True,
        min_endpointing_delay=0.3,
    )

    # Data messages from frontend
    @room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        try:
            msg = json.loads(data.data.decode("utf-8"))
            logger.info(f"Data from frontend: {msg}")
            if msg.get("type") == "say_hi":
                session.generate_reply(instructions="Say exactly: 'Tell me a story.' Nothing else.")
            elif msg.get("type") == "capture_taken":
                session.generate_reply(instructions="Say exactly: 'Alright, let the adventure begin!' with excitement.")
        except Exception as e:
            logger.error(f"Error handling data: {e}", exc_info=True)

    sage = StoryboxSage()
    logger.info("Starting agent session...")

    await session.start(
        room=room,
        agent=sage,
        room_input_options=RoomInputOptions(text_enabled=True, audio_enabled=True),
        room_output_options=RoomOutputOptions(
            transcription_enabled=True,
            audio_enabled=True,
            sync_transcription=False,
        ),
    )
    logger.info("=== Agent session started! ===")

    await send_command({"type": "wizard_status", "text": "The Sage is listening..."})
    session.generate_reply(instructions="Say exactly: 'Tell me a story.' Nothing else.")

    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        await room.disconnect()


if __name__ == "__main__":
    asyncio.run(main())
