import { useState } from 'react'
import reactLogo from './assets/react.svg'
import Synthesizer from './Components/Synthesizer.jsx'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>

<Synthesizer />
    </>
  )
}

export default App
