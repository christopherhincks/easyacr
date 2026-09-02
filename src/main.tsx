import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { registerEasyAcrWebMcpTools } from './webmcp';

const webMcpRegistrationController = new AbortController();
void registerEasyAcrWebMcpTools(document, webMcpRegistrationController.signal);

if (import.meta.hot) {
  import.meta.hot.dispose(() => webMcpRegistrationController.abort());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
