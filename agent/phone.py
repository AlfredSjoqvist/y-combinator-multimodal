"""
Generate a token for the phone participant and print a URL to join.
Run: python phone.py
"""

import os
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants

load_dotenv()

def main():
    url = os.environ["LIVEKIT_URL"]
    api_key = os.environ["LIVEKIT_API_KEY"]
    api_secret = os.environ["LIVEKIT_API_SECRET"]

    token = (
        AccessToken(api_key, api_secret)
        .with_identity("phone-user")
        .with_name("Phone User")
        .with_grants(VideoGrants(
            room_join=True,
            room="storybox",
            can_subscribe=True,
            can_publish=True,
            can_publish_data=True,
        ))
    )

    jwt = token.to_jwt()

    # LiveKit's hosted meet app - works on any phone browser
    meet_url = f"https://meet.livekit.io/custom?liveKitUrl={url}&token={jwt}"

    print(f"\n=== PHONE JOIN LINK ===")
    print(f"\nOpen this URL on your phone:\n")
    print(meet_url)
    print(f"\n(Or use LiveKit Playground at https://cloud.livekit.io)")

if __name__ == "__main__":
    main()
