import { createContext, useState, useEffect } from "react";

export const MetadataContext = createContext(null);

export function MetadataProvider({ children }) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const res = await fetch("/api/metadata");
        if (!res.ok) throw new Error("Failed to load metadata");
        const data = await res.json();
        setMetadata(data || {});
      } catch (err) {
        console.error("Error loading metadata:", err);
        // Provide safe defaults if metadata fails to load
        setMetadata({
          title: "OWASP Security Quiz",
          license: "CC BY-SA 4.0",
          sources: {
            about: "https://cheatsheetseries.owasp.org"
          }
        });
      } finally {
        setLoading(false);
      }
    }

    fetchMetadata();
  }, []);

  return (
    <MetadataContext.Provider value={{ metadata, loading, error }}>
      {children}
    </MetadataContext.Provider>
  );
}
