"use client";

import { useEffect, useState } from "react";

type Props = {
  src: string | null | undefined;
  alt: string;
  className?: string;
  /** Emoji ou símbolo quando a imagem falha (evita letras soltas) */
  fallbackChar?: string;
};

/**
 * Imagens de inventário Steam vêm de muitos domínios; <Image> com domínio não listado quebra.
 * Usa <img> nativo + fallback suave.
 */
export function RemoteInventoryImage({ src, alt, className = "", fallbackChar = "◆" }: Props) {
  const [bad, setBad] = useState(!src);
  useEffect(() => {
    setBad(!src);
  }, [src]);
  if (bad) {
    return (
      <div
        className={`flex h-full w-full min-h-[3rem] items-center justify-center bg-gradient-to-b from-slate-700/50 to-slate-900/80 text-slate-500 ${className}`}
        title={alt}
        aria-hidden
      >
        <span className="text-2xl font-light opacity-40 select-none">{fallbackChar}</span>
      </div>
    );
  }
  return (
    <img
      src={src!}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setBad(true)}
    />
  );
}
