// src/components/Synthesizer.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { saveAs } from 'file-saver';
import lamejs from 'lamejs';
import './Synthesizer.css';

const Synthesizer = () => {
  const [synth, setSynth] = useState(new Tone.Synth().toDestination());
  const [settings, setSettings] = useState({
    oscillatorType: 'sine',
    envelopeAttack: 0.1,
    envelopeDecay: 0.2,
    envelopeSustain: 0.5,
    envelopeRelease: 1
  });
  const audioContext = useRef(new (window.AudioContext || window.webkitAudioContext)());
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    const updatedSynth = new Tone.Synth({
      oscillator: { type: settings.oscillatorType },
      envelope: {
        attack: settings.envelopeAttack,
        decay: settings.envelopeDecay,
        sustain: settings.envelopeSustain,
        release: settings.envelopeRelease,
      },
    }).toDestination();
    setSynth(updatedSynth);

    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then((midiAccess) => {
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = handleMIDIMessage;
        });
      });
    }
  }, [settings]);

  const handleMIDIMessage = (message) => {
    const [command, note, velocity] = message.data;

    if (command === 144) {
      synth.triggerAttack(Tone.Frequency(note, 'midi').toNote());
    } else if (command === 128) {
      synth.triggerRelease(Tone.Frequency(note, 'midi').toNote());
    }
  };

  const startRecording = () => {
    const streamDestination = audioContext.current.createMediaStreamDestination();
    synth.connect(streamDestination);
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
    mediaRecorder.current.stop();
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

  return (
    <div className="synthesizer">
      <div className="controls">
        <label>
          Oscillator Type:
          <select name="oscillatorType" onChange={(e) => setSettings({ ...settings, oscillatorType: e.target.value })}>
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
      </div>
      <div className="keyboard">
        <button onClick={() => synth.triggerAttackRelease('C4', '8n')}>C4</button>
        <button onClick={() => synth.triggerAttackRelease('D4', '8n')}>D4</button>
        <button onClick={() => synth.triggerAttackRelease('E4', '8n')}>E4</button>
      </div>
      <div className="recording">
        <button onClick={startRecording}>Start Recording</button>
        <button onClick={stopRecording}>Stop Recording</button>
      </div>
    </div>
  );
};

export default Synthesizer;
