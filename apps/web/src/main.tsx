import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { App } from "./App";
import { sfx } from "./game/sound";
import "./index.css";

// Cache the app for offline play; updates apply on the next load.
registerSW({ immediate: true });

// Browsers only start audio after a user gesture.
const unlockAudio = () => sfx.unlock();
window.addEventListener("pointerdown", unlockAudio);
window.addEventListener("keydown", unlockAudio);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
