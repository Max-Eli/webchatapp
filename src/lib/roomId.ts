const ALPHABET = "abcdefghjkmnpqrstuvwxyz";

function randomChars(n: number) {
  const bytes = new Uint8Array(n);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < n; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

export function generateRoomId() {
  return `${randomChars(3)}-${randomChars(4)}-${randomChars(3)}`;
}

const ROOM_ID_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

function lettersOnly(input: string) {
  return input.toLowerCase().replace(/[^a-z]/g, "").slice(0, 10);
}

// Strip everything but letters; if exactly 10, format as aaa-bbbb-ccc.
export function normalizeRoomId(input: string) {
  const letters = lettersOnly(input);
  if (letters.length !== 10) return letters;
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7, 10)}`;
}

// Format partial input live (e.g. "mkipw" -> "mki-pw"). Used as you type.
export function formatRoomIdInput(input: string) {
  const letters = lettersOnly(input);
  if (letters.length <= 3) return letters;
  if (letters.length <= 7) return `${letters.slice(0, 3)}-${letters.slice(3)}`;
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
}

export function isValidRoomId(input: string) {
  return ROOM_ID_RE.test(input);
}
