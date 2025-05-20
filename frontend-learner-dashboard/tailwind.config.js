/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
      "./pages/**/*.{ts,tsx}",
      "./components/**/*.{ts,tsx}",
      "./app/**/*.{ts,tsx}",
      "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
			'xs': '350px',
			'md-tablets': '769px', 
  			'2xl': '1400px'
  		}
  	},
  	extend: {
		screens: {
			'xs': '350px',
			'md-tablets': '769px',
  			'2xl': '1400px'
  		},
  		fontFamily: {
  			sans: [
  				'Open Sans',
  				'sans-serif'
  			]
  		},
  		fontSize: {
  			h1: [
  				'30px',
  				{
  					lineHeight: '38px',
  					fontWeight: '400'
  				}
  			],
  			h2: [
  				'24px',
  				{
  					lineHeight: '32px',
  					fontWeight: '400'
  				}
  			],
  			h3: [
  				'20px',
  				{
  					lineHeight: '28px',
  					fontWeight: '400'
  				}
  			],
  			title: [
  				'18px',
  				{
  					lineHeight: '26px',
  					fontWeight: '400'
  				}
  			],
  			subtitle: [
  				'16px',
  				{
  					lineHeight: '24px',
  					fontWeight: '400'
  				}
  			],
  			body: [
  				'14px',
  				{
  					lineHeight: '22px',
  					fontWeight: '400'
  				}
  			],
  			caption: [
  				'12px',
  				{
  					lineHeight: '18px',
  					fontWeight: '400'
  				}
  			],
  			'h1-semibold': [
  				'30px',
  				{
  					lineHeight: '38px',
  					fontWeight: '500'
  				}
  			],
  			'h2-semibold': [
  				'24px',
  				{
  					lineHeight: '32px',
  					fontWeight: '500'
  				}
  			],
  			'h3-semibold': [
  				'20px',
  				{
  					lineHeight: '28px',
  					fontWeight: '500'
  				}
  			]
  		},
  		fontWeight: {
  			regular: '400',
  			semibold: '500'
  		},
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				'50': 'hsl(var(--primary-50))',
  				'100': 'hsl(var(--primary-100))',
  				'200': 'hsl(var(--primary-200))',
  				'300': 'hsl(var(--primary-300))',
  				'400': 'hsl(var(--primary-400))',
  				'500': 'hsl(var(--primary-500))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
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
  			warning: {
  				'50': 'hsl(var(--warning-50))',
  				'100': 'hsl(var(--warning-100))',
  				'200': 'hsl(var(--warning-200))',
  				'300': 'hsl(var(--warning-300))',
  				'400': 'hsl(var(--warning-400))',
  				'500': 'hsl(var(--warning-500))',
  				'600': 'hsl(var(--warning-600))',
  				'700': 'hsl(var(--warning-700))'
  			},
  			success: {
  				'50': 'hsl(var(--success-50))',
  				'100': 'hsl(var(--success-100))',
  				'200': 'hsl(var(--success-200))',
  				'300': 'hsl(var(--success-300))',
  				'400': 'hsl(var(--success-400))',
  				'500': 'hsl(var(--success-500))',
  				'600': 'hsl(var(--success-600))',
  				'700': 'hsl(var(--success-700))'
  			},
  			info: {
  				'50': 'hsl(var(--info-50))',
  				'100': 'hsl(var(--info-100))',
  				'200': 'hsl(var(--info-200))',
  				'300': 'hsl(var(--info-300))',
  				'400': 'hsl(var(--info-400))',
  				'500': 'hsl(var(--info-500))',
  				'600': 'hsl(var(--info-600))',
  				'700': 'hsl(var(--info-700))'
  			},
  			danger: {
  				'50': 'hsl(var(--danger-50))',
  				'100': 'hsl(var(--danger-100))',
  				'200': 'hsl(var(--danger-200))',
  				'300': 'hsl(var(--danger-300))',
  				'400': 'hsl(var(--danger-400))',
  				'500': 'hsl(var(--danger-500))',
  				'600': 'hsl(var(--danger-600))',
  				'700': 'hsl(var(--danger-700))'
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
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
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
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
};
