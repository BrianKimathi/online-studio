import React, { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { useTransportStore } from './stores/useTransportStore';
import { useProjectStore } from './stores/useProjectStore';
import { useRecordingStore } from './stores/useRecordingStore';
import { AudioEngine } from './audio/engine';
import { Monitor, Smartphone } from 'lucide-react';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches || /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent);
  });
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return mobile;
}

export default function App() {
  const isMobile = useIsMobile();
  const { isPlaying, setPlaying, isRecording, setRecording, metronome, setMetronome } = useTransportStore();
  const { undo, redo, saveProject } = useProjectStore();
  const { micEnabled, setMicEnabled, recordingMode, addTake } = useRecordingStore();
  const recordStartRef = React.useRef<number | null>(null);

  useEffect(() => {
    const handleGlobalShortcuts = async (e: KeyboardEvent) => {
      // Avoid shortcuts when typing in input/textarea/editable fields
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const key = e.key.toLowerCase();

      // Spacebar: Play / Pause
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        await AudioEngine.init();
        if (isPlaying) {
          AudioEngine.stopTransport();
          setPlaying(false);
          setRecording(false);
        } else {
          AudioEngine.startTransport();
          setPlaying(true);
        }
      }

      // 'R' key: Start / Stop recording
      if (key === 'r') {
        e.preventDefault();
        await AudioEngine.init();
        if (isRecording) {
          setRecording(false);
          const url = await AudioEngine.stopRecording(recordingMode === 'vocals' ? 'vocals' : 'mix');
          const duration = recordStartRef.current ? (Date.now() - recordStartRef.current) / 1000 : 0;
          recordStartRef.current = null;
          // Stop the mic so it doesn't stay active after recording stops.
          if (micEnabled) {
            await AudioEngine.enableMic(false);
            setMicEnabled(false);
            useRecordingStore.getState().setMonitoringEnabled(false);
          }
          if (url) {
            addTake({
              id: `take-${Date.now()}`,
              name: `${recordingMode === 'vocals' ? 'Vocal' : 'Mix'} Take ${new Date().toLocaleTimeString()}`,
              timestamp: Date.now(),
              duration,
              blobUrl: url,
              type: recordingMode === 'vocals' ? 'vocals' : 'mix'
            });
          }
        } else {
          if (recordingMode === 'vocals' && !micEnabled) {
            const success = await AudioEngine.enableMic(true);
            if (success) setMicEnabled(true);
            else return;
          }
          setRecording(true);
          recordStartRef.current = Date.now();
          if (!isPlaying) {
            AudioEngine.startTransport();
            setPlaying(true);
          }
          AudioEngine.startRecording(recordingMode === 'vocals' ? 'vocals' : 'mix');
        }
      }

      // 'M' key: Metronome
      if (key === 'm') {
        e.preventDefault();
        setMetronome(!metronome);
      }

      // 'S' with Ctrl: Save project
      if ((e.ctrlKey || e.metaKey) && key === 's') {
        e.preventDefault();
        saveProject();
        alert('Project saved successfully to browser IndexedDB!');
      }

      // Undo / Redo (Ctrl+Z / Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [isPlaying, isRecording, metronome, micEnabled, recordingMode, undo, redo, saveProject, addTake]);

  if (isMobile) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-[#070b13] text-center p-8 select-none">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-5">
          <Smartphone className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-lg font-extrabold text-white mb-2">
          Open on a PC for a better experience
        </h1>
        <p className="text-sm text-slate-400 max-w-xs flex items-center gap-1.5 justify-center">
          <Monitor className="h-4 w-4 shrink-0" />
          OnlineStudio is designed for desktop. Please switch to a computer.
        </p>
      </div>
    );
  }

  return <AppShell />;
}
