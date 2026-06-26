import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiOverview } from "./api-overview";
import { CredentialManager } from "./credential-manager";
import { RuntimeSettings } from "./runtime-settings";

const mockProject = {
  id: "proj_123",
  name: "Test API",
  routeKey: "test_key",
  baseEndpoint: "/api/test",
  tokenRequired: true,
  corsOrigins: ["https://example.com"],
  rateLimit: 100,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockCredentials = [
  {
    id: "cred_1",
    label: "Test Token",
    tokenHash: "hashed123",
    projectId: "proj_123",
    lastUsedAt: null,
    createdAt: new Date(),
    expiresAt: null,
    revokedAt: null,
  },
];

describe("Mock API Workspace Components", () => {
  describe("ApiOverview", () => {
    it("renders exact collection and record URLs and cURL examples", () => {
      render(
        <ApiOverview
          project={mockProject}
          collectionUrl="https://api.mockdata.com/api/mock/test_key/api/test"
          recordUrl="https://api.mockdata.com/api/mock/test_key/api/test/:id"
        />
      );
      
      expect(screen.getByText("https://api.mockdata.com/api/mock/test_key/api/test")).toBeVisible();
      expect(screen.getByText("https://api.mockdata.com/api/mock/test_key/api/test/:id")).toBeVisible();
      expect(screen.getByText(/curl -X GET/)).toBeVisible();
      expect(screen.getByText(/Authorization: Bearer/)).toBeVisible();
    });

    it("shows methods for collection and record", () => {
      render(
        <ApiOverview
          project={mockProject}
          collectionUrl="https://api.mockdata.com/api/mock/test_key/api/test"
          recordUrl="https://api.mockdata.com/api/mock/test_key/api/test/:id"
        />
      );
      expect(screen.getAllByText("GET").length).toBe(2);
      expect(screen.getByText("POST")).toBeVisible();
      expect(screen.getByText("PUT")).toBeVisible();
      expect(screen.getByText("PATCH")).toBeVisible();
      expect(screen.getByText("DELETE")).toBeVisible();
    });
  });

  describe("CredentialManager", () => {
    it("renders credentials and handles creation", async () => {
      const onCreate = vi.fn();
      const onRevoke = vi.fn();
      const user = userEvent.setup();
      
      render(
        <CredentialManager
          credentials={mockCredentials}
          canManage={true}
          onCreate={onCreate}
          onRevoke={onRevoke}
          newTokenPlaintext={null}
        />
      );

      expect(screen.getByText("Test Token")).toBeVisible();
      
      await user.type(screen.getByPlaceholderText(/Token label.../i), "New Token");
      await user.click(screen.getByRole("button", { name: /Create Token/i }));
      expect(onCreate).toHaveBeenCalledWith("New Token");
    });

    it("shows plaintext token once with warning and hide control", () => {
      const onCreate = vi.fn();
      const onRevoke = vi.fn();
      
      render(
        <CredentialManager
          credentials={mockCredentials}
          canManage={true}
          onCreate={onCreate}
          onRevoke={onRevoke}
          newTokenPlaintext="tok_plaintext_123"
        />
      );

      expect(screen.getByText("tok_plaintext_123")).toBeVisible();
      expect(screen.getByText(/Copy this token now/i)).toBeVisible();
    });

    it("shows revocation confirmation", async () => {
      const onCreate = vi.fn();
      const onRevoke = vi.fn();
      const user = userEvent.setup();
      
      render(
        <CredentialManager
          credentials={mockCredentials}
          canManage={true}
          onCreate={onCreate}
          onRevoke={onRevoke}
          newTokenPlaintext={null}
        />
      );

      await user.click(screen.getByRole("button", { name: /Revoke/i }));
      expect(screen.getByText(/Are you sure you want to revoke/i)).toBeVisible();
      await user.click(screen.getByRole("button", { name: /Confirm Revoke/i }));
      
      expect(onRevoke).toHaveBeenCalledWith("cred_1");
    });

    it("respects read-only state for viewers", () => {
      render(
        <CredentialManager
          credentials={mockCredentials}
          canManage={false}
          onCreate={vi.fn()}
          onRevoke={vi.fn()}
          newTokenPlaintext={null}
        />
      );

      expect(screen.queryByRole("button", { name: /Create Token/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Revoke/i })).not.toBeInTheDocument();
    });
  });

  describe("RuntimeSettings", () => {
    it("renders CORS and rate-limit fields", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      
      render(
        <RuntimeSettings
          project={mockProject}
          canManage={true}
          onSave={onSave}
        />
      );

      expect(screen.getByDisplayValue("https://example.com")).toBeVisible();
      expect(screen.getByDisplayValue("100")).toBeVisible();
      expect(screen.getByRole("checkbox", { name: /Require Token/i })).toBeChecked();

      await user.type(screen.getByLabelText(/Rate Limit/i), "0");
      await user.click(screen.getByRole("button", { name: /Save Settings/i }));
      
      expect(onSave).toHaveBeenCalled();
    });

    it("validates CORS origins", async () => {
      const onSave = vi.fn();
      const user = userEvent.setup();
      
      render(
        <RuntimeSettings
          project={mockProject}
          canManage={true}
          onSave={onSave}
        />
      );

      const corsInput = screen.getByLabelText(/Allowed Origins/i);
      await user.clear(corsInput);
      await user.type(corsInput, "not-a-url");
      await user.click(screen.getByRole("button", { name: /Save Settings/i }));
      
      expect(screen.getByText(/Must be a valid URL/i)).toBeVisible();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("respects read-only state for viewers", () => {
      render(
        <RuntimeSettings
          project={mockProject}
          canManage={false}
          onSave={vi.fn()}
        />
      );

      expect(screen.getByLabelText(/Allowed Origins/i)).toBeDisabled();
      expect(screen.getByLabelText(/Rate Limit/i)).toBeDisabled();
      expect(screen.getByRole("checkbox", { name: /Require Token/i })).toBeDisabled();
      expect(screen.queryByRole("button", { name: /Save Settings/i })).not.toBeInTheDocument();
    });
  });
});
