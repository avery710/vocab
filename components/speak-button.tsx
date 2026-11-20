"use client";

import { useEffect, useRef, useState } from "react";

/** Says the word aloud with the browser's own English voice. Hidden where the
 *  browser has no speech synthesis.
 *
 *  Mobile care: only cancel when something is actually speaking (iOS Safari
 *  can drop a speak() that comes straight after cancel()), keep the utterance
 *  in a ref (Chrome on Android can garbage-collect it mid-speech), and show the
 *  pressed state on tap so a muted phone still visibly responds. */
export function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    // Voices load asynchronously on some browsers; asking once starts the load.
    window.speechSynthesis.getVoices();
    return () => window.speechSynthesis.cancel();
  }, []);
  if (!supported) return null;

  const speak = () => {
    const synth = window.speechSynthesis;
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    const voices = synth.getVoices();
    const voice = voices.find((v) => /^en[-_]US/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    const done = () => {
      setSpeaking(false);
      if (utterance.current === u) utterance.current = null;
    };
    u.onend = done;
    u.onerror = done;
    utterance.current = u;
    setSpeaking(true);
    synth.speak(u);
    synth.resume(); // Some mobile browsers start the queue paused.
  };

  return (
    <button
      type="button"
      onClick={speak}
      aria-label={`Say “${text}” aloud`}
      className={`inline-flex size-9 touch-manipulation items-center justify-center rounded-full border transition-colors select-none active:scale-95 ${
        speaking ? "border-ink bg-marker-soft text-ink" : "border-rule bg-sheet text-pencil hover:border-ink hover:text-ink"
      } ${className}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none size-[18px]">
        <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" />
        <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </button>
  );
}
