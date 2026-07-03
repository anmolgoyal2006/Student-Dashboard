/** @type {import('tailwindcss').Config} */
module.exports = {
  // Only generate classes for files that actually use them
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './public/index.html',
  ],

  // Disable Tailwind's preflight so it NEVER resets our existing CSS
  corePlugins: {
    preflight: false,
  },

  theme: {
    extend: {
      /* ── Uizard Colors ── */
      colors: {
        'violet-glow':  '#a881fe',
        'deep-iris':    '#6419ff',
        'soft-lilac':   '#ccb2ff',
        'signal-blue':  '#1e90ff',
        obsidian:       '#0b0b0b',
        'void-black':   '#000000',
        graphite:       '#2e2e2e',
        carbon:         '#212121',
        slate:          '#525252',
        frost:          '#f5f5f5',
        'pure-white':   '#ffffff',
        pewter:         '#aeaeae',
        // semantic aliases
        accent:         '#a881fe',
        canvas:         '#0b0b0b',
        'surface-0':    '#0b0b0b',
        'surface-1':    '#111111',
        'surface-2':    '#0f0f0f',
        'surface-3':    '#1a1a1a',
      },

      /* ── Typography ── */
      fontFamily: {
        satoshi:  ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        display:  ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontWeight: {
        regular: '400',
        w480:    '480',
        w540:    '540',
        w560:    '560',
        w640:    '640',
      },
      fontSize: {
        caption:      ['12px', { lineHeight: '1.38', letterSpacing: '-0.3px' }],
        'body-sm':    ['14px', { lineHeight: '1.43', letterSpacing: '-0.154px' }],
        body:         ['16px', { lineHeight: '1.4',  letterSpacing: '-0.128px' }],
        subheading:   ['18px', { lineHeight: '1.33', letterSpacing: '-0.126px' }],
        'heading-sm': ['20px', { lineHeight: '1.29', letterSpacing: '-0.12px' }],
        heading:      ['24px', { lineHeight: '1.25', letterSpacing: '-0.12px' }],
        'heading-lg': ['40px', { lineHeight: '1.2',  letterSpacing: '-1px' }],
        display:      ['72px', { lineHeight: '1',    letterSpacing: '-0.576px' }],
      },

      /* ── Spacing ── */
      spacing: {
        '4':   '4px',
        '8':   '8px',
        '12':  '12px',
        '16':  '16px',
        '20':  '20px',
        '24':  '24px',
        '32':  '32px',
        '40':  '40px',
        '48':  '48px',
        '64':  '64px',
        '120': '120px',
      },

      /* ── Border Radius ── */
      borderRadius: {
        cards:   '16px',
        pills:   '9999px',
        inputs:  '8px',
        buttons: '12px',
        sm:      '6px',
        md:      '8px',
        lg:      '12px',
        xl:      '16px',
        '2xl':   '20px',
        '3xl':   '28px',
      },

      /* ── Box Shadow ── */
      boxShadow: {
        'violet-glow': 'rgba(168, 129, 254, 0.64) 0px 2px 12px 0px, rgb(168, 129, 254) 0px 1px 1px 0px inset',
        'panel':       'rgba(3, 3, 3, 0.12) 0px 12px 30px -4px',
        'card':        'rgba(3, 3, 3, 0.35) 0px 1px 8px',
        'none':        'none',
      },

      /* ── Max Width ── */
      maxWidth: {
        page: '1200px',
      },

      /* ── Background Image (hero bloom) ── */
      backgroundImage: {
        'hero-bloom':    'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(204,178,255,0.18) 0%, rgba(100,25,255,0.12) 40%, transparent 73%)',
        'deep-iris':     'linear-gradient(0deg, rgb(100,25,255), rgb(168,129,254))',
        'soft-lilac':    'linear-gradient(189.47deg, rgb(204,178,255) 4.76%, rgb(100,25,255) 92.85%)',
      },
    },
  },

  plugins: [],
};
