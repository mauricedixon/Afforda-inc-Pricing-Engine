import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import AdminLaborRates from './pages/AdminLaborRates.jsx'
import AdminMaterialPrices from './pages/AdminMaterialPrices.jsx'
import NewProject from './pages/NewProject.jsx'
import UploadBOQ from './pages/UploadBOQ.jsx'
import ReviewBOQ from './pages/ReviewBOQ.jsx'

const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      {
        path: '/pricing',
        element: <Navigate to="/pricing/new-project" replace />,
      },
      {
        path: '/pricing/new-project',
        element: <NewProject />,
      },
      {
        path: '/pricing/project/:projectId/upload',
        element: <UploadBOQ />,
      },
      {
        path: '/pricing/project/:projectId/review',
        element: <ReviewBOQ />,
      },
      {
        path: '/admin/labor-rates',
        element: <AdminLaborRates />,
      },
      {
        path: '/admin/material-prices',
        element: <AdminMaterialPrices />,
      },
      {
        path: '/pricing/project/latest/upload',
        element: <UploadBOQ useLatestProject />,
      },
      {
        path: '/pricing/project/latest/review',
        element: <ReviewBOQ useLatestProject />,
      },
    ],
  },
])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
