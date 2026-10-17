import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { dayKey } from '@/lib/financialDate';

/** Um único relógio diário: sem polling e com atualização ao voltar do segundo plano. */
export function useToday() {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const refresh = () => {
      const now = new Date();
      setToday(dayKey(now));
      clearTimeout(timer);
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 100);
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, []);
  return today;
}
