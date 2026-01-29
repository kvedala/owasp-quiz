import { useContext } from "react";
import { MetadataContext } from "../context/MetadataContext";

export function useMetadata() {
  const context = useContext(MetadataContext);
  if (!context) {
    throw new Error("useMetadata must be used within MetadataProvider");
  }
  return context;
}
