export interface ResearchProviderRequest {
  query: string;
  regionId?: number;
  signal?: AbortSignal;
  correlationId?: string;
}

export interface SearchEvidence {
  type: "organic" | "ad" | "related";
  url: string | null;
  domain: string | null;
  title: string;
  snippet: string | null;
}

export interface WordstatEvidence {
  phrase: string;
  monthlyCount: number | null;
  association: boolean;
}

export interface ResearchProvider {
  collectYandexSerp(request: ResearchProviderRequest): Promise<SearchEvidence[]>;
  collectYandexSuggestions(request: ResearchProviderRequest): Promise<string[]>;
  collectWordstat(request: ResearchProviderRequest): Promise<WordstatEvidence[]>;
  getProviderHealth(): Promise<{ available: boolean; code: string }>;
}

export type ResearchProviderFailureCategory =
  | "PRE_REQUEST_RETRYABLE"
  | "DEFINITELY_NOT_CHARGED"
  | "AMBIGUOUS_AFTER_DISPATCH"
  | "NON_RETRYABLE";

export class ResearchProviderError extends Error {
  constructor(
    public readonly code: "PROVIDER_CONFIGURATION_MISSING" | "PROVIDER_TIMEOUT_AMBIGUOUS" | "PROVIDER_RESPONSE_TOO_LARGE" | "PROVIDER_INVALID_RESPONSE" | "PROVIDER_REJECTED",
    public readonly category: ResearchProviderFailureCategory,
  ) {
    super(code);
    this.name = "ResearchProviderError";
  }
}
