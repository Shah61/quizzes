// Exact-enough MP3 duration from the first few KB plus the file size.
//
// Downloading 200+ candidate clips in full just to time them is wasteful, and
// the answer is already in the header: a CBR file's length is size/bitrate, and
// a VBR one carries its frame count in the Xing/Info tag of the first frame.
// So one ranged request for the head of the file plus Content-Length is enough.

const V_MPEG25 = 0, V_RESERVED = 1, V_MPEG2 = 2, V_MPEG1 = 3;

const BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0];
const BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0];
const RATES = {
  [V_MPEG1]: [44100, 48000, 32000, 0],
  [V_MPEG2]: [22050, 24000, 16000, 0],
  [V_MPEG25]: [11025, 12000, 8000, 0],
};

/** ID3v2 sits in front of the audio; its size is four 7-bit bytes. */
function id3Size(buf) {
  if (buf.length < 10 || buf[0] !== 0x49 || buf[1] !== 0x44 || buf[2] !== 0x33) return 0;
  const size = (buf[6] & 0x7f) << 21 | (buf[7] & 0x7f) << 14 | (buf[8] & 0x7f) << 7 | (buf[9] & 0x7f);
  return 10 + size + ((buf[5] & 0x10) ? 10 : 0); // footer flag
}

function parseHeader(buf, i) {
  if (i + 4 > buf.length) return null;
  if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) return null;
  const version = (buf[i + 1] >> 3) & 0x03;
  const layer = (buf[i + 1] >> 1) & 0x03;
  if (version === V_RESERVED || layer !== 0x01) return null; // Layer III only
  const bitrateIdx = (buf[i + 2] >> 4) & 0x0f;
  const rateIdx = (buf[i + 2] >> 2) & 0x03;
  const padding = (buf[i + 2] >> 1) & 0x01;
  const channelMode = (buf[i + 3] >> 6) & 0x03;

  const table = version === V_MPEG1 ? BITRATES_V1_L3 : BITRATES_V2_L3;
  const bitrate = table[bitrateIdx] * 1000;
  const sampleRate = RATES[version][rateIdx];
  if (!bitrate || !sampleRate) return null;

  const samplesPerFrame = version === V_MPEG1 ? 1152 : 576;
  const frameLen = Math.floor((version === V_MPEG1 ? 144 : 72) * bitrate / sampleRate) + padding;
  if (frameLen < 24) return null;
  return { version, bitrate, sampleRate, samplesPerFrame, frameLen, mono: channelMode === 3, offset: i };
}

/** Walk forward until a header is found whose next frame also looks like one. */
function findFirstFrame(buf, from) {
  for (let i = from; i < buf.length - 4; i++) {
    const h = parseHeader(buf, i);
    if (!h) continue;
    const next = parseHeader(buf, i + h.frameLen);
    if (next && next.sampleRate === h.sampleRate) return h;
  }
  return null;
}

/** Xing (VBR) or Info (CBR) tag, which carries the real frame count. */
function xingFrames(buf, h) {
  const sideInfo = h.version === 3 ? (h.mono ? 17 : 32) : (h.mono ? 9 : 17);
  const at = h.offset + 4 + sideInfo;
  if (at + 12 > buf.length) return 0;
  const tag = String.fromCharCode(buf[at], buf[at + 1], buf[at + 2], buf[at + 3]);
  if (tag !== 'Xing' && tag !== 'Info') return 0;
  const flags = (buf[at + 4] << 24) | (buf[at + 5] << 16) | (buf[at + 6] << 8) | buf[at + 7];
  if (!(flags & 0x01)) return 0; // no frame count
  return (buf[at + 8] << 24) | (buf[at + 9] << 16) | (buf[at + 10] << 8) | buf[at + 11];
}

/**
 * @param {Uint8Array} head first ~16KB of the file
 * @param {number} totalBytes Content-Length of the whole file
 * @returns {{seconds:number, bitrate:number, sampleRate:number}|null}
 */
export function mp3Duration(head, totalBytes) {
  const start = id3Size(head);
  const h = findFirstFrame(head, start);
  if (!h) return null;

  const frames = xingFrames(head, h);
  // A Xing frame count covers the whole file including VBR; trust it when present.
  if (frames > 0) {
    return { seconds: (frames * h.samplesPerFrame) / h.sampleRate, bitrate: h.bitrate, sampleRate: h.sampleRate };
  }
  if (!totalBytes || totalBytes <= h.offset) return null;
  const audioBytes = totalBytes - h.offset;
  return { seconds: (audioBytes * 8) / h.bitrate, bitrate: h.bitrate, sampleRate: h.sampleRate };
}
