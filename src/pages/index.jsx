import Layout from "./Layout.jsx";

import Dashboard from "./Dashboard";

import Talhoes from "./Talhoes";

import Colheitas from "./Colheitas";

import Atividades from "./Atividades";

import Calendario from "./Calendario";

import Insumos from "./Insumos";

import Financeiro from "./Financeiro";

import Funcionarios from "./Funcionarios";

import Consultorias from "./Consultorias";

import Relatorios from "./Relatorios";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Dashboard: Dashboard,
    
    Talhoes: Talhoes,
    
    Colheitas: Colheitas,
    
    Atividades: Atividades,
    
    Calendario: Calendario,
    
    Insumos: Insumos,
    
    Financeiro: Financeiro,
    
    Funcionarios: Funcionarios,
    
    Consultorias: Consultorias,
    
    Relatorios: Relatorios,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Dashboard />} />
                
                
                <Route path="/Dashboard" element={<Dashboard />} />
                
                <Route path="/Talhoes" element={<Talhoes />} />
                
                <Route path="/Colheitas" element={<Colheitas />} />
                
                <Route path="/Atividades" element={<Atividades />} />
                
                <Route path="/Calendario" element={<Calendario />} />
                
                <Route path="/Insumos" element={<Insumos />} />
                
                <Route path="/Financeiro" element={<Financeiro />} />
                
                <Route path="/Funcionarios" element={<Funcionarios />} />
                
                <Route path="/Consultorias" element={<Consultorias />} />
                
                <Route path="/Relatorios" element={<Relatorios />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}