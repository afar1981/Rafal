import './globals.css'

export const metadata = {
  title: 'POLSKA TRADYCJA – ZAMÓWIENIA',
  description: 'Internetowe zamówienia POLSKA TRADYCJA',
  manifest: '/manifest.json',
  icons: {
    icon: '/images/logo.png'
  }
}

export default function RootLayout({children}) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  )
}
