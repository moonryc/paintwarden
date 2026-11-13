export const buzz = () => {
  try {
    navigator.vibrate?.(8);
  } catch {
    // Desktop browsers do not support vibration.
  }
};

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};
