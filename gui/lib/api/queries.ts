"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError, expectOk, unwrap, type Schemas } from "./client";
import type { Currency } from "@/lib/format";
import type { Emphasis, ProfileName } from "@/lib/labels";
import type { Freq, RangeKey } from "@/lib/store/settings";

const FROZEN = { staleTime: Infinity, gcTime: Infinity, retry: 1 } as const;

export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Retries for ~90 s so a sleeping Render free-tier instance can wake up. */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => unwrap(api.GET("/api/health")),
    refetchInterval: 60_000,
    retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 10,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
  });
}

/** Data queries wait until the backend answers health, avoiding a wall of errors during a cold start. */
function useReady(): boolean {
  return useHealth().isSuccess;
}

export function useMetadata() {
  const ready = useReady();
  return useQuery({ queryKey: ["metadata"], queryFn: () => unwrap(api.GET("/api/metadata")), enabled: ready, ...FROZEN });
}

export function useProfiles() {
  const ready = useReady();
  return useQuery({ queryKey: ["profiles"], queryFn: () => unwrap(api.GET("/api/profiles")), enabled: ready, ...FROZEN });
}

export function useFrontier() {
  const ready = useReady();
  return useQuery({ queryKey: ["frontier"], queryFn: () => unwrap(api.GET("/api/frontier")), enabled: ready, ...FROZEN });
}

export function useUniverse() {
  const ready = useReady();
  return useQuery({ queryKey: ["universe"], queryFn: () => unwrap(api.GET("/api/universe")), enabled: ready, ...FROZEN });
}

export function useCorrelation() {
  const ready = useReady();
  return useQuery({
    queryKey: ["universe", "correlation"],
    queryFn: () => unwrap(api.GET("/api/universe/correlation")),
    enabled: ready,
    ...FROZEN,
  });
}

export function usePriceHistory(range: RangeKey, freq: Freq) {
  const ready = useReady();
  return useQuery({
    queryKey: ["universe", "prices", range, freq],
    queryFn: () => unwrap(api.GET("/api/universe/prices", { params: { query: { range, freq } } })),
    enabled: ready,
    placeholderData: keepPreviousData,
    ...FROZEN,
  });
}

export type PerformanceParams = {
  amount: string;
  currency: Currency;
  range: RangeKey;
  freq: Freq;
  benchmark: boolean;
} & ({ profile: ProfileName; frontierIndex?: undefined } | { profile?: undefined; frontierIndex: number });

export function usePerformance(params: PerformanceParams, enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["performance", params],
    queryFn: () =>
      unwrap(
        api.GET("/api/performance", {
          params: {
            query: {
              amount: params.amount,
              currency: params.currency,
              range: params.range,
              freq: params.freq,
              benchmark: params.benchmark ? "equal_weight" : "none",
              ...(params.profile ? { profile: params.profile } : { frontier_index: params.frontierIndex }),
            },
          },
        }),
      ),
    enabled: ready && enabled,
    placeholderData: keepPreviousData,
    ...FROZEN,
  });
}

export type AllocationParams = Schemas["AllocateRequest"];

export function useAllocation(params: AllocationParams, enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["allocation", params],
    queryFn: () => unwrap(api.POST("/api/allocate", { body: params })),
    enabled: ready && enabled,
    placeholderData: keepPreviousData,
    ...FROZEN,
  });
}

export type BucketParams = { emphasis: Emphasis; max_volatility: number | null; min_expected_return: number | null };

export function useBuckets(params: BucketParams) {
  const ready = useReady();
  return useQuery({
    queryKey: ["buckets", params],
    queryFn: () => unwrap(api.POST("/api/buckets", { body: params })),
    enabled: ready,
    placeholderData: keepPreviousData,
    ...FROZEN,
  });
}

export type ExplainParams = Schemas["ExplainRequest"];

export function useExplain() {
  return useMutation({
    mutationFn: ({ body, signal }: { body: ExplainParams; signal?: AbortSignal }) =>
      unwrap(api.POST("/api/explain", { body, signal })),
  });
}

export function usePlans(limit = 50, offset = 0) {
  const ready = useReady();
  return useQuery({
    queryKey: ["plans", limit, offset],
    queryFn: () => unwrap(api.GET("/api/plans", { params: { query: { limit, offset } } })),
    enabled: ready,
  });
}

export function usePlan(id: string | undefined, enabled = true) {
  const ready = useReady();
  return useQuery({
    queryKey: ["plan", id],
    queryFn: () => unwrap(api.GET("/api/plans/{plan_id}", { params: { path: { plan_id: id! } } })),
    enabled: ready && !!id && enabled,
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  });
}

export function useCreatePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: Schemas["PlanCreate"]) => unwrap(api.POST("/api/plans", { body })),
    onSuccess: () => client.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useDeletePlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => expectOk(api.DELETE("/api/plans/{plan_id}", { params: { path: { plan_id: id } } })),
    onSuccess: (_data, id) => {
      // Only inactive entries: an active detail view disables its own query instead of refetching a 404.
      client.removeQueries({ queryKey: ["plan", id], type: "inactive" });
      return client.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
