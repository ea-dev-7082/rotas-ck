import Optimizer from './pages/Optimizer';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import Relatorios from './pages/Relatorios';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Optimizer": Optimizer,
    "Clientes": Clientes,
    "Configuracoes": Configuracoes,
    "Relatorios": Relatorios,
}

export const pagesConfig = {
    mainPage: "Optimizer",
    Pages: PAGES,
    Layout: __Layout,
};