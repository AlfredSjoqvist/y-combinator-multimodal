"""
Generate a LiveKit access token for the frontend participant.
Run: python get_token.py

Prints the token and the LiveKit URL so you can paste them into the frontend.
"""

import os
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants

load_dotenv()

def main():
    url = os.environ["LIVEKIT_URL"]
    api_key = os.environ["LIVEKIT_API_KEY"]
    api_secret = os.environ["LIVEKIT_API_SECRET"]

    # Token for the frontend display - needs can_publish for microphone audio
    token = (
        AccessToken(api_key, api_secret)
        .with_identity("storybox-display")
        .with_name("Storybox Display")
        .with_grants(VideoGrants(
            room_join=True,
            room="storybox",
            can_subscribe=True,
            can_publish=True,
            can_publish_data=True,
        ))
    )

    jwt = token.to_jwt()
    print(f"\nLIVEKIT_URL={url}")
    print(f"LIVEKIT_TOKEN={jwt}")
    print(f"\nPaste these into your browser console or .env")
    print(f"\nFrontend URL: http://localhost:5173?livekit_url={url}&livekit_token={jwt}")

if __name__ == "__main__":
    main()
