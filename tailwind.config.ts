import type { Config } from 'tailwindcss';

// Colour tokens measured directly (computed CSS, not eyeballed) from the client-approved
// reference design at https://nicta-governance-portal.robertson-asari.chatgpt.site — see
// docs/mvp-directors-portal-plan.md#branding for the extraction method and
// docs/assumptions-and-decisions.md#A17. These are pixel-accurate to that reference, not an
// approximation.
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        nicta: {
          teal: {
            DEFAULT: '#004F5B', // primary interactive teal — links, active tab, avatar, "View" buttons
            dark: '#153C44', // darkest heading/body text colour (a teal-tinted near-black, not neutral gray)
            mid: '#007B7B', // CTA banner gradient middle stop
            light: '#E5F4F2', // pale teal pill background (info-tone badges)
          },
          turquoise: {
            DEFAULT: '#00AAA1', // eyebrow labels, CTA banner gradient bright stop, top strip gradient
          },
          charcoal: {
            DEFAULT: '#27343A', // solid dark buttons ("Upload SMC paper", "Submit to SMC")
          },
          neutral: {
            50: '#F4F7F7', // page background
            100: '#EEF3F3',
            200: '#E1E8E7',
            700: '#496B70', // muted/secondary text (inactive tab, subtitles)
            900: '#153C44',
          },
          cream: {
            DEFAULT: '#FBF3E7', // warm dashboard content-area background (#A26) — distinct from neutral-50, which stays the plain-page default
          },
          sand: {
            DEFAULT: '#C9AF7F', // warm accent for the login hero panel — original tone, not sampled from any client asset
            dark: '#A9905F',
          },
        },
        status: {
          // Pastel background + solid text pairs, matched to the reference's status pills.
          warning: { DEFAULT: '#A96524', bg: '#FFF0DF' }, // "Submitted to SMC"
          success: { DEFAULT: '#247A59', bg: '#E4F4ED' }, // "Vetted for Board"
          danger: { DEFAULT: '#B42318', bg: '#FBE7E5' }, // "Returned for Correction" (not in reference; extrapolated to match the pill style)
          info: { DEFAULT: '#004F5B', bg: '#E5F4F2' }, // "Current meeting" / neutral pill
          accent: '#F2A452', // notification badge orange
        },
      },
      fontFamily: {
        sans: ['Arial', 'Helvetica', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'nicta-strip': 'linear-gradient(90deg, #00AAA1, #004F5B)',
        'nicta-banner': 'linear-gradient(100deg, #004F5B, #007B7B 68%, #00AAA1)',
        'nicta-hero': 'linear-gradient(160deg, #153C44 0%, #004F5B 55%, #00AAA1 100%)',
        'nicta-hero-panel': 'linear-gradient(155deg, #C9AF7F 0%, #A9905F 55%, #7A6B45 100%)',
      },
    },
  },
  plugins: [],
};

export default config;
