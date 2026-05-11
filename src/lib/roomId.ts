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

export function normalizeRoomId(input: string) {
  return input.trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidRoomId(input: string) {
  return ROOM_ID_RE.test(input);
}
