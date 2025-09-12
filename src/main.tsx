import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./app.tsx";

// Temporarily remove StrictMode while debugging native child webviews.
createRoot(document.getElementById("root") as HTMLElement).render(<App />);
