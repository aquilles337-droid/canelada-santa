import type { SVGProps } from "react";

/**
 * Icones de navegacao. Tracos grossos e formas simples para continuarem
 * legiveis em tela pequena, na quadra, com pouca luz.
 */
type Props = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconeCasa = (p: Props) => (
  <Base {...p}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    <path d="M9.5 21v-6h5v6" />
  </Base>
);

export const IconeBola = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m12 7.5 3.8 2.8-1.45 4.5h-4.7L8.2 10.3 12 7.5Z" />
    <path d="M12 3v4.5M3.6 9.8l4.6.5M20.4 9.8l-4.6.5M7.2 20.2l2.45-5.4M16.8 20.2l-2.45-5.4" />
  </Base>
);

export const IconeRanking = (p: Props) => (
  <Base {...p}>
    <path d="M4 20V11h4v9M10 20V4h4v16M16 20v-6h4v6" />
    <path d="M3 20.5h18" />
  </Base>
);

export const IconePerfil = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20.5c1.2-3.8 4-5.8 7.5-5.8s6.3 2 7.5 5.8" />
  </Base>
);

export const IconeEngrenagem = (p: Props) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 14.5a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.11a1.7 1.7 0 0 0-1.11-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.11a1.7 1.7 0 0 0 1.56-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.11a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.11a1.7 1.7 0 0 0-1.49 1.5Z" />
  </Base>
);

export const IconeJogadores = (p: Props) => (
  <Base {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3 20c.9-3.3 3.2-5 6-5s5.1 1.7 6 5" />
    <path d="M16 5.2a3.2 3.2 0 0 1 0 5.9M17.5 14.6c2 .7 3.4 2.4 4 5.4" />
  </Base>
);

export const IconeDinheiro = (p: Props) => (
  <Base {...p}>
    <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
    <circle cx="12" cy="12" r="2.6" />
    <path d="M6 10v4M18 10v4" />
  </Base>
);

export const IconeCalendario = (p: Props) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="16" rx="2.5" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </Base>
);
