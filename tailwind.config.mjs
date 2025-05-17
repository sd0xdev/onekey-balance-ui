/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,svelte,js,ts}'],
	theme: {
		extend: {
			colors: {
				vwave: {
					pink: 'var(--vwave-pink)',
					cyan: 'var(--vwave-cyan)',
					mint: 'var(--vwave-mint)',
					lav: 'var(--vwave-lav)',
					sun: 'var(--vwave-sun)'
				}
			},
			fontFamily: {
				display: ['"Noto Serif SC"', 'Bodoni Moda', 'serif'],
				body: ['"Noto Sans SC"', 'Inter', 'sans-serif'],
				retro: ['"MS Gothic"', '"Press Start 2P"', 'monospace']
			},
			dropShadow: {
				glow: '0 0 6px var(--vwave-pink)'
			},
			keyframes: {
				'fade-in-up': {
					'0%': { opacity: 0, transform: 'translateY(20px)' },
					'100%': { opacity: 1, transform: 'translateY(0)' }
				}
			},
			animation: {
				'fade-up': 'fade-in-up .5s ease-out both'
			},
			boxShadow: {
				card: 'var(--card-shadow)'
			}
		}
	},
	plugins: []
};
