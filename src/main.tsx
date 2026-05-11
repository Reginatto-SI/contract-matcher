import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { APP_VERSION } from "./config/appVersion";
import { GENERATED_VERSION } from "./config/generatedVersion";
import "./index.css";

// Log discreto para suporte e diagnóstico de cache/deploy no navegador do usuário.
console.info("[APP_VERSION]", {
  ...APP_VERSION,
  ...GENERATED_VERSION,
});

createRoot(document.getElementById("root")!).render(<App />);
