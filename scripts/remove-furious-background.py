from pathlib import Path

from rembg import new_session, remove

DIRECTORY = Path(__file__).resolve().parents[1] / "public" / "skins" / "furious"
session = new_session("u2net")

for path in sorted(DIRECTORY.glob("*.png")):
    source = path.read_bytes()
    result = remove(
        source,
        session=session,
        alpha_matting=True,
        alpha_matting_foreground_threshold=240,
        alpha_matting_background_threshold=10,
        alpha_matting_erode_size=3,
    )
    path.write_bytes(result)
    print(f"Processed {path.name}")
