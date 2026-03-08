"""
Storybox Sage Agent - LiveKit Voice Agent

A chill creative companion that helps users craft visual stories.
Uses Gemini Realtime API for voice. Sends story summaries to the React frontend.
"""

import json
import logging
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.agents.voice.events import RunContext
from livekit.agents.voice.room_io import RoomOutputOptions, RoomInputOptions
from livekit.plugins import google
from google.genai import types as genai_types

load_dotenv()
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("storybox-sage")
logger.setLevel(logging.DEBUG)


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


# Room reference for sending data messages
_room_ref = None
_session_ref = None


async def send_command(command: dict):
    """Send a JSON command to the frontend via LiveKit data channel."""
    if not _room_ref:
        logger.warning("No room ref - cannot send command")
        return
    try:
        data = json.dumps(command).encode("utf-8")
        await _room_ref.local_participant.publish_data(data, reliable=True)
        logger.info(f"Sent to frontend: {command}")
    except Exception as e:
        logger.error(f"Failed to send command: {e}")


class StoryboxSage(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions=SAGE_SYSTEM_PROMPT,
        )

    @function_tool
    async def update_story_summary(
        self,
        ctx: RunContext,
        summary: str,
    ) -> str:
        """Update the story concept shown on the display screen. You MUST call this after every exchange.

        Args:
            summary: A descriptive summary of the story concept so far. Include visual details, atmosphere, style, characters, setting, and plot points. Should read like an image generation prompt.
        """
        logger.info(f">>> STORY SUMMARY UPDATE: {summary}")
        await send_command({"type": "wizard_status", "text": summary})
        return f"Summary updated on screen: {summary}"


async def entrypoint(ctx: JobContext):
    global _room_ref, _session_ref
    logger.info("=== Agent entrypoint called ===")
    await ctx.connect()
    _room_ref = ctx.room
    logger.info(f"Connected to room: {ctx.room.name}")

    # Log existing participants
    for pid, p in ctx.room.remote_participants.items():
        logger.info(f"  Existing participant: {p.identity} (sid={pid})")
        for tid, pub in p.track_publications.items():
            logger.info(f"    Track: {pub.kind} subscribed={pub.subscribed}")

    # Gemini Realtime - handles voice recognition + speech synthesis + function calling
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
    _session_ref = session

    # Listen for data messages from the frontend
    @ctx.room.on("data_received")
    def on_data_received(data: rtc.DataPacket):
        try:
            msg = json.loads(data.data.decode("utf-8"))
            logger.info(f"Data from frontend: {msg}")

            if msg.get("type") == "say_hi":
                logger.info(">>> Generating greeting")
                session.generate_reply(
                    instructions="Say exactly: 'Tell me a story.' Nothing else."
                )
            elif msg.get("type") == "capture_taken":
                logger.info(">>> Photo captured, generating adventure start")
                session.generate_reply(
                    instructions="Say exactly: 'Alright, let the adventure begin!' with excitement. Nothing else."
                )
        except Exception as e:
            logger.error(f"Error handling data: {e}", exc_info=True)

    # Debug: log track events
    @ctx.room.on("track_subscribed")
    def on_track_sub(track, pub, participant):
        logger.info(f"Track subscribed: kind={track.kind} from={participant.identity}")

    @ctx.room.on("track_unsubscribed")
    def on_track_unsub(track, pub, participant):
        logger.info(f"Track unsubscribed: kind={track.kind} from={participant.identity}")

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"Participant connected: {participant.identity}")

    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant):
        logger.info(f"Participant disconnected: {participant.identity}")

    sage = StoryboxSage()
    logger.info("Starting agent session...")

    await session.start(
        room=ctx.room,
        agent=sage,
        room_input_options=RoomInputOptions(
            text_enabled=True,
            audio_enabled=True,
        ),
        room_output_options=RoomOutputOptions(
            transcription_enabled=True,
            audio_enabled=True,
            sync_transcription=False,
        ),
    )
    logger.info("=== Agent session started! ===")

    # Send initial status
    await send_command({"type": "wizard_status", "text": "The Sage is listening..."})

    # Auto-greet
    session.generate_reply(
        instructions="Say exactly: 'Tell me a story.' Nothing else."
    )


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
