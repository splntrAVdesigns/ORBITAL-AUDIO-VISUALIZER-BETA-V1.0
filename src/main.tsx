
  import { createRoot } from "react-dom/client";
  import { Analytics } from "@vercel/analytics/react";
  import App from "./app/App.tsx";
  import "./styles/index.css";

  const rootElement = document.getElementById("root")!;
  createRoot(rootElement).render(
    <>
      <App />
      <Analytics />
    </>
  );
  
