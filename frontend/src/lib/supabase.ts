// Lightweight in-memory Supabase-compatible client
// Used as a shim since the real backend uses Firebase/custom APIs
// No external package required - fully standalone

export type User = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type Row = Record<string, unknown>;

// In-memory store for client-side caching (real persistence via backend API)
const store: Record<string, Row[]> = {};

function getStore(table: string): Row[] {
  if (!store[table]) store[table] = [];
  return store[table];
}

function buildQuery(tableName: string) {
  let _filters: { field: string; value: unknown }[] = [];
  let _orderField: string | null = null;
  let _orderAsc = true;
  let _limitN: number | null = null;

  const self = {
    select: (_cols?: string) => self,
    eq: (field: string, value: unknown) => {
      _filters.push({ field, value });
      return self;
    },
    order: (field: string, opts?: { ascending?: boolean }) => {
      _orderField = field;
      _orderAsc = opts?.ascending !== false;
      return self;
    },
    limit: (n: number) => {
      _limitN = n;
      return self;
    },
    insert: async (data: Row | Row[]) => {
      try {
        const rows = Array.isArray(data) ? data : [data];
        const table = getStore(tableName);
        const results: Row[] = [];
        for (const row of rows) {
          const newRow: Row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
          table.push(newRow);
          results.push(newRow);
        }
        return { data: results, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
    // Make it awaitable via .then() for query chains
    then: <T>(resolve: (val: { data: Row[]; error: null }) => T, reject?: (err: unknown) => T): Promise<T> => {
      return new Promise<T>((res) => {
        try {
          let rows = [...getStore(tableName)];
          for (const f of _filters) {
            rows = rows.filter((r) => r[f.field] === f.value);
          }
          if (_orderField) {
            const field = _orderField;
            const asc = _orderAsc;
            rows.sort((a, b) => {
              const av = a[field] as string | number;
              const bv = b[field] as string | number;
              if (av < bv) return asc ? -1 : 1;
              if (av > bv) return asc ? 1 : -1;
              return 0;
            });
          }
          if (_limitN !== null) rows = rows.slice(0, _limitN);
          res(resolve({ data: rows, error: null }));
        } catch (err) {
          if (reject) res(reject(err));
          else res(resolve({ data: [], error: null }));
        }
      });
    },
  };
  return self;
}

// Simulated auth state
let _currentUser: User | null = null;
const _authListeners: Array<(event: string, session: { user: User } | null) => void> = [];

export const supabase = {
  auth: {
    getUser: async () => ({
      data: { user: _currentUser },
      error: null,
    }),
    onAuthStateChange: (
      callback: (event: string, session: { user: User } | null) => void
    ) => {
      _authListeners.push(callback);
      // Immediately notify with current state
      if (_currentUser) callback('SIGNED_IN', { user: _currentUser });
      return {
        data: {
          subscription: {
            unsubscribe: () => {
              const idx = _authListeners.indexOf(callback);
              if (idx !== -1) _authListeners.splice(idx, 1);
            },
          },
        },
      };
    },
    // Called by AuthContext to set current user
    _setUser: (user: User | null) => {
      _currentUser = user;
      const event = user ? 'SIGNED_IN' : 'SIGNED_OUT';
      _authListeners.forEach((cb) => cb(event, user ? { user } : null));
    },
  },
  from: (tableName: string) => buildQuery(tableName),
};
