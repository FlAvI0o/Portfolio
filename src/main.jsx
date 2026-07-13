import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useTexture } from '@react-three/drei'
import './index.css'
import App from './App.jsx'

useTexture.preload('/foto1.webp')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
