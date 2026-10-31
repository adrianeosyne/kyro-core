/**
 * Notification ping — a short two-note blip synthesised with WebAudio, so no
 * audio asset has to ship or load. Respects the user's mute preference at the
 * call site (see AppShell).
 */
let context: AudioContext | null = null;

export function playNotificationPing(): void {
  if (typeof window === "undefined") return;
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return;
    context ??= new AudioCtor();
    const ctx = context;
    if (ctx.state === "suspended") void ctx.resume();

    const start = ctx.currentTime;
    const notes = [880, 1174.66]; // A5 → D6
    notes.forEach((frequency, index) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = start + index * 0.12;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.12, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.2);
    });
  } catch {
    /* audio unavailable (blocked autoplay, no context) — stay silent */
  }
}
