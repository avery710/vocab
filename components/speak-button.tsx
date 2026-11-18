"use client";

import { useEffect, useState } from "react";

/** Says the word aloud with the browser's own English voice. Hidden where the
 *  browser has no speech synthesis. */
export function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => setSupported(typeof window !== "undefined" && "speechSynthesis" in window), []);
  if (!supported) return null;

  const speak = () => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    const voice = synth.getVoices().find((v) => v.lang.startsWith("en-US")) ?? synth.getVoices().find((v) => v.lang.startsWith("en"));
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(u);
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`Say “${text}” aloud`}
      className={`inline-flex size-9 items-center justify-center rounded-full border border-rule bg-sheet text-pencil transition-colors hover:border-ink hover:text-ink ${speaking ? "bg-marker-soft text-ink" : ""} ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-[18px]">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" />
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
