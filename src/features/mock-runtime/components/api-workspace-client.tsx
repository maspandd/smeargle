"use client";

import { type Project, type ApiCredential } from "@prisma/client";
import { useState } from "react";
import { ApiOverview } from "./api-overview";
import { CredentialManager } from "./credential-manager";
import { RuntimeSettings } from "./runtime-settings";

type ApiWorkspaceClientProps = {
  project: Pick<Project, "id" | "routeKey" | "baseEndpoint" | "tokenRequired" | "corsOrigins" | "rateLimit">;
  credentials: ApiCredential[];
  canManage: boolean;
  collectionUrl: string;
  recordUrl: string;
  createTokenAction: (projectId: string, formData: FormData) => Promise<{ plaintext: string }>;
  revokeTokenAction: (projectId: string, credentialId: string) => Promise<void>;
  saveRuntimeSettingsAction: (
    projectId: string,
    settings: { corsOrigins: string[]; rateLimit: number; tokenRequired: boolean }
  ) => Promise<void>;
};

export function ApiWorkspaceClient({
  project,
  credentials,
  canManage,
  collectionUrl,
  recordUrl,
  createTokenAction,
  revokeTokenAction,
  saveRuntimeSettingsAction,
}: ApiWorkspaceClientProps) {
  const [newTokenPlaintext, setNewTokenPlaintext] = useState<string | null>(null);

  const handleCreateToken = async (label: string) => {
    const formData = new FormData();
    formData.append("label", label);
    const result = await createTokenAction(project.id, formData);
    setNewTokenPlaintext(result.plaintext);
  };

  const handleRevokeToken = async (id: string) => {
    await revokeTokenAction(project.id, id);
    if (newTokenPlaintext) setNewTokenPlaintext(null);
  };

  const handleSaveSettings = async (settings: { corsOrigins: string[]; rateLimit: number; tokenRequired: boolean }) => {
    await saveRuntimeSettingsAction(project.id, settings);
  };

  return (
    <div className="space-y-8">
      <ApiOverview project={project} collectionUrl={collectionUrl} recordUrl={recordUrl} />
      <CredentialManager
        credentials={credentials}
        canManage={canManage}
        onCreate={handleCreateToken}
        onRevoke={handleRevokeToken}
        newTokenPlaintext={newTokenPlaintext}
      />
      <RuntimeSettings
        project={project}
        canManage={canManage}
        onSave={handleSaveSettings}
      />
    </div>
  );
}
