import { act, renderHook } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { useToday } from '../hooks/useToday';
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
it('atualiza na meia-noite e remove timer/listener ao desmontar', () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 17, 23, 59, 59));
  const remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove });
  const { result, unmount } = renderHook(() => useToday());
  expect(result.current).toBe('2026-10-17');
  act(() => jest.advanceTimersByTime(1200));
  expect(result.current).toBe('2026-10-18');
  unmount(); expect(remove).toHaveBeenCalled(); expect(jest.getTimerCount()).toBe(0);
});
it('atualiza ao retornar do segundo plano mesmo sem o timer ter executado', () => {
  jest.useFakeTimers(); jest.setSystemTime(new Date(2026, 9, 17));
  let listener: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { listener = callback; return { remove: jest.fn() }; });
  const { result } = renderHook(() => useToday());
  act(() => { jest.setSystemTime(new Date(2026, 10, 1)); listener('active'); });
  expect(result.current).toBe('2026-11-01');
});
