/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Agendados from './pages/Agendados';
import Clientes from './pages/Clientes';
import Configuracoes from './pages/Configuracoes';
import DriverDashboard from './pages/DriverDashboard';
import DriverHistory from './pages/DriverHistory';
import DriverProfile from './pages/DriverProfile';
import DriverRouteView from './pages/DriverRouteView';
import DriverVehicle from './pages/DriverVehicle';
import EmRota from './pages/EmRota';
import Home from './pages/Home';
import Optimizer from './pages/Optimizer';
import Relatorios from './pages/Relatorios';
import RotasEmAndamento from './pages/RotasEmAndamento';
import Veiculos from './pages/Veiculos';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Agendados": Agendados,
    "Clientes": Clientes,
    "Configuracoes": Configuracoes,
    "DriverDashboard": DriverDashboard,
    "DriverHistory": DriverHistory,
    "DriverProfile": DriverProfile,
    "DriverRouteView": DriverRouteView,
    "DriverVehicle": DriverVehicle,
    "EmRota": EmRota,
    "Home": Home,
    "Optimizer": Optimizer,
    "Relatorios": Relatorios,
    "RotasEmAndamento": RotasEmAndamento,
    "Veiculos": Veiculos,
}

export const pagesConfig = {
    mainPage: "Optimizer",
    Pages: PAGES,
    Layout: __Layout,
};