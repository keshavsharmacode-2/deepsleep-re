#!/usr/bin/env python3
"""Generate transparent animated robot walking GIF for README."""
from pathlib import Path
from PIL import Image

SRC = Path(__file__).parent.parent / "mascot" / "robot.png"
OUT = Path(__file__).parent.parent / "assets" / "robot-walk.gif"

ROBOT_H  = 180
FPS_DELAY = 55  # ms per frame

robot_src = Image.open(SRC).convert("RGBA")
ratio     = robot_src.width / robot_src.height
ROBOT_W   = int(ROBOT_H * ratio)

# Canvas just big enough for the robot + bubble above
CANVAS_W = ROBOT_W + 40
CANVAS_H = ROBOT_H + 70   # 70px head-room for speech bubble

# Wave keyframes: (angle_deg, dy)
WAVE = [
    (-3,  -2),
    ( 4, -10),
    (-4,  -2),
    ( 3, -10),
]

def robot_frame(angle: float, dy: int) -> Image.Image:
    r = robot_src.resize((ROBOT_W, ROBOT_H), Image.LANCZOS)
    r = r.rotate(angle, expand=False, resample=Image.BICUBIC)
    return r

TOTAL = 32
frames = []

for i in range(TOTAL):
    step = i % len(WAVE)
    angle, dy = WAVE[step]

    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

    rob = robot_frame(angle, dy)
    rx  = (CANVAS_W - ROBOT_W) // 2
    ry  = CANVAS_H - ROBOT_H + dy
    canvas.paste(rob, (rx, ry), rob)

    frames.append(canvas)

# Save as APNG (true transparency) — fallback: GIF with transparency
try:
    frames[0].save(
        OUT,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=FPS_DELAY,
    )
    print(f"Written {len(frames)} frames → {OUT}  ({OUT.stat().st_size // 1024} KB)")
except Exception as e:
    print(f"Error: {e}")
