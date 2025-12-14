import { useEffect } from 'react';
import ReactDOM from 'react-dom';

type View = 'home' | 'mypage' | 'chat' | 'dm' | 'students';

export default function BottomNav({
  tabs,
  effectiveView,
  setView,
}: {
  tabs: { key: View; label: string }[];
  effectiveView: View;
  setView: (v: View) => void;
}) {
  useEffect(() => {
    // nothing yet, but kept for later if we need to manage a container element
    return () => {};
  }, []);

  if (typeof document === 'undefined') return null;

  return ReactDOM.createPortal(
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-50 bg-white border-t shadow-md backdrop-blur/0">
      <div
        className={`grid ${tabs.length === 5 ? 'grid-cols-5' : 'grid-cols-4'} text-xs h-16 items-center px-1 pb-[env(safe-area-inset-bottom)]`}
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
