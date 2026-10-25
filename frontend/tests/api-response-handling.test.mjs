import { test } from "node:test";
import assert from "node:assert";

test("API request handler safely parses 204 No Content without throwing JSON parse error", async () => {
  // Simulates the response handler logic in frontend/lib/api.ts
  const handleApiResponse = async (response) => {
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    if (response.status === 204 || response.headers.get("content-length") === "0") {
      return {};
    }

    return response.json();
  };

  // Mock 204 No Content response
  const mock204Response = {
    ok: true,
    status: 204,
    statusText: "No Content",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  };

  const result = await handleApiResponse(mock204Response);
  assert.deepStrictEqual(result, {});

  // Mock empty body with content-length: 0
  const mockEmptyResponse = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "0" }),
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  };

  const emptyResult = await handleApiResponse(mockEmptyResponse);
  assert.deepStrictEqual(emptyResult, {});

  // Mock standard JSON response
  const mockJsonResponse = {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-length": "25", "content-type": "application/json" }),
    json: async () => ({ success: true, id: "asset-123" }),
  };

  const jsonResult = await handleApiResponse(mockJsonResponse);
  assert.deepStrictEqual(jsonResult, { success: true, id: "asset-123" });
});
