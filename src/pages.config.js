import Optimizer from './pages/Optimizer';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Optimizer": Optimizer,
    "Clientes": Clientes,
    "Configuracoes": Configuracoes,
}

export const pagesConfig = {
    mainPage: "Optimizer",
    Pages: PAGES,
    Layout: __Layout,
};