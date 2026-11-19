export const voiceLanguages = [
  { code: "en", locale: "en-NG", label: "English" },
  { code: "yo", locale: "yo-NG", label: "Yoruba" },
  { code: "ig", locale: "ig-NG", label: "Igbo" },
  { code: "ha", locale: "ha-NG", label: "Hausa" },
] as const;

export type VoiceLanguageCode = (typeof voiceLanguages)[number]["code"];
