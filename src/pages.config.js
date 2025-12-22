import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import Home from './pages/Home';
import Optimizer from './pages/Optimizer';
import Relatorios from './pages/Relatorios';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Clientes": Clientes,
    "Configuracoes": Configuracoes,
    "Home": Home,
    "Optimizer": Optimizer,
    "Relatorios": Relatorios,
}

export const pagesConfig = {
    mainPage: "Optimizer",
    Pages: PAGES,
    Layout: __Layout,
};