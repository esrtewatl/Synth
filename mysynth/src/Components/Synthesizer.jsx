import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';  // Import Tone.js for audio synthesis
import { saveAs } from 'file-saver';  // Import file-saver for saving recordings
import lamejs from 'lamejs';  // Import lamejs for MP3 encoding
import './Synthesizer.css';  // Import CSS for styling

const Synthesizer = () => {
  // State for synthesizer settings
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

  // Refs for managing audio context, media recorder, active notes, and synth instance
  const audioContext = useRef(null);
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const activeNotes = useRef(new Set());
  const synth = useRef(null);

  useEffect(() => {
    // Effect to initialize synth and audio context on component mount or when settings change
    if (!synth.current) {
      // Create a new Tone.Synth instance with settings
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
      }).toDestination();  // Connect synth to the audio output
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
      Tone.start();  // Start the audio context if not already running
    }

    // Event listeners for keyboard input
    const handleKeyDown = (event) => {
      const note = getNoteFromKeyCode(event.keyCode);  // Get note from key code
      if (note && synth.current && !activeNotes.current.has(note)) {
        activeNotes.current.add(note);  // Add note to active notes set
        synth.current.triggerAttack(getNoteWithOctave(note));  // Trigger attack for the note
      }
    };

    const handleKeyUp = (event) => {
      const note = getNoteFromKeyCode(event.keyCode);  // Get note from key code
      if (note && synth.current && activeNotes.current.has(note)) {
        activeNotes.current.delete(note);  // Remove note from active notes set
        synth.current.triggerRelease(getNoteWithOctave(note));  // Trigger release for the note
      }
    };

    window.addEventListener('keydown', handleKeyDown);  // Add keydown event listener
    window.addEventListener('keyup', handleKeyUp);  // Add keyup event listener

    // Cleanup: remove event listeners
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [settings]);  // Dependency array ensures effect runs on settings change

  // Function to initialize the audio context
  const initializeAudioContext = () => {
    if (!audioContext.current) {
      audioContext.current = new (window.AudioContext || window.webkitAudioContext)();  // Create new audio context if not already exists
    } else if (audioContext.current.state === 'suspended') {
      audioContext.current.resume();  // Resume audio context if suspended
    }
  };

  // Function to start recording audio
  const startRecording = () => {
    initializeAudioContext();  // Initialize audio context
    const streamDestination = audioContext.current.createMediaStreamDestination();  // Create media stream destination
    synth.current.connect(streamDestination);  // Connect synth to stream destination

    // Initialize media recorder with stream destination
    mediaRecorder.current = new MediaRecorder(streamDestination.stream);

    // Event listener when data is available (recorded)
    mediaRecorder.current.ondataavailable = (event) => {
      audioChunks.current.push(event.data);  // Push recorded data to audio chunks array
    };

    // Event listener when recording is stopped
    mediaRecorder.current.onstop = async () => {
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });  // Create blob from audio chunks
      audioChunks.current = [];  // Clear audio chunks array

      // Convert WAV to MP3
      const arrayBuffer = await audioBlob.arrayBuffer();
      const mp3Buffer = convertToMp3(new Uint8Array(arrayBuffer));
      const mp3Blob = new Blob(mp3Buffer, { type: 'audio/mp3' });  // Create blob from MP3 buffer
      saveAs(mp3Blob, 'recording.mp3');  // Save MP3 blob as file
    };

    mediaRecorder.current.start();  // Start recording with media recorder
  };

  // Function to stop recording
  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();  // Stop media recorder if exists
    }
  };

  // Function to convert WAV to MP3 using lamejs
  const convertToMp3 = (wavBuffer) => {
    const wav = lamejs.WavHeader.readHeader(wavBuffer);  // Read WAV header
    const samples = new Int16Array(wavBuffer, wav.dataOffset, wav.dataLen / 2);  // Get samples from WAV buffer

    // Create MP3 encoder with mono channel, sample rate from WAV, and bitrate
    const mp3Encoder = new lamejs.Mp3Encoder(1, wav.sampleRate, 128);
    const mp3Data = [];
    let sampleBlockSize = 1152;  // MP3 sample block size

    // Encode sample chunks to MP3
    for (let i = 0; i < samples.length; i += sampleBlockSize) {
      const sampleChunk = samples.subarray(i, i + sampleBlockSize);  // Get sample chunk
      const mp3buf = mp3Encoder.encodeBuffer(sampleChunk);  // Encode buffer to MP3
      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));  // Push encoded MP3 buffer
      }
    }

    // Flush remaining MP3 buffer
    const mp3buf = mp3Encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));  // Push remaining MP3 buffer
    }

    return mp3Data;  // Return array of Int8Arrays of MP3 data
  };

  // Function to handle changes in synthesizer settings
  const handleSettingChange = (e) => {
    const { name, value } = e.target;  // Destructure name and value from event target
    setSettings({ ...settings, [name]: parseFloat(value) });  // Update settings state
  };

  // Function to handle octave changes
  const handleOctaveChange = (direction) => {
    setSettings((prevState) => ({
      ...prevState,
      octave: direction === 'up' ? prevState.octave + 1 : prevState.octave - 1,  // Increment or decrement octave
    }));
  };

  // Function to get note with current octave
  const getNoteWithOctave = (note) => {
    return `${note}${settings.octave}`;  // Return note with current octave
  };

  // Function to get note from key code
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
      default: return null;  // Return null for unsupported key codes
    }
  };

  // JSX rendering of synthesizer component
  return (
    <div className="synthesizer">
      <div className="controls">
        {/* Dropdown to select oscillator type */}
        <label>
          Oscillator Type:
          <select name="oscillatorType" value={settings.oscillatorType} onChange={handleSettingChange}>
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="triangle">Triangle</option>
            <option value="sawtooth">Sawtooth</option>
          </select>
        </label>
        {/* Slider for envelope attack */}
        <label>
          Attack:
          <input type="range" name="envelopeAttack" min="0" max="2" step="0.01" value={settings.envelopeAttack} onChange={handleSettingChange} />
        </label>
        {/* Slider for envelope decay */}
        <label>
          Decay:
          <input type="range" name="envelopeDecay" min="0" max="2" step="0.01" value={settings.envelopeDecay} onChange={handleSettingChange} />
        </label>
        {/* Slider for envelope sustain */}
        <label>
          Sustain:
          <input type="range" name="envelopeSustain" min="0" max="1" step="0.01" value={settings.envelopeSustain} onChange={handleSettingChange} />
        </label>
        {/* Slider for envelope release */}
        <label>
          Release:
          <input type="range" name="envelopeRelease" min="0" max="5" step="0.01" value={settings.envelopeRelease} onChange={handleSettingChange} />
        </label>
        {/* Slider for filter frequency */}
        <label>
          Filter Frequency:
          <input type="range" name="filterFrequency" min="20" max="20000" step="1" value={settings.filterFrequency} onChange={handleSettingChange} />
        </label>
        {/* Slider for filter Q */}
        <label>
          Filter Q:
          <input type="range" name="filterQ" min="0.1" max="20" step="0.1" value={settings.filterQ} onChange={handleSettingChange} />
        </label>
        {/* Dropdown to select filter type */}
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
        {/* Slider for filter gain */}
        <label>
          Filter Gain:
          <input type="range" name="filterGain" min="-40" max="40" step="1" value={settings.filterGain} onChange={handleSettingChange} />
        </label>
        {/* Control buttons for octave */}
        <div className="octave-control">
          <button onClick={() => handleOctaveChange('down')}>Octave Down</button>
          <span>Octave: {settings.octave}</span>
          <button onClick={() => handleOctaveChange('up')}>Octave Up</button>
        </div>
      </div>
      {/* Keyboard section for notes */}
      <div className="keyboard">
        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((note) => (
          <button
            key={note}
            onMouseDown={() => {
              if (synth.current) {
                synth.current.triggerAttack(getNoteWithOctave(note));  // Trigger attack on mouse down
              }
            }}
            onMouseUp={() => {
              if (synth.current) {
                synth.current.triggerRelease(getNoteWithOctave(note));  // Trigger release on mouse up
              }
            }}
            onTouchStart={() => {
              if (synth.current) {
                synth.current.triggerAttack(getNoteWithOctave(note));  // Trigger attack on touch start
              }
            }}
            onTouchEnd={() => {
              if (synth.current) {
                synth.current.triggerRelease(getNoteWithOctave(note));  // Trigger release on touch end
              }
            }}
          >
            {`${note}${settings.octave}`}  // Display note with current octave
          </button>
        ))}
      </div>
      {/* Recording section */}
      <div className="recording">
        <button onClick={startRecording}>Start Recording</button>
        <button onClick={stopRecording}>Stop Recording</button>
      </div>
    </div>
  );
};

export default Synthesizer;
