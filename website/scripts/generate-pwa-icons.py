from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_DIR = ROOT / "public"


def lerp_color(left: tuple[int, int, int], right: tuple[int, int, int], t: float) -> tuple[int, int, int]:
    return tuple(
        int(round(left[index] + (right[index] - left[index]) * t))
        for index in range(3)
    )


def make_canvas(size: int, color: tuple[int, int, int]) -> list[list[list[int]]]:
    return [[[color[0], color[1], color[2]] for _ in range(size)] for _ in range(size)]


def set_pixel(canvas: list[list[list[int]]], x: int, y: int, color: tuple[int, int, int]) -> None:
    size = len(canvas)
    if 0 <= x < size and 0 <= y < size:
        canvas[y][x][0] = color[0]
        canvas[y][x][1] = color[1]
        canvas[y][x][2] = color[2]


def point_in_rounded_rect(x: float, y: float, left: float, top: float, width: float, height: float, radius: float) -> bool:
    right = left + width
    bottom = top + height

    if left + radius <= x <= right - radius or top + radius <= y <= bottom - radius:
        return left <= x <= right and top <= y <= bottom

    corner_x = left + radius if x < left + radius else right - radius
    corner_y = top + radius if y < top + radius else bottom - radius
    dx = x - corner_x
    dy = y - corner_y
    return dx * dx + dy * dy <= radius * radius


def draw_gradient_rounded_rect(
    canvas: list[list[list[int]]],
    left: float,
    top: float,
    width: float,
    height: float,
    radius: float,
    start: tuple[int, int, int],
    end: tuple[int, int, int],
) -> None:
    size = len(canvas)
    for y in range(size):
      for x in range(size):
            px = x + 0.5
            py = y + 0.5
            if not point_in_rounded_rect(px, py, left, top, width, height, radius):
                continue

            tx = (px - left) / width
            ty = (py - top) / height
            t = max(0.0, min(1.0, (tx + ty) / 2.0))
            set_pixel(canvas, x, y, lerp_color(start, end, t))


def draw_circle(
    canvas: list[list[list[int]]],
    cx: float,
    cy: float,
    radius: float,
    color: tuple[int, int, int],
) -> None:
    left = max(0, int(math.floor(cx - radius)))
    right = min(len(canvas) - 1, int(math.ceil(cx + radius)))
    top = max(0, int(math.floor(cy - radius)))
    bottom = min(len(canvas) - 1, int(math.ceil(cy + radius)))
    radius_sq = radius * radius

    for y in range(top, bottom + 1):
        for x in range(left, right + 1):
            dx = (x + 0.5) - cx
            dy = (y + 0.5) - cy
            if dx * dx + dy * dy <= radius_sq:
                set_pixel(canvas, x, y, color)


def cubic_point(
    p0: tuple[float, float],
    p1: tuple[float, float],
    p2: tuple[float, float],
    p3: tuple[float, float],
    t: float,
) -> tuple[float, float]:
    inv = 1.0 - t
    x = (
        inv * inv * inv * p0[0]
        + 3 * inv * inv * t * p1[0]
        + 3 * inv * t * t * p2[0]
        + t * t * t * p3[0]
    )
    y = (
        inv * inv * inv * p0[1]
        + 3 * inv * inv * t * p1[1]
        + 3 * inv * t * t * p2[1]
        + t * t * t * p3[1]
    )
    return x, y


def draw_stroked_curve(
    canvas: list[list[list[int]]],
    points: list[tuple[float, float]],
    stroke_width: float,
    color: tuple[int, int, int],
) -> None:
    if len(points) != 4:
        raise ValueError("Expected four cubic bezier control points")

    radius = stroke_width / 2.0
    for step in range(720):
        point = cubic_point(points[0], points[1], points[2], points[3], step / 719.0)
        draw_circle(canvas, point[0], point[1], radius, color)


def write_png(path: Path, canvas: list[list[list[int]]]) -> None:
    height = len(canvas)
    width = len(canvas[0])
    raw = bytearray()

    for row in canvas:
        raw.append(0)
        for pixel in row:
            raw.extend(pixel)

    compressed = zlib.compress(bytes(raw), level=9)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    png.extend(
        chunk(
            b"IHDR",
            struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0),
        )
    )
    png.extend(chunk(b"IDAT", compressed))
    png.extend(chunk(b"IEND", b""))
    path.write_bytes(png)


def generate_icon(
    path: Path,
    *,
    size: int,
    rounded_rect: tuple[float, float, float, float, float] | None,
    background_start: tuple[int, int, int],
    background_end: tuple[int, int, int],
    curve: tuple[list[tuple[float, float]], float] | None,
    circles: list[tuple[float, float, float, tuple[int, int, int]]],
) -> None:
    canvas = make_canvas(size, (8, 19, 17))

    if rounded_rect is None:
        draw_gradient_rounded_rect(
            canvas,
            0,
            0,
            size,
            size,
            size * 0.305,
            background_start,
            background_end,
        )
    else:
        left, top, width, height, radius = rounded_rect
        draw_gradient_rounded_rect(
            canvas,
            left,
            top,
            width,
            height,
            radius,
            background_start,
            background_end,
        )

    if curve is not None:
        points, stroke_width = curve
        draw_stroked_curve(canvas, points, stroke_width, (239, 252, 248))

    for cx, cy, radius, color in circles:
        draw_circle(canvas, cx, cy, radius, color)

    write_png(path, canvas)


def main() -> None:
    generate_icon(
        PUBLIC_DIR / "pwa-icon-512.png",
        size=512,
        rounded_rect=(48, 48, 416, 416, 132),
        background_start=(15, 118, 110),
        background_end=(42, 157, 143),
        curve=(
            [(126, 292), (184, 292), (206, 244), (414, 197)],
            34,
        ),
        circles=[
            (126, 292, 44, (248, 250, 252)),
            (270, 244, 37, (251, 191, 36)),
            (414, 197, 44, (251, 113, 133)),
        ],
    )

    generate_icon(
        PUBLIC_DIR / "pwa-maskable-512.png",
        size=512,
        rounded_rect=None,
        background_start=(15, 118, 110),
        background_end=(42, 157, 143),
        curve=(
            [(132, 292), (187, 292), (211, 246), (408, 198)],
            30,
        ),
        circles=[
            (132, 292, 40, (248, 250, 252)),
            (272, 246, 34, (251, 191, 36)),
            (408, 198, 40, (251, 113, 133)),
        ],
    )

    generate_icon(
        PUBLIC_DIR / "apple-touch-icon-180.png",
        size=180,
        rounded_rect=(17, 17, 146, 146, 46),
        background_start=(15, 118, 110),
        background_end=(42, 157, 143),
        curve=(
            [(44, 103), (65, 103), (73, 86), (146, 69)],
            12,
        ),
        circles=[
            (44, 103, 15, (248, 250, 252)),
            (95, 86, 13, (251, 191, 36)),
            (146, 69, 15, (251, 113, 133)),
        ],
    )


if __name__ == "__main__":
    main()
