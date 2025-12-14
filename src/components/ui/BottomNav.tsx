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
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e5e7eb',
        boxShadow: '0 -1px 3px 0 rgba(0, 0, 0, 0.1)',
        visibility: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
          fontSize: '12px',
          height: '64px',
          alignItems: 'center',
          padding: '0 4px',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderTop: effectiveView === t.key ? '2px solid #000000' : 'none',
              color: effectiveView === t.key ? '#000000' : '#9ca3af',
              fontWeight: effectiveView === t.key ? 600 : 400,
              cursor: 'pointer',
              padding: '4px',
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
