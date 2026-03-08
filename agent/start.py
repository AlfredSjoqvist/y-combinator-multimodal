"""
Single startup script for Storybox.
Generates tokens (cached for reuse), prints URLs, and starts the agent.

Usage: python start.py
"""

import os
import sys
import json
import time
import subprocess
from datetime import timedelta
from dotenv import load_dotenv
from livekit.api import AccessToken, VideoGrants

load_dotenv()

TOKEN_CACHE = os.path.join(os.path.dirname(__file__), ".token_cache.json")
TOKEN_TTL = 12 * 3600  # 12 hours


def load_cached_tokens():
    """Load tokens from cache if they exist and aren't expired."""
    if not os.path.exists(TOKEN_CACHE):
        return None
    try:
        with open(TOKEN_CACHE) as f:
            cache = json.load(f)
        if time.time() - cache.get("created", 0) < TOKEN_TTL:
            return cache
    except Exception:
        pass
    return None


def generate_tokens():
    url = os.environ["LIVEKIT_URL"]
    api_key = os.environ["LIVEKIT_API_KEY"]
    api_secret = os.environ["LIVEKIT_API_SECRET"]

    def make_token(identity, name):
        return (
            AccessToken(api_key, api_secret)
            .with_identity(identity)
            .with_name(name)
            .with_ttl(timedelta(hours=24))
            .with_grants(VideoGrants(
                room_join=True,
                room="storybox",
                can_subscribe=True,
                can_publish=True,
                can_publish_data=True,
            ))
        ).to_jwt()

    display_token = make_token("storybox-display", "Storybox Display")
    phone_token = make_token("phone-user", "Phone User")
    test_token = make_token("test-display", "Test Display")

    cache = {
        "created": time.time(),
        "url": url,
        "display_token": display_token,
        "phone_token": phone_token,
        "test_token": test_token,
    }
    with open(TOKEN_CACHE, "w") as f:
        json.dump(cache, f)

    return cache


def main():
    # Reuse cached tokens if valid, otherwise generate new ones
    cache = load_cached_tokens()
    if cache:
        print("  Using cached tokens (still valid)")
    else:
        print("  Generating fresh tokens...")
        cache = generate_tokens()

    url = cache["url"]
    phone_token = cache["phone_token"]
    test_token = cache["test_token"]
    display_token = cache["display_token"]

    # Only write .env.local if it doesn't exist yet (manual edits preserved)
    env_path = os.path.join(os.path.dirname(__file__), "..", "storybox", ".env.local")
    if not os.path.exists(env_path):
        with open(env_path, "w") as f:
            f.write(f"VITE_LIVEKIT_URL={url}\n")
            f.write(f"VITE_LIVEKIT_TOKEN={display_token}\n")
            f.write(f"VITE_PHONE_TOKEN={phone_token}\n")
        print("  Wrote new .env.local")
    else:
        print("  .env.local already exists, not overwriting")

    print("\n" + "=" * 60)
    print("  STORYBOX - Ready to go!")
    print("=" * 60)

    meet_url = f"https://meet.livekit.io/custom?liveKitUrl={url}&token={phone_token}"
    print(f"\n  Phone camera URL (open on phone):")
    print(f"  {meet_url}")

    test_url = f"http://localhost:5174?livekit_url={url}&livekit_token={test_token}"
    print(f"\n  LiveKit test page (auto-connects):")
    print(f"  {test_url}")

    print(f"\n  Frontend: http://localhost:5173")
    print(f"  (tokens auto-loaded from .env.local)")

    print(f"\n  Tokens valid for 24h - same URLs work across agent restarts")
    print(f"\n  Starting agent...")
    print("=" * 60 + "\n")

    # Start the agent directly (not via cli.run_app which hides output on Windows)
    subprocess.run(
        [sys.executable, "-u", os.path.join(os.path.dirname(__file__), "agent_direct.py")],
        cwd=os.path.dirname(__file__),
    )


if __name__ == "__main__":
    main()
