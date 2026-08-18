import { useEffect, useRef, useState } from "react";
import Waveform from "./Waveform";

// Owns the live mic-level animation loop (~60fps via requestAnimationFrame) so those
// state updates only re-render this small component - not the whole page that hosts
// it, which previously re-rendered its entire tree on every animation frame for the
// full length of a recording (up to 10 minutes).
export default function LiveWaveform({ stream, active, height = 64 }) {
  const [levels, setLevels] = useState([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!active || !stream) {
      setLevels([]);
      return;
    }

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContext.resume?.();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const barCount = 24;
      const step = Math.max(1, Math.floor(dataArray.length / barCount));

      const tick = () => {
        analyser.getByteFrequencyData(dataArray);
        const nextLevels = [];
        for (let i = 0; i < barCount; i++) {
          nextLevels.push(dataArray[i * step] / 255);
        }
        setLevels(nextLevels);
        animationRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // Live waveform is a nice-to-have; recording itself doesn't depend on it.
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
      analyserRef.current = null;
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      setLevels([]);
    };
  }, [stream, active]);

  return <Waveform active={active} height={height} levels={levels} />;
}
