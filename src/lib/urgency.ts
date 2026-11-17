export const urgencyConfig = {
  Emergency: {
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    label: "Emergency",
    action: "Call 112 or go to your nearest emergency room immediately.",
  },
  Urgent: {
    color: "#f97316",
    bg: "#fff7ed",
    border: "#fed7aa",
    label: "Urgent",
    action: "See a doctor today or tomorrow. Do not delay.",
  },
  Soon: {
    color: "#d97706",
    bg: "#fffbeb",
    border: "#fde68a",
    label: "Soon",
    action: "Book an appointment within the next few days.",
  },
  Routine: {
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
    label: "Routine",
    action: "Self-care and routine review are usually sufficient for now.",
  },
} as const;
