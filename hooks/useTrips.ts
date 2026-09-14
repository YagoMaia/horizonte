import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trip, CreateTripInput, UpdateTripInput } from '@/constants/types';

const TRIPS_STORAGE_KEY = '@horizonte:trips';

export interface UseTripsReturn {
  trips: Trip[];
  loading: boolean;
  createTrip: (input: CreateTripInput) => Promise<void>;
  updateTrip: (id: string, input: UpdateTripInput) => Promise<void>;
  deleteTrip: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

export function useTrips(): UseTripsReturn {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const writeLock = useRef<Promise<void>>(Promise.resolve());

  const loadTrips = async () => {
    try {
      setLoading(true);
      const data = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      if (data) {
        setTrips(JSON.parse(data));
      }
    } catch (e) {
      console.error('Failed to load trips', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTrips();
  }, []);

  const persist = useCallback(async (mutate: (current: Trip[]) => Trip[]) => {
    const previous = writeLock.current;
    let release!: () => void;
    writeLock.current = new Promise<void>((resolve) => { release = resolve; });
    try {
      await previous;
      const current = await AsyncStorage.getItem(TRIPS_STORAGE_KEY);
      const parsed: Trip[] = current ? JSON.parse(current) : trips;
      const next = mutate(parsed);
      await AsyncStorage.setItem(TRIPS_STORAGE_KEY, JSON.stringify(next));
      setTrips(next);
    } catch (e) {
      console.error('Failed to save trips', e);
      throw e;
    } finally {
      release();
    }
  }, [trips]);

  const createTrip = useCallback(async (input: CreateTripInput) => {
    const now = new Date().toISOString();
    const newTrip: Trip = {
      ...input,
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    await persist((current) => [...current, newTrip]);
  }, [persist]);

  const updateTrip = useCallback(async (id: string, input: UpdateTripInput) => {
    const now = new Date().toISOString();
    await persist((current) => current.map(t => t.id === id ? { ...t, ...input, updatedAt: now } : t));
  }, [persist]);

  const deleteTrip = useCallback(async (id: string) => {
    await persist((current) => current.filter(t => t.id !== id));
  }, [persist]);

  const clearAll = useCallback(async () => {
    await persist(() => []);
  }, [persist]);

  return {
    trips,
    loading,
    createTrip,
    updateTrip,
    deleteTrip,
    clearAll,
  };
}
