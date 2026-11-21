"use client";

import { useEffect, useRef, useState } from "react";

/** Says the word aloud with the browser's own English voice. Hidden where the
 *  browser has no speech synthesis.
 *
 *  Mobile care: only cancel when something is actually speaking (iOS Safari
 *  can drop a speak() that comes straight after cancel()), keep the utterance
 *  in a ref (Chrome on Android can garbage-collect it mid-speech), and show the
 *  pressed state on tap.
 *
 *  Silent switch: iOS mutes speech synthesis while the ringer is off, but not
 *  media playback. So each tap asks for the "playback" audio session (Safari
 *  17+) and loops a silent clip through an <audio> element while the word is
 *  spoken, which puts the page's audio in the playback category on older iOS
 *  too (the same trick as swevans/unmute-ios-audio). */
export function SpeakButton({ text, className = "" }: { text: string; className?: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const silence = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setSupported(true);
    // Voices load asynchronously on some browsers; asking once starts the load.
    window.speechSynthesis.getVoices();
    return () => {
      window.speechSynthesis.cancel();
      silence.current?.pause();
    };
  }, []);
  if (!supported) return null;

  const speak = () => {
    const synth = window.speechSynthesis;
    // Both must start inside the tap itself, before speak(), or iOS ignores them.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = "playback";
    silence.current ??= silentLoop();
    silence.current.play().catch(() => {});
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    u.rate = 0.92;
    const voices = synth.getVoices();
    const voice = voices.find((v) => /^en[-_]US/i.test(v.lang)) ?? voices.find((v) => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    const done = () => {
      if (utterance.current !== u) return; // a newer tap took over
      utterance.current = null;
      setSpeaking(false);
      silence.current?.pause();
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

/** A looping <audio> element playing a quarter second of silence (an 8 kHz
 *  mono WAV built in memory, so there is no file to fetch). */
function silentLoop(): HTMLAudioElement {
  const samples = 2000;
  const buf = new DataView(new ArrayBuffer(44 + samples));
  const text = (at: number, str: string) => [...str].forEach((c, i) => buf.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  buf.setUint32(4, 36 + samples, true);
  text(8, "WAVEfmt ");
  buf.setUint32(16, 16, true); // fmt chunk size
  buf.setUint16(20, 1, true); // PCM
  buf.setUint16(22, 1, true); // mono
  buf.setUint32(24, 8000, true); // sample rate
  buf.setUint32(28, 8000, true); // byte rate
  buf.setUint16(32, 1, true); // block align
  buf.setUint16(34, 8, true); // bits per sample
  text(36, "data");
  buf.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) buf.setUint8(44 + i, 128); // 8-bit silence is 128
  const audio = new Audio(URL.createObjectURL(new Blob([buf], { type: "audio/wav" })));
  audio.loop = true;
  audio.setAttribute("playsinline", "");
  return audio;
}
