"use client";
// Modo captura: con ?capture=1 en cualquier ruta se oculta el header para
// grabar clips limpios. El disclaimer del footer se mantiene a propósito:
// en contenido público conviene que salga en pantalla.
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export function CaptureMode() {
  const params = useSearchParams();
  const on = params.get("capture") === "1";
  useEffect(() => {
    document.body.classList.toggle("capture", on);
    return () => document.body.classList.remove("capture");
  }, [on]);
  return null;
}
