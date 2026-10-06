import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  initializeMicrosoftClarity,
  normalizeClarityProjectId,
  type ClarityEnvironment
} from "./clarityCore";

const clarityEnvironment: ClarityEnvironment = {
  runtime: window as unknown as ClarityEnvironment["runtime"],
  hasScript: (id) => Boolean(document.getElementById(id)),
  appendScript: ({ id, src }) => {
    const script = document.createElement("script");
    script.id = id;
    script.async = true;
    script.src = src;
    script.referrerPolicy = "no-referrer";
    document.head.append(script);
  }
};

export function MicrosoftClarity() {
  const location = useLocation();
  const configuredValue: unknown = import.meta.env.VITE_CLARITY_PROJECT_ID;
  const projectId = normalizeClarityProjectId(
    typeof configuredValue === "string" ? configuredValue : undefined
  );

  useEffect(() => {
    initializeMicrosoftClarity(projectId, location.pathname, clarityEnvironment);
  }, [location.pathname, projectId]);

  return null;
}
