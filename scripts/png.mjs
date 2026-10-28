// A minimal PNG encoder for RGBA textures, so art review scripts need no
// image library. Pixels are the Uint32Array the painter and renderer use.
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** Encode an RGBA texture as a PNG. */
export function png(t) {
  const head = Buffer.alloc(13);
  head.writeUInt32BE(t.w, 0);
  head.writeUInt32BE(t.h, 4);
  head[8] = 8;
  head[9] = 6;
  const raw = Buffer.alloc((t.w * 4 + 1) * t.h);
  const bytes = Buffer.from(t.data.buffer, t.data.byteOffset, t.data.byteLength);
  for (let y = 0; y < t.h; y++) bytes.copy(raw, y * (t.w * 4 + 1) + 1, y * t.w * 4, (y + 1) * t.w * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", head), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
