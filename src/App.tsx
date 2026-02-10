import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/Layout/Layout";
import Login from "@/pages/Login";
import Home from "@/pages/Home";
import AlbumDetail from "@/pages/AlbumDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/album/:id" element={<AlbumDetail />} />
          <Route path="/login" element={<Login />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
