import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PactKeeper — AI-enforced self-commitments on GenLayer',
  description:
    'Stake money on your personal promises. An AI Intelligent Contract reads your evidence from the live web and judges whether you kept your word. No human arbitrator.',
  keywords: ['commitment', 'GenLayer', 'AI', 'accountability', 'smart contract', 'blockchain'],
  openGraph: {
    title: 'PactKeeper',
    description: 'AI-enforced self-commitments on GenLayer. Stake money on your promises.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
