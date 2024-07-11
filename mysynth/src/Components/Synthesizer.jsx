// src/components/Synthesizer.js
import React, { useState, useEffect } from 'react';
import * as Tone from 'tone';

const Synthesizer = () => {
  const [synth, setSynth] = useState(new Tone.Synth().toDestination());

  useEffect(() => {
    if (navigator.requestMIDIAccess) {
      navigator.requestMIDIAccess().then((midiAccess) => {
        midiAccess.inputs.forEach((input) => {
          input.onmidimessage = handleMIDIMessage;
        });
      });
    }
  }, []);

  const handleMIDIMessage = (message) => {
    const [command, note, velocity] = message.data;

    if (command === 144) {
      synth.triggerAttack(Tone.Frequency(note, 'midi').toNote());
    } else if (command === 128) {
      synth.triggerRelease(Tone.Frequency(note, 'midi').toNote());
    }
  };

  return (
    <div>
      <button onClick={() => synth.triggerAttackRelease('C4', '8n')}>C4</button>
      <button onClick={() => synth.triggerAttackRelease('D4', '8n')}>D4</button>
      <button onClick={() => synth.triggerAttackRelease('E4', '8n')}>E4</button>
    </div>
  );
};

export default Synthesizer;
