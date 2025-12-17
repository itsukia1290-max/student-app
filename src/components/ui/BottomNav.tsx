import { useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';

type View = 'home' | 'mypage' | 'chat' | 'dm' | 'students' | 'schoolCalendar';

export default function BottomNav({
  tabs,
  effectiveView,
  setView,
}: {
  tabs: { key: View; label: string }[];
  effectiveView: View;
  setView: (v: View) => void;
}) {
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    function setBottom() {
      if (!navRef.current) return;
      // Reset bottom to 0 to override any layout/resizing quirks
      navRef.current.style.bottom = '0px';
      navRef.current.style.visibility = 'visible';
      // Ensure the body has enough bottom padding so content doesn't go under nav
      try {
        const navHeight = navRef.current.getBoundingClientRect().height;
        document.body.style.paddingBottom = `${navHeight}px`;
      } catch {
        // ignoring in environments without document
      }
    }

    setBottom();
    window.addEventListener('resize', setBottom);
    window.addEventListener('orientationchange', setBottom);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', setBottom);
      window.visualViewport.addEventListener('scroll', setBottom);
    }
    return () => {
      window.removeEventListener('resize', setBottom);
      window.removeEventListener('orientationchange', setBottom);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', setBottom);
        window.visualViewport.removeEventListener('scroll', setBottom);
      }
      // reset body padding
      document.body.style.paddingBottom = '';
    };
  }, []);

  if (typeof document === 'undefined') return null;

    return ReactDOM.createPortal(
    <nav
      ref={(el) => { navRef.current = el; }}
      className="fixed inset-x-0 bottom-0 z-50 border-t shadow-md"
      style={{ visibility: 'hidden', backgroundColor: '#ffffff', opacity: 1 }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          fontSize: '0.75rem',
          height: '4rem',
          alignItems: 'center',
          paddingLeft: '0.25rem',
          paddingRight: '0.25rem',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className="h-full flex flex-col items-center justify-center text-center"
            style={{
              color: effectiveView === t.key ? '#3b82f6' : '#6b7280',
              fontWeight: effectiveView === t.key ? '600' : 'normal',
              borderTop: effectiveView === t.key ? '2px solid #3b82f6' : 'none',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>,
    document.body
  );
}
