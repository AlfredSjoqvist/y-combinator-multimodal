"""
Quick diagnostic to verify LiveKit + Gemini setup works.
Run: python diagnose.py
"""

import os
import asyncio
from dotenv import load_dotenv

load_dotenv()


def check_env():
    required = ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GOOGLE_API_KEY"]
    ok = True
    for key in required:
        val = os.environ.get(key, "")
        if val:
            print(f"  OK  {key} = {val[:20]}...")
        else:
            print(f"  MISSING  {key}")
            ok = False
    return ok


async def check_livekit():
    from livekit.api import LiveKitAPI
    api = LiveKitAPI()
    try:
        rooms = await api.room.list_rooms()
        print(f"  OK  LiveKit API connected. {len(rooms)} room(s):")
        for r in rooms:
            print(f"       - {r.name} ({r.num_participants} participants)")
        await api.aclose()
        return True
    except Exception as e:
        print(f"  FAIL  LiveKit API: {e}")
        await api.aclose()
        return False


def check_gemini():
    try:
        from google import genai
        client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY"))
        # Just verify the client can be created
        print(f"  OK  Gemini client created")
        return True
    except Exception as e:
        print(f"  FAIL  Gemini: {e}")
        return False


def check_packages():
    packages = [
        "livekit",
        "livekit.agents",
        "livekit.plugins.google",
    ]
    ok = True
    for pkg in packages:
        try:
            mod = __import__(pkg)
            ver = getattr(mod, "__version__", "?")
            print(f"  OK  {pkg} (v{ver})")
        except ImportError as e:
            print(f"  MISSING  {pkg}: {e}")
            ok = False
    return ok


async def main():
    print("\n=== Storybox Agent Diagnostics ===\n")

    print("1. Environment variables:")
    env_ok = check_env()

    print("\n2. Python packages:")
    pkg_ok = check_packages()

    print("\n3. Gemini API:")
    gem_ok = check_gemini()

    print("\n4. LiveKit API:")
    lk_ok = await check_livekit()

    print("\n" + "=" * 40)
    if all([env_ok, pkg_ok, gem_ok, lk_ok]):
        print("All checks passed! Agent should work.")
        print("\nRun: python start.py")
    else:
        print("Some checks failed. Fix the issues above.")
    print("=" * 40 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
