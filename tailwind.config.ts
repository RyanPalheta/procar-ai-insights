import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "./node_modules/@tremor/**/*.{js,ts,jsx,tsx}"],
  prefix: "",
  safelist: [
    {
      pattern:
        /^(bg|text|fill|stroke|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
      variants: ["hover", "ui-selected"],
    },
    {
      pattern:
        /^(bg|text|fill|stroke|border)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-(50|100|200|300|400|500|600|700|800|900|950)/,
      variants: ["dark", "dark:hover", "dark:ui-selected"],
    },
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		screens: {
  			'xs': '480px'
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			success: {
  				DEFAULT: 'hsl(var(--success))',
  				foreground: 'hsl(var(--success-foreground))'
  			},
  			warning: {
  				DEFAULT: 'hsl(var(--warning))',
  				foreground: 'hsl(var(--warning-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			},
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// --- Tremor (@tremor/react) design tokens ---
  			// O Tremor pinta tooltip/textos/bordas com tokens próprios (tremor-* e
  			// dark-tremor-*) que nunca foram definidos -> tooltip sem fundo e fonte
  			// escura no tema escuro. Mapeamos para as MESMAS variáveis do design
  			// system (que já alternam light/dark via .dark); por isso os dois
  			// conjuntos apontam para o mesmo hsl(var(--…)) e ficam corretos nos 2 temas.
  			tremor: {
  				brand: {
  					faint: 'hsl(var(--primary) / 0.08)',
  					muted: 'hsl(var(--primary) / 0.25)',
  					subtle: 'hsl(var(--primary) / 0.6)',
  					DEFAULT: 'hsl(var(--primary))',
  					emphasis: 'hsl(var(--primary))',
  					inverted: 'hsl(var(--primary-foreground))'
  				},
  				background: {
  					muted: 'hsl(var(--muted))',
  					subtle: 'hsl(var(--muted))',
  					DEFAULT: 'hsl(var(--card))',
  					emphasis: 'hsl(var(--foreground))'
  				},
  				border: { DEFAULT: 'hsl(var(--border))' },
  				ring: { DEFAULT: 'hsl(var(--ring))' },
  				content: {
  					subtle: 'hsl(var(--muted-foreground) / 0.7)',
  					DEFAULT: 'hsl(var(--muted-foreground))',
  					emphasis: 'hsl(var(--foreground))',
  					strong: 'hsl(var(--foreground))',
  					inverted: 'hsl(var(--background))'
  				}
  			},
  			'dark-tremor': {
  				brand: {
  					faint: 'hsl(var(--primary) / 0.08)',
  					muted: 'hsl(var(--primary) / 0.25)',
  					subtle: 'hsl(var(--primary) / 0.6)',
  					DEFAULT: 'hsl(var(--primary))',
  					emphasis: 'hsl(var(--primary))',
  					inverted: 'hsl(var(--primary-foreground))'
  				},
  				background: {
  					muted: 'hsl(var(--muted))',
  					subtle: 'hsl(var(--muted))',
  					DEFAULT: 'hsl(var(--card))',
  					emphasis: 'hsl(var(--foreground))'
  				},
  				border: { DEFAULT: 'hsl(var(--border))' },
  				ring: { DEFAULT: 'hsl(var(--ring))' },
  				content: {
  					subtle: 'hsl(var(--muted-foreground) / 0.7)',
  					DEFAULT: 'hsl(var(--muted-foreground))',
  					emphasis: 'hsl(var(--foreground))',
  					strong: 'hsl(var(--foreground))',
  					inverted: 'hsl(var(--background))'
  				}
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'tremor-small': '0.375rem',
  			'tremor-default': 'var(--radius)',
  			'tremor-full': '9999px'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		},
  		fontFamily: {
  			sans: [
  				'Inter',
  				'ui-sans-serif',
  				'system-ui',
  				'-apple-system',
  				'BlinkMacSystemFont',
  				'Segoe UI',
  				'Roboto',
  				'Helvetica Neue',
  				'Arial',
  				'sans-serif'
  			],
  			mono: [
  				'IBM Plex Mono',
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Monaco',
  				'Consolas',
  				'monospace'
  			],
  			serif: [
  				'Lora',
  				'ui-serif',
  				'Georgia',
  				'Cambria',
  				'Times New Roman',
  				'Times',
  				'serif'
  			]
  		},
  		boxShadow: {
  			'2xs': 'var(--shadow-2xs)',
  			xs: 'var(--shadow-xs)',
  			sm: 'var(--shadow-sm)',
  			md: 'var(--shadow-md)',
  			lg: 'var(--shadow-lg)',
  			xl: 'var(--shadow-xl)',
  			'2xl': 'var(--shadow-2xl)',
  			'tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  			'tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  			'tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  			'dark-tremor-input': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  			'dark-tremor-card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  			'dark-tremor-dropdown': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)'
  		},
  		fontSize: {
  			'tremor-label': '0.75rem',
  			'tremor-default': ['0.875rem', { lineHeight: '1.25rem' }],
  			'tremor-title': ['1.125rem', { lineHeight: '1.75rem' }],
  			'tremor-metric': ['1.875rem', { lineHeight: '2.25rem' }]
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
