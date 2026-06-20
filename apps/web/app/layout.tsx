import type { Metadata } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';
import { ToasterProvider } from '@/components/ToasterProvider';

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
});

export const metadata: Metadata = {
  title: 'Pinguin BOAT — Forgé pour la communauté',
  description: 'Dashboard de gestion du bot Discord Pinguin BOAT',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={jetbrainsMono.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{
var T={OLED:{background:'#000000',surface:'#0d0d0d',surfaceAlt:'#1a1a1a',border:'#1f1f1f',text:'#f5f5f5',textSecondary:'#888888',accent:'#e0e0e0',accentHover:'#ffffff',success:'#22c55e',warning:'#f59e0b',error:'#ef4444',info:'#3b82f6',sidebar:'#050505',sidebarActive:'#1a1a1a',header:'#050505',toggleOff:'#404040',toggleThumb:'#e0e0e0'},DARK:{background:'#111111',surface:'#1a1a1a',surfaceAlt:'#242424',border:'#2a2a2a',text:'#e5e5e5',textSecondary:'#888888',accent:'#ffffff',accentHover:'#cccccc',success:'#22c55e',warning:'#f59e0b',error:'#ef4444',info:'#3b82f6',sidebar:'#0d0d0d',sidebarActive:'#242424',header:'#0d0d0d',toggleOff:'#525252',toggleThumb:'#d4d4d4'},LIGHT:{background:'#f5f5f5',surface:'#ffffff',surfaceAlt:'#f0f0f0',border:'#e0e0e0',text:'#111111',textSecondary:'#666666',accent:'#000000',accentHover:'#333333',success:'#16a34a',warning:'#d97706',error:'#dc2626',info:'#2563eb',sidebar:'#ffffff',sidebarActive:'#e8e8e8',header:'#ffffff',toggleOff:'#d4d4d4',toggleThumb:'#ffffff'},CATPPUCCIN:{background:'#1e1e2e',surface:'#181825',surfaceAlt:'#1e1e2e',border:'#313244',text:'#cdd6f4',textSecondary:'#6c7086',accent:'#cba6f7',accentHover:'#b4befe',success:'#a6e3a1',warning:'#f9e2af',error:'#f38ba8',info:'#89b4fa',sidebar:'#11111b',sidebarActive:'#313244',header:'#11111b',toggleOff:'#525252',toggleThumb:'#cdd6f4'},NORD:{background:'#2e3440',surface:'#3b4252',surfaceAlt:'#434c5e',border:'#4c566a',text:'#eceff4',textSecondary:'#81a1c1',accent:'#88c0d0',accentHover:'#8fbcbb',success:'#a3be8c',warning:'#ebcb8b',error:'#bf616a',info:'#5e81ac',sidebar:'#2e3440',sidebarActive:'#434c5e',header:'#2e3440',toggleOff:'#525252',toggleThumb:'#eceff4'},DRACULA:{background:'#282a36',surface:'#21222c',surfaceAlt:'#282a36',border:'#44475a',text:'#f8f8f2',textSecondary:'#6272a4',accent:'#bd93f9',accentHover:'#ff79c6',success:'#50fa7b',warning:'#f1fa8c',error:'#ff5555',info:'#8be9fd',sidebar:'#1c1d26',sidebarActive:'#44475a',header:'#1c1d26',toggleOff:'#525252',toggleThumb:'#f8f8f2'},GRUVBOX:{background:'#282828',surface:'#1d2021',surfaceAlt:'#282828',border:'#3c3836',text:'#ebdbb2',textSecondary:'#928374',accent:'#fabd2f',accentHover:'#fe8019',success:'#b8bb26',warning:'#fabd2f',error:'#fb4934',info:'#83a598',sidebar:'#1b1b1b',sidebarActive:'#3c3836',header:'#1b1b1b',toggleOff:'#525252',toggleThumb:'#ebdbb2'},TOKYO_NIGHT:{background:'#1a1b26',surface:'#1f2335',surfaceAlt:'#24283b',border:'#2f3346',text:'#c0caf5',textSecondary:'#565f89',accent:'#7aa2f7',accentHover:'#bb9af7',success:'#9ece6a',warning:'#e0af68',error:'#f7768e',info:'#73daca',sidebar:'#13141f',sidebarActive:'#2f3346',header:'#13141f',toggleOff:'#525252',toggleThumb:'#c0caf5'},ROSE_PINE:{background:'#191724',surface:'#1f1d2e',surfaceAlt:'#26233a',border:'#2a273f',text:'#e0def4',textSecondary:'#908caa',accent:'#eb6f92',accentHover:'#f6c177',success:'#9ccfd8',warning:'#f6c177',error:'#eb6f92',info:'#31748f',sidebar:'#13111e',sidebarActive:'#26233a',header:'#13111e',toggleOff:'#525252',toggleThumb:'#e0def4'},MONOKAI:{background:'#272822',surface:'#1e1f1c',surfaceAlt:'#272822',border:'#3e3d32',text:'#f8f8f2',textSecondary:'#75715e',accent:'#a6e22e',accentHover:'#66d9ef',success:'#a6e22e',warning:'#e6db74',error:'#f92672',info:'#66d9ef',sidebar:'#1b1c18',sidebarActive:'#3e3d32',header:'#1b1c18',toggleOff:'#525252',toggleThumb:'#f8f8f2'}};
T.GOLD={background:'#1a1500',surface:'#221c00',surfaceAlt:'#2e2500',border:'#3d3100',text:'#f5d060',textSecondary:'#a08a30',accent:'#ffd700',accentHover:'#ffe066',success:'#a6e22e',warning:'#f59e0b',error:'#ef4444',info:'#60a5fa',sidebar:'#120f00',sidebarActive:'#2e2500',header:'#120f00',toggleOff:'#525252',toggleThumb:'#f5d060'};
T.AURORA={background:'#0d0d1a',surface:'#12122b',surfaceAlt:'#1a1a3a',border:'#2a2a4a',text:'#e0e8ff',textSecondary:'#7080b0',accent:'#a78bfa',accentHover:'#34d399',success:'#34d399',warning:'#fbbf24',error:'#f87171',info:'#60a5fa',sidebar:'#08081a',sidebarActive:'#1a1a3a',header:'#08081a',toggleOff:'#525252',toggleThumb:'#e0e8ff'};
T.CRIMSON={background:'#130808',surface:'#1c0a0a',surfaceAlt:'#2a0e0e',border:'#3d1515',text:'#fce4e4',textSecondary:'#a06060',accent:'#dc2626',accentHover:'#ef4444',success:'#4ade80',warning:'#fbbf24',error:'#ff6b6b',info:'#60a5fa',sidebar:'#0d0505',sidebarActive:'#2a0e0e',header:'#0d0505',toggleOff:'#525252',toggleThumb:'#fce4e4'};
T.SYNTHWAVE={background:'#1a0533',surface:'#1f0a3d',surfaceAlt:'#2b0f52',border:'#3d1a6e',text:'#f0c6ff',textSecondary:'#a066cc',accent:'#ff71ce',accentHover:'#01cdfe',success:'#05ffa1',warning:'#fffb96',error:'#ff4488',info:'#01cdfe',sidebar:'#12022a',sidebarActive:'#2b0f52',header:'#12022a',toggleOff:'#525252',toggleThumb:'#f0c6ff'};
T.EVERFOREST={background:'#2d353b',surface:'#272e33',surfaceAlt:'#2d353b',border:'#3d4f55',text:'#d3c6aa',textSecondary:'#859289',accent:'#a7c080',accentHover:'#83c092',success:'#a7c080',warning:'#dbbc7f',error:'#e67e80',info:'#7fbbb3',sidebar:'#232a2e',sidebarActive:'#3d4f55',header:'#232a2e',toggleOff:'#525252',toggleThumb:'#d3c6aa'};
T.COBALT={background:'#193549',surface:'#122738',surfaceAlt:'#1f4662',border:'#1f4662',text:'#ffffff',textSecondary:'#8dbdd8',accent:'#ffc600',accentHover:'#ffda44',success:'#3ad900',warning:'#ffc600',error:'#ff2020',info:'#80fcff',sidebar:'#0d2535',sidebarActive:'#1f4662',header:'#0d2535',toggleOff:'#525252',toggleThumb:'#ffffff'};
var n=localStorage.getItem('pinguin-theme')||'DARK';
var c=T[n]||T.DARK;
var s=document.createElement('style');s.id='theme-variables';
s.textContent=':root{--bg-primary:'+c.background+';--bg-surface:'+c.surface+';--bg-surface-alt:'+c.surfaceAlt+';--bg-sidebar:'+c.sidebar+';--bg-sidebar-active:'+c.sidebarActive+';--bg-header:'+c.header+';--border-color:'+c.border+';--text-primary:'+c.text+';--text-secondary:'+c.textSecondary+';--accent:'+c.accent+';--accent-hover:'+c.accentHover+';--success:'+c.success+';--warning:'+c.warning+';--error:'+c.error+';--info:'+c.info+';--toggle-bg-off:'+c.toggleOff+';--toggle-thumb:'+c.toggleThumb+';--radius:0px;--radius-sm:0px;--radius-lg:0px}';
document.head.appendChild(s);
}catch(e){}})();` }} />
      </head>
      <body style={{ fontFamily: 'var(--font-jetbrains), monospace' }}>
        <Providers>
          {children}
          <ToasterProvider />
        </Providers>
      </body>
    </html>
  );
}
