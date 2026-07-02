#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { deflateSync } from "node:zlib";

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "build");
const ICON_PATH = path.join(OUTPUT_DIR, "app-icon.ico");
const PREVIEW_PATH = path.join(OUTPUT_DIR, "app-icon-256.png");
const ICON_SIZES = [16, 24, 32, 48, 64, 128, 256];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function setPixel(pixels, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) {
    return;
  }

  const index = (y * size + x) * 4;
  pixels[index] = color[0];
  pixels[index + 1] = color[1];
  pixels[index + 2] = color[2];
  pixels[index + 3] = color[3];
}

function distanceToSegment(x, y, startX, startY, endX, endY) {
  const dx = endX - startX;
  const dy = endY - startY;
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / lengthSquared));
  const projectedX = startX + t * dx;
  const projectedY = startY + t * dy;
  return Math.hypot(x - projectedX, y - projectedY);
}

function scaledPoint(size, x, y) {
  return [(x / 64) * size, (y / 64) * size];
}

function drawStroke(pixels, size, points, width, color) {
  const radius = width / 2;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const nearPoint = points.some(
        ([pointX, pointY]) => Math.hypot(px - pointX, py - pointY) <= radius
      );
      const nearSegment = points.slice(0, -1).some((point, index) => {
        const next = points[index + 1];
        return distanceToSegment(px, py, point[0], point[1], next[0], next[1]) <= radius;
      });

      if (nearPoint || nearSegment) {
        setPixel(pixels, size, x, y, color);
      }
    }
  }
}

function drawCircle(pixels, size, centerX, centerY, radius, fill, stroke, strokeWidth = 0) {
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY);
      if (distance <= radius) {
        setPixel(pixels, size, x, y, fill);
      }
      if (stroke && distance >= radius - strokeWidth && distance <= radius) {
        setPixel(pixels, size, x, y, stroke);
      }
    }
  }
}

function createBrandIconPngBuffer(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const blue = [37, 99, 235, 255];
  const teal = [6, 182, 212, 255];
  const white = [255, 255, 255, 255];
  const ink = [17, 24, 39, 255];
  const strokeWide = Math.max(2, size * 0.078);
  const strokeMid = Math.max(2, size * 0.07);

  drawStroke(
    pixels,
    size,
    [scaledPoint(size, 43, 8), scaledPoint(size, 55, 15), scaledPoint(size, 55, 26)],
    strokeWide,
    teal
  );
  drawStroke(
    pixels,
    size,
    [
      scaledPoint(size, 43, 56),
      scaledPoint(size, 22, 56),
      scaledPoint(size, 8, 48),
      scaledPoint(size, 8, 16),
      scaledPoint(size, 22, 8),
      scaledPoint(size, 43, 8)
    ],
    strokeWide,
    blue
  );
  drawStroke(
    pixels,
    size,
    [
      scaledPoint(size, 39, 22),
      scaledPoint(size, 31, 18),
      scaledPoint(size, 22, 23),
      scaledPoint(size, 22, 41),
      scaledPoint(size, 31, 46),
      scaledPoint(size, 39, 42)
    ],
    strokeMid,
    teal
  );
  drawCircle(pixels, size, ...scaledPoint(size, 55, 28), size * 0.07, white, teal, size * 0.035);
  drawCircle(pixels, size, ...scaledPoint(size, 44, 8), size * 0.062, white, blue, size * 0.03);
  drawCircle(pixels, size, ...scaledPoint(size, 44, 56), size * 0.062, white, blue, size * 0.03);
  drawCircle(pixels, size, ...scaledPoint(size, 31, 32), size * 0.055, ink);

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const sourceStart = y * size * 4;
    const targetStart = y * (size * 4 + 1);
    scanlines[targetStart] = 0;
    pixels.copy(scanlines, targetStart + 1, sourceStart, sourceStart + size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function createIcoBuffer(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const entries = Buffer.alloc(images.length * 16);
  let offset = header.length + entries.length;

  images.forEach((image, index) => {
    const entryOffset = index * 16;
    entries[entryOffset] = image.size >= 256 ? 0 : image.size;
    entries[entryOffset + 1] = image.size >= 256 ? 0 : image.size;
    entries[entryOffset + 2] = 0;
    entries[entryOffset + 3] = 0;
    entries.writeUInt16LE(1, entryOffset + 4);
    entries.writeUInt16LE(32, entryOffset + 6);
    entries.writeUInt32LE(image.buffer.length, entryOffset + 8);
    entries.writeUInt32LE(offset, entryOffset + 12);
    offset += image.buffer.length;
  });

  return Buffer.concat([header, entries, ...images.map((image) => image.buffer)]);
}

const images = ICON_SIZES.map((size) => ({
  size,
  buffer: createBrandIconPngBuffer(size)
}));

await mkdir(OUTPUT_DIR, { recursive: true });
await writeFile(PREVIEW_PATH, images.at(-1).buffer);
await writeFile(ICON_PATH, createIcoBuffer(images));

console.log(`已生成 ${path.relative(ROOT, ICON_PATH)} 和 ${path.relative(ROOT, PREVIEW_PATH)}`);
