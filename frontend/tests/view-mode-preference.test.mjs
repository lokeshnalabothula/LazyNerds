import test from "node:test";
import assert from "node:assert/strict";

// Simulated ViewMode resolver logic mirroring useViewMode
function resolveViewMode({ savedPreference, windowWidth, desktopBreakpoint = 1024 }) {
  if (savedPreference === "table" || savedPreference === "cards") {
    return { mode: savedPreference, source: "saved_preference" };
  }
  const isDesktop = windowWidth >= desktopBreakpoint;
  return {
    mode: isDesktop ? "table" : "cards",
    source: "device_default",
  };
}

test("first visit on mobile screen (< 1024px) defaults to Card View", () => {
  const result = resolveViewMode({
    savedPreference: null,
    windowWidth: 390,
  });
  assert.equal(result.mode, "cards");
  assert.equal(result.source, "device_default");
});

test("first visit on narrow mobile screen (320px) defaults to Card View", () => {
  const result = resolveViewMode({
    savedPreference: null,
    windowWidth: 320,
  });
  assert.equal(result.mode, "cards");
  assert.equal(result.source, "device_default");
});

test("first visit on tablet portrait screen (768px) defaults to Card View", () => {
  const result = resolveViewMode({
    savedPreference: null,
    windowWidth: 768,
  });
  assert.equal(result.mode, "cards");
  assert.equal(result.source, "device_default");
});

test("first visit on laptop/desktop screen (>= 1024px) defaults to List/Table View", () => {
  const result = resolveViewMode({
    savedPreference: null,
    windowWidth: 1280,
  });
  assert.equal(result.mode, "table");
  assert.equal(result.source, "device_default");
});

test("first visit on wide desktop (1920px) defaults to List/Table View", () => {
  const result = resolveViewMode({
    savedPreference: null,
    windowWidth: 1920,
  });
  assert.equal(result.mode, "table");
  assert.equal(result.source, "device_default");
});

test("saved user preference 'table' takes priority on mobile screen over device default", () => {
  const result = resolveViewMode({
    savedPreference: "table",
    windowWidth: 375,
  });
  assert.equal(result.mode, "table");
  assert.equal(result.source, "saved_preference");
});

test("saved user preference 'cards' takes priority on desktop screen over device default", () => {
  const result = resolveViewMode({
    savedPreference: "cards",
    windowWidth: 1440,
  });
  assert.equal(result.mode, "cards");
  assert.equal(result.source, "saved_preference");
});

test("invalid saved preference falls back safely to device default", () => {
  const result = resolveViewMode({
    savedPreference: "corrupt_data",
    windowWidth: 1280,
  });
  assert.equal(result.mode, "table");
  assert.equal(result.source, "device_default");
});

// Sidebar collapse persistence test logic
function resolveSidebarState({ savedPreference }) {
  if (savedPreference === "true") return { isCollapsed: true, widthClass: "w-[68px]" };
  return { isCollapsed: false, widthClass: "w-64" };
}

test("sidebar defaults to expanded (w-64) when no preference is saved", () => {
  const result = resolveSidebarState({ savedPreference: null });
  assert.equal(result.isCollapsed, false);
  assert.equal(result.widthClass, "w-64");
});

test("sidebar collapses to compact (w-[68px]) when savedPreference is 'true'", () => {
  const result = resolveSidebarState({ savedPreference: "true" });
  assert.equal(result.isCollapsed, true);
  assert.equal(result.widthClass, "w-[68px]");
});

test("sidebar expands back when savedPreference is 'false'", () => {
  const result = resolveSidebarState({ savedPreference: "false" });
  assert.equal(result.isCollapsed, false);
  assert.equal(result.widthClass, "w-64");
});

// Keyboard shortcut target filter logic
function shouldHandleSidebarShortcut(target) {
  if (
    target &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  ) {
    return false;
  }
  return true;
}

test("Ctrl+B/Cmd+B shortcut is ignored when focused on an INPUT field", () => {
  assert.equal(shouldHandleSidebarShortcut({ tagName: "INPUT" }), false);
});

test("Ctrl+B/Cmd+B shortcut is ignored when focused on a TEXTAREA", () => {
  assert.equal(shouldHandleSidebarShortcut({ tagName: "TEXTAREA" }), false);
});

test("Ctrl+B/Cmd+B shortcut is ignored when focused on a SELECT dropdown", () => {
  assert.equal(shouldHandleSidebarShortcut({ tagName: "SELECT" }), false);
});

test("Ctrl+B/Cmd+B shortcut is ignored when focused on contentEditable element", () => {
  assert.equal(shouldHandleSidebarShortcut({ tagName: "DIV", isContentEditable: true }), false);
});

test("Ctrl+B/Cmd+B shortcut triggers when target is body or neutral container", () => {
  assert.equal(shouldHandleSidebarShortcut({ tagName: "BODY" }), true);
  assert.equal(shouldHandleSidebarShortcut({ tagName: "DIV", isContentEditable: false }), true);
  assert.equal(shouldHandleSidebarShortcut(null), true);
});


