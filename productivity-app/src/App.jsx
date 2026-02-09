import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Focus from './pages/Focus';
import Analyze from './pages/Analyze';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen text-text">
        <Sidebar />
        
     
        <main className="flex-1 h-full overflow-auto bg-background p-8">
          <Routes>
            <Route path="/" element={<Focus />} />
            <Route path="/analyze" element={<Analyze />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;