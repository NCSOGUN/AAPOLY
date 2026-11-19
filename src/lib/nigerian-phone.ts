const nigerianMobilePrefixes = new Set([
  "0701", "0702", "0703", "0705", "0706", "0707", "0708",
  "0802", "0803", "0804", "0805", "0806", "0807", "0808", "0809",
  "0810", "0811", "0812", "0813", "0814", "0815", "0816", "0817", "0818",
  "0901", "0902", "0903", "0904", "0905", "0906", "0907", "0908", "0909",
  "0911", "0912", "0913", "0915", "0916",
]);

export function normalizeNigerianPhone(value: string) {
  const compact = value.trim().replace(/[\s()-]/g, "");
  const national =
    compact.startsWith("+234") ? `0${compact.slice(4)}` :
    compact.startsWith("234") ? `0${compact.slice(3)}` :
    compact;

  if (!/^0\d{10}$/.test(national) || !nigerianMobilePrefixes.has(national.slice(0, 4))) {
    return null;
  }

  return `+234${national.slice(1)}`;
}

export function formatNigerianPhone(phone: string) {
  const national = phone.replace(/^\+234/, "0");
  return `${national.slice(0, 4)} ${national.slice(4, 7)} ${national.slice(7)}`;
}
