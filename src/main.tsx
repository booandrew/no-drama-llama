import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { TooltipProvider } from '@/components/ui/tooltip'
import { DuckDBProvider } from '@/lib/duckdb'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <DuckDBProvider>
        <TooltipProvider>
          <App />
        </TooltipProvider>
      </DuckDBProvider>
    </ThemeProvider>
  </StrictMode>,
)
