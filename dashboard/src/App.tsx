import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import SessionList from './pages/SessionList';
import SessionDetail from './pages/SessionDetail';
import LiveView from './pages/LiveView';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<SessionList />} />
          <Route path="/session/:id" element={<SessionDetail />} />
          <Route path="/live" element={<LiveView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
