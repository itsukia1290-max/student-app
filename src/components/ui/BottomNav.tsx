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
      } catch (e) {
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
      ref={navRef as any}
      className="fixed inset-x-0 bottom-0 z-50 bg-white border-t shadow-md backdrop-blur/0"
      style={{ visibility: 'hidden' }}
    >
      <div
        className={`grid ${tabs.length === 6 ? 'grid-cols-6' : tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} text-xs h-16 items-center px-1 pb-[env(safe-area-inset-bottom)]`}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setView(t.key)}
            className={`h-full flex flex-col items-center justify-center text-center ${
              effectiveView === t.key ? 'text-black font-semibold border-t-2 border-black' : 'text-gray-500'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </nav>,
    document.body
  );
}
