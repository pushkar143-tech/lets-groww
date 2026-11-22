import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { services, type Service } from '@/data/services';

export interface ServiceOverride {
  service_id: number;
  rate_override: number | null;
  discount_percent: number;
  is_visible: boolean;
}

export interface SiteBanner {
  text: string | null;
  visible: boolean;
}

interface OverrideMap {
  rate: Map<number, number>;
  discount: Map<number, number>;
  hidden: Set<number>;
}

const emptyMap: OverrideMap = {
  rate: new Map(),
  discount: new Map(),
  hidden: new Set(),
};

export function useServiceOverrides() {
  const [overrides, setOverrides] = useState<OverrideMap>(emptyMap);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('service_overrides')
      .select('service_id, rate_override, discount_percent, is_visible');
    if (error || !data) {
      setLoading(false);
      return;
    }
    const rate = new Map<number, number>();
    const discount = new Map<number, number>();
    const hidden = new Set<number>();
    for (const row of data as ServiceOverride[]) {
      if (row.rate_override != null) rate.set(row.service_id, Number(row.rate_override));
      if (row.discount_percent > 0) discount.set(row.service_id, Number(row.discount_percent));
      if (!row.is_visible) hidden.add(row.service_id);
    }
    setOverrides({ rate, discount, hidden });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { overrides, loading };
}

export function applyOverrides(svc: Service, overrides: OverrideMap): Service & { effectiveRate: number; discounted: boolean } {
  const baseRate = overrides.rate.get(svc.id) ?? svc.ratePer1000;
  const discountPct = overrides.discount.get(svc.id) ?? 0;
  const effectiveRate = baseRate * (1 - discountPct / 100);
  return {
    ...svc,
    ratePer1000: baseRate,
    effectiveRate,
    discounted: discountPct > 0,
  };
}

export function filterVisible(allServices: Service[], hidden: Set<number>): Service[] {
  return allServices.filter((s) => !hidden.has(s.id));
}

export function useSiteBanner() {
  const [banner, setBanner] = useState<SiteBanner>({ text: null, visible: false });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('site_settings')
      .select('banner_text, banner_visible')
      .eq('id', 1)
      .maybeSingle();
    if (error || !data) {
      setLoading(false);
      return;
    }
    const row = data as { banner_text: string | null; banner_visible: boolean };
    setBanner({ text: row.banner_text, visible: row.banner_visible });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { banner, loading };
}
