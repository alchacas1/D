'use client';
import React, { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check as CheckIcon,
  Copy as CopyIcon,
  Trash as TrashIcon,
  AlertCircle as AlertIcon, ScanBarcode,
  Loader2 as LoaderIcon,
  Lock as LockIcon,
} from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { BarcodeScannerProps } from '../types/barcode';
import CameraScanner from './CameraScanner';
import ImageDropArea from './ImageDropArea';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';

export default function BarcodeScanner({ onDetect, onRemoveLeadingZero, children }: BarcodeScannerProps & { onRemoveLeadingZero?: (code: string) => void; children?: React.ReactNode }) {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'image' | 'camera'>('image');
















  const {
    code,
    isLoading,
    error,
    imagePreview,
    copySuccess,
    detectionMethod,
    cameraActive,
    fileInputRef,
    liveStreamRef,
    handleFileUpload,
    handleDrop,
    handleDropAreaClick,
    handleClear,
    handleCopyCode,
    toggleCamera,
    processImage,
    setCode, } = useBarcodeScanner(onDetect);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus automático al montar para que onPaste funcione siempre
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Handler global para pegar imagen desde portapapeles
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.items) {
        for (let i = 0; i < event.clipboardData.items.length; i++) {
          const item = event.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const imageSrc = (e.target as FileReader)?.result as string;
                processImage(imageSrc);
              };
              reader.readAsDataURL(file);
              event.preventDefault();
              break;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [processImage]);  // Handler para eliminar primer dígito del código escaneado principal
  const handleRemoveLeadingZeroMain = useCallback(() => {
    if (code && code.length > 1 && code[0] === '0') {
      setCode(code.slice(1)); // update overlay code immediately
      onRemoveLeadingZero?.(code);
    }
  }, [code, setCode, onRemoveLeadingZero]);





  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } };
  const slideUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  // Verificar si el usuario tiene permiso para usar el escáner
  if (!hasPermission(user?.permissions, 'scanner')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Escáner de Códigos de Barras.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto flex flex-col gap-10 p-8 md:p-12 rounded-3xl shadow-2xl transition-colors duration-500 bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] backdrop-blur-xl"
      tabIndex={0}
    >
      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <button
          className={`px-6 py-2 rounded-l-xl font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-900 ${activeTab === 'image' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/80 dark:bg-zinc-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'}`}
          onClick={() => setActiveTab('image')}
        >
          Imagen / Pegar
        </button>
        <button
          className={`px-6 py-2 rounded-r-xl font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-900 ${activeTab === 'camera' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/80 dark:bg-zinc-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'}`}
          onClick={() => setActiveTab('camera')}
        >
          Cámara
        </button>

      </div>
      {/* Contenido de cada tab */}
      {activeTab === 'image' && (
        <div>
          {/* Icono ScanBarcode destacado */}
          <div className="flex flex-col items-center gap-4 mb-2">
            <div className="p-6 rounded-full bg-gradient-to-tr from-indigo-500 via-blue-400 to-cyan-300 dark:from-indigo-700 dark:via-indigo-900 dark:to-blue-900 text-white shadow-2xl border-4 border-white/80 dark:border-indigo-900 animate-pulse-slow">
              <ScanBarcode className="w-16 h-16 drop-shadow-lg" />
            </div>
            <h2 className="text-2xl font-extrabold text-zinc-800 dark:text-indigo-300 tracking-tight mb-1">Escáner de Códigos de Barras</h2>
          </div>

          {/* Mensaje de "Código copiado" */}
          <AnimatePresence>
            {copySuccess && (
              <motion.div
                {...fadeIn}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="fixed top-8 right-8 z-50 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 bg-gradient-to-r from-green-400 to-green-600 text-white font-bold text-lg animate-bounce backdrop-blur-xl border-2 border-green-200 dark:border-green-800"
              >
                <CheckIcon className="w-6 h-6" />
                ¡Código copiado!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card de código detectado con preview de imagen de fondo mejorada y mensaje de éxito unificado */}
          {imagePreview && (
            <motion.div {...slideUp} transition={{ duration: 0.5 }} className="mb-2 flex justify-center w-full items-center">
              <div className="w-full max-w-md relative rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-700 bg-white dark:bg-transparent min-h-[220px] flex items-center justify-center">
                {/* Imagen de fondo SIEMPRE visible si hay imagePreview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-contain z-0"
                  style={{ filter: 'brightness(0.92)' }}
                />
                {/* Overlay sutil para contraste */}
                <div className="absolute inset-0 bg-white/60 dark:bg-black/50 z-10" />
                {/* Código de barras y acciones, overlay centrado */}
                {code && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                    {/* Mensaje de éxito y código detectado juntos */}
                    <div className="flex flex-col items-center w-full gap-2">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <CheckIcon className="w-7 h-7 text-green-300 drop-shadow" />
                        <span className="text-lg font-bold text-white drop-shadow">¡Código detectado y copiado!</span>
                      </div>
                      <div
                        className="w-full text-center font-mono text-3xl md:text-4xl tracking-widest text-white select-all px-2 bg-transparent whitespace-nowrap overflow-x-auto"
                        style={{ letterSpacing: '0.12em', maxWidth: '100%', userSelect: 'all', WebkitUserSelect: 'all', overflowY: 'hidden', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
                        tabIndex={0}
                        title={code}
                      >
                        {code}
                      </div>
                      <div className="flex gap-6 mt-2 justify-center">
                        <button
                          onClick={handleRemoveLeadingZeroMain}
                          className="group p-3 rounded-full bg-white/20 hover:bg-white/30 text-white shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700"
                          title="Eliminar primer dígito"
                          aria-label="Eliminar primer dígito"
                        >
                          <svg className="w-7 h-7 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <button
                          onClick={handleCopyCode}
                          className="group p-3 rounded-full bg-white/20 hover:bg-white/30 text-white shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700"
                          title="Copiar código"
                          aria-label="Copiar código"
                        >
                          <CopyIcon className="w-7 h-7 group-hover:scale-110 transition-transform duration-200" color="white" />
                        </button>
                      </div>
                      {detectionMethod && (
                        <span className="mt-2 inline-block text-xs font-semibold text-indigo-700 dark:text-indigo-200 bg-indigo-100/80 dark:bg-indigo-900/60 px-3 py-1 rounded-full shadow">
                          Método: {detectionMethod}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {/* Botón "Limpiar Todo" debajo del preview */}
          <AnimatePresence>
            {(code || error || imagePreview) && (
              <motion.div key="clear" {...slideUp} transition={{ duration: 0.5 }} className="flex justify-center mb-6">
                <button
                  onClick={handleClear}
                  className="px-7 py-3 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-300 bg-gradient-to-r from-zinc-200 to-red-200 dark:from-zinc-800 dark:to-red-900 text-zinc-800 dark:text-zinc-100 hover:bg-red-500 hover:text-white font-bold shadow-lg"
                >
                  <TrashIcon className="w-5 h-5 inline-block mr-2" />
                  Limpiar Todo
                </button>
              </motion.div>
            )}
          </AnimatePresence>          {/* Área de carga de imagen */}
          <motion.div {...slideUp} transition={{ duration: 0.5 }}>
            <ImageDropArea
              onDrop={handleDrop}
              onFileSelect={handleDropAreaClick}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
            />
          </motion.div>
          {/* Spinner mientras procesa imagen */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                key="spinner"
                {...fadeIn}
                transition={{ duration: 0.3 }}
                className="text-center p-6 rounded-2xl flex items-center justify-center gap-4 bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-950 text-indigo-700 dark:text-indigo-200 shadow-xl border-2 border-indigo-200 dark:border-indigo-800"
              >
                <LoaderIcon className="w-10 h-10 animate-spin" />
                <p className="font-bold text-lg">Procesando imagen...</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Mensaje de error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                {...fadeIn}
                transition={{ duration: 0.3 }}
                className="text-center text-red-700 dark:text-red-300 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-950 p-6 rounded-2xl flex flex-col items-center gap-3 border-2 border-red-200 dark:border-red-800 shadow-xl"
              >
                <AlertIcon className="w-7 h-7" />
                <p className="text-base font-bold">{error}</p>
                <button
                  onClick={handleClear}
                  className="mt-2 text-sm bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700 px-4 py-2 rounded-xl transition-colors duration-300 font-bold shadow"
                >
                  Intentar de nuevo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}      {activeTab === 'camera' && (
        <CameraScanner
          code={code}
          error={error}
          detectionMethod={detectionMethod}
          cameraActive={cameraActive}
          liveStreamRef={liveStreamRef}
          toggleCamera={toggleCamera}
          handleClear={handleClear}
          handleCopyCode={handleCopyCode}
          onRemoveLeadingZero={handleRemoveLeadingZeroMain}
        />
      )}



      {children}
    </div>
  );
}
