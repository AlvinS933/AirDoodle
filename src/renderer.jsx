import { createRoot } from 'react-dom/client';
import DrawingOverlay from './components/DrawingOverlay.jsx';
import './index.css';
 
const container = document.getElementById('root');
const root = createRoot(container);
root.render(<DrawingOverlay />);