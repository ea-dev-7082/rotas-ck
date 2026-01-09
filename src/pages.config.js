import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import Home from './pages/Home';
import Optimizer from './pages/Optimizer';
import Relatorios from './pages/Relatorios';
import Agendados from './pages/Agendados';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Clientes": Clientes,
    "Configuracoes": Configuracoes,
    "Home": Home,
    "Optimizer": Optimizer,
    "Relatorios": Relatorios,
    "Agendados": Agendados,
}

export const pagesConfig = {
    mainPage: "Optimizer",
    Pages: PAGES,
    Layout: __Layout,
};