import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen } from 'lucide-react';
import { ClubLogo } from '../components/ClubLogo';
import { Toast } from '../components/ui';
import { useTheme } from '../components/ThemeProvider';
import { astronBrand } from '../data/branding';
import { DesignSystem } from './DesignSystem';

export function DesignSystemWorkspace() {
  const { palette } = useTheme();
  const [toast, setToast] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((text: string) => {
    setToast(text);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(''), 3400);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <div className="guide-page">
      <a href="#guide-content" className="guide-skip">
        К содержимому
      </a>
      <header className="guide-header">
        <div className="guide-header-inner">
          <div className="guide-brand">
            <ClubLogo brand={astronBrand} />
            <span>
              <BookOpen size={15} />
              Дизайн-система
            </span>
          </div>
          <a
            className="button button-secondary guide-open-prototype"
            href={`./?theme=${palette.primary.slice(1)}#/overview?device=desktop&state=default&role=administrator`}
            target="_blank"
            rel="noopener"
          >
            Открыть прототип
            <ArrowUpRight size={15} />
          </a>
        </div>
      </header>
      <main className="guide-main" id="guide-content">
        <div className="guide-heading">
          <span className="eyebrow">ОФОРМЛЕНИЕ СИСТЕМЫ</span>
          <h1>Дизайн-система</h1>
          <p>Цвета, шрифты, логотипы и элементы интерфейса — с понятными правилами и примерами.</p>
        </div>
        <div className="guide-content">
          <DesignSystem onNotify={notify} />
        </div>
      </main>
      {toast && <Toast message={toast} />}
    </div>
  );
}
