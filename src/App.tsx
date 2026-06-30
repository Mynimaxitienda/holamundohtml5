/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from "motion/react";
import { Code, Globe, Sparkles } from "lucide-react";

export default function App() {
  return (
    <div 
      id="app-container"
      className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col justify-between items-center p-6 md:p-12 font-sans selection:bg-neutral-200 selection:text-neutral-950 relative overflow-hidden"
    >
      {/* Decorative top grid lines/subtle elements for a modern premium feel */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e5e5_1px,transparent_1px),linear-gradient(to_bottom,#e5e5e5_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40 pointer-events-none" />

      {/* Header */}
      <header id="app-header" className="w-full max-w-xl flex justify-between items-center z-10">
        <div className="flex items-center gap-2 text-neutral-500 font-mono text-xs tracking-wider">
          <Globe className="w-4 h-4 text-neutral-400" />
          <span>EST. 2026</span>
        </div>
        <div className="flex items-center gap-1 bg-neutral-200/50 text-neutral-700 px-2.5 py-1 rounded-full text-xs font-medium border border-neutral-300/30">
          <Sparkles className="w-3 h-3 text-amber-500 fill-amber-500" />
          <span>Simple & Clean</span>
        </div>
      </header>

      {/* Main card */}
      <main id="app-main" className="flex-1 flex items-center justify-center w-full max-w-xl z-10 py-12">
        <motion.div
          id="greeting-card"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-neutral-200/80 rounded-2xl p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow duration-500 w-full relative overflow-hidden"
        >
          {/* Subtle accent corner glow */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-neutral-100 to-transparent opacity-50 rounded-tr-2xl pointer-events-none" />

          {/* HTML5 badge */}
          <div className="mb-8 flex">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-neutral-900 text-white rounded-md text-xs font-mono font-medium tracking-wide uppercase shadow-sm">
              <Code className="w-3.5 h-3.5 text-neutral-300" />
              HTML5 & CSS
            </span>
          </div>

          {/* Core Message */}
          <h1 
            id="main-greeting"
            className="text-4xl md:text-5xl font-extrabold tracking-tight text-neutral-900 leading-[1.1] mb-6 select-all font-sans"
          >
            HOLA MUNDO CON HTML5
          </h1>

          <p className="text-neutral-500 text-sm md:text-base leading-relaxed max-w-md font-sans">
            Una maqueta minimalista y moderna que demuestra la sencillez del desarrollo web con estándares modernos, tipografía elegante y un diseño enfocado en la legibilidad.
          </p>

          <div className="mt-8 pt-6 border-t border-neutral-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-neutral-400 font-mono">ESTADO: LISTO</span>
            </div>
            <span className="text-xs text-neutral-400 font-mono">v1.0.1</span>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer id="app-footer" className="w-full max-w-xl text-center z-10">
        <p className="text-xs text-neutral-400 font-mono">
          Diseñado con meticulosidad &bull; Sin distracciones
        </p>
      </footer>
    </div>
  );
}

