declare module "@upstash/context7-mcp/dist/lib/api.js" {
  export function searchLibraries(query: string, libraryName: string, context?: { apiKey?: string }): Promise<unknown>;
  export function fetchLibraryContext(request: { query: string; libraryId: string }, context?: { apiKey?: string }): Promise<unknown>;
}
