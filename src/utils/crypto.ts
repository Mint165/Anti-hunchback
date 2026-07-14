// Simple encryption utility for anti-cheat purposes
const SALT = "OLIVER_SECRET_2026";

export function encryptData(data: any): string {
  try {
    const jsonStr = JSON.stringify(data);
    const salted = jsonStr + SALT;
    return btoa(encodeURIComponent(salted));
  } catch (error) {
    console.error("Encryption failed", error);
    return "";
  }
}

export function decryptData(encryptedStr: string): any | null {
  try {
    if (!encryptedStr) return null;
    const decoded = decodeURIComponent(atob(encryptedStr));
    if (decoded.endsWith(SALT)) {
      const jsonStr = decoded.slice(0, -SALT.length);
      return JSON.parse(jsonStr);
    }
    return null;
  } catch (error) {
    console.error("Decryption failed", error);
    return null;
  }
}
