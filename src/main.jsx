import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { LangProvider } from './i18n/LangContext.jsx';
import { ConversationProvider } from '@elevenlabs/react';
import './index.css';
import 'bpmn-js/dist/assets/bpmn-js.css';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConversationProvider>
      <LangProvider>
        <App />
      </LangProvider>
    </ConversationProvider>
  </React.StrictMode>
);
