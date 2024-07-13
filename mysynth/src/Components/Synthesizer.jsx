import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { saveAs } from 'file-saver';
import lamejs from 'lamejs';
import './Synthesizer.css';

const Synthesizer = () => {
  const [settings, setSettings] = useState({
    oscillatorType: 'sine',
    envelopeAttack: 0.1,
    envelopeDecay: 0.2,
    envelopeSustain: 0.5,
    envelopeRelease: 1,
    filterFrequency: 350,
    filterQ: 1,
    filterType: 'lowpass',
    filterGain: 0,
    octave: 4,
  });

  const audioContext = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const activeNotes = useRef(new Set());
  const synth = useRef(null);

  useEffect(() => {
    // Initialize synth and audio context on component mount
    if (!synth.current) {
      synth.current = new Tone.Synth({
        oscillator: { type: settings.oscillatorType },
        envelope: {
          attack: settings.envelopeAttack,
          decay: settings.envelopeDecay,
          sustain: settings.envelopeSustain,
          release: settings.envelopeRelease,
        },
        filter: {
          frequency: settings.filterFrequency,
          Q: settings.filterQ,
          type: settings.filterType,
          gain: settings.filterGain,
        },
      }).toDestination();
    } else {
      // Update synth settings if they change
      synth.current.set({
        oscillator: { type: settings.oscillatorType },
        envelope: {
          attack: settings.envelopeAttack,
          decay: settings.envelopeDecay,
          sustain: settings.envelopeSustain,
          release: settings.envelopeRelease,
        },
        filter: {
          frequency: settings.filterFrequency,
          Q: settings.filterQ,
          type: settings.filterType,
          gain: settings.filterGain,
        },
      });
    }

    // Ensure Tone.js context is started
    if (Tone.context.state !== 'running') {
      Tone.start();
    }

    // Event listeners for keyboard input
    const handleKeyDown = (event) => {
      const note = getNoteFromKeyCode(event.keyCode);
      if (note && synth.current && !activeNotes.current.has(note)) {
        activeNotes.current.add(note);
        synth.current.triggerAttack(getNoteWithOctave(note));
      }
    };

    const handleKeyUp = (event) => {
      const note = getNoteFromKeyCode(event.keyCode);
      if (note && synth.current && activeNotes.current.has(note)) {
        activeNotes.current.delete(note);
        synth.current.triggerRelease(getNoteWithOctave(note));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [settings]);

  const initializeAudioContext = () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();
    } else if (audioContext.current.state === 'suspended') {
      audioContext.current.resume();
    }
  };

  const startRecording = () => {
    initializeAudioContext();
    const streamDestination = audioContext.current.createMediaStreamDestination();
    synth.current.connect(streamDestination);
    mediaRecorder.current = new MediaRecorder(streamDestination.stream);

    mediaRecorder.current.ondataavailable = (event) => {
      audioChunks.current.push(event.data);
    };

    mediaRecorder.current.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      audioChunks.current = [];

      const arrayBuffer = await audioBlob.arrayBuffer();
      const mp3Buffer = convertToMp3(new Uint8Array(arrayBuffer));
      const mp3Blob = new Blob(mp3Buffer, { type: 'audio/mp3' });
      saveAs(mp3Blob, 'recording.mp3');
    };

    mediaRecorder.current.start();
  };

  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
    }
  };

  const convertToMp3 = (wavBuffer) => {
    const wav = lamejs.WavHeader.readHeader(wavBuffer);
    const samples = new Int16Array(wavBuffer, wav.dataOffset, wav.dataLen / 2);

    const mp3Encoder = new lamejs.Mp3Encoder(1, wav.sampleRate, 128);
    const mp3Data = [];
    let sampleBlockSize = 1152;
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const sampleChunk = samples.subarray(i, i + sampleBlockSize);
      const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);
      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }
    }
    const mp3buf = mp3Encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));
    }
    return mp3Data;
  };

  const handleSettingChange = (e) => {
    const { name, value } = e.target;
    setSettings({ ...settings, [name]: parseFloat(value) });
  };

  const handleOctaveChange = (direction) => {
    setSettings((prevState) => ({
      ...prevState,
      octave: direction === 'up' ? prevState.octave + 1 : prevState.octave - 1,
    }));
  };

  const getNoteWithOctave = (note) => {
    return `${note}${settings.octave}`;
  };

  const getNoteFromKeyCode = (keyCode) => {
    switch (keyCode) {
      case 65: return 'C';
      case 83: return 'D';
      case 68: return 'E';
      case 70: return 'F';
      case 71: return 'G';
      case 72: return 'A';
      case 74: return 'B';
      case 75: return 'C#';
      case 76: return 'D#';
      case 186: return 'F#';
      case 222: return 'G#';
      default: return null;
    }
  };

  return (
    <div className="synthesizer">
      <div className="controls">
        <label>
          Oscillator Type:
          <select name="oscillatorType" value={settings.oscillatorType} onChange={handleSettingChange}>
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="sawtooth">Sawtooth</option>
          </select>
        </label>
        <label>
          Attack:
          <input type="range" name="envelopeAttack" min="0" max="2" step="0.01" value={settings.envelopeAttack} onChange={handleSettingChange} />
        </label>
        <label>
          Decay:
          <input type="range" name="envelopeDecay" min="0" max="2" step="0.01" value={settings.envelopeDecay} onChange={handleSettingChange} />
        </label>
        <label>
          Sustain:
          <input type="range" name="envelopeSustain" min="0" max="1" step="0.01" value={settings.envelopeSustain} onChange={handleSettingChange} />
        </label>
        <label>
          Release:
          <input type="range" name="envelopeRelease" min="0" max="5" step="0.01" value={settings.envelopeRelease} onChange={handleSettingChange} />
        </label>
        <label>
          Filter Frequency:
          <input type="range" name="filterFrequency" min="20" max="20000" step="1" value={settings.filterFrequency} onChange={handleSettingChange} />
        </label>
        <label>
          Filter Q:
          <input type="range" name="filterQ" min="0.1" max="20" step="0.1" value={settings.filterQ} onChange={handleSettingChange} />
        </label>
        <label>
          Filter Type:
          <select name="filterType" value={settings.filterType} onChange={handleSettingChange}>
            <option value="lowpass">Lowpass</option>
            <option value="highpass">Highpass</option>
            <option value="bandpass">Bandpass</option>
            <option value="lowshelf">Lowshelf</option>
            <option value="highshelf">Highshelf</option>
            <option value="peaking">Peaking</option>
            <option value="notch">Notch</option>
            <option value="allpass">Allpass</option>
          </select>
        </label>
        <label>
          Filter Gain:
          <input type="range" name="filterGain" min="-40" max="40" step="1" value={settings.filterGain} onChange={handleSettingChange} />
        </label>
        <div className="octave-control">
          <button onClick={() => handleOctaveChange('down')}>Octave Down</button>
          <span>Octave: {settings.octave}</span>
          <button onClick={() => handleOctaveChange('up')}>Octave Up</button>
        </div>
      </div>
      <div className="keyboard">
        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((note) => (
          <button
            key={note}
            onMouseDown={() => {
              if (synth.current) {
                synth.current.triggerAttack(getNoteWithOctave(note));
              }
            }}
            onMouseUp={() => {
              if (synth.current) {
                synth.current.triggerRelease(getNoteWithOctave(note));
              }
            }}
            onTouchStart={() => {
              if (synth.current) {
                synth.current.triggerAttack(getNoteWithOctave(note));
              }
            }}
            onTouchEnd={() => {
              if (synth.current) {
                synth.current.triggerRelease(getNoteWithOctave(note));
              }
            }}
          >
            {`${note}${settings.octave}`}
          </button>
        ))}
      </div>
      <div className="recording">
        <button onClick={startRecording}>Start Recording</button>
        <button onClick={stopRecording}>Stop Recording</button>
      </div>
    </div>
  );
};

export default Synthesizer;
