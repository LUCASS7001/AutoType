import type { Monaco } from "@monaco-editor/react";

export const THEMES = ["VS Code Dark+", "GitHub Dark", "GitHub Light", "One Dark Pro", "Tokyo Night", "Dracula"] as const;

export function themeId(theme: string): string {
  return `autotype-${theme.toLowerCase().replaceAll(/[^a-z]+/g, "-")}`;
}

export function registerThemes(monaco: Monaco): void {
  const dark = (background: string, foreground: string, accent: string) => ({
    base: "vs-dark" as const,
    inherit: true,
    rules: [
      { token: "keyword", foreground: accent.replace("#", "") },
      { token: "string", foreground: "A7D28D" },
      { token: "comment", foreground: "6F7785", fontStyle: "italic" },
    ],
    colors: { "editor.background": background, "editor.foreground": foreground, "editor.lineHighlightBackground": "#ffffff08", "editorCursor.foreground": accent },
  });
  monaco.editor.defineTheme(themeId("VS Code Dark+"), dark("#151719", "#D8DEE9", "#59C2FF"));
  monaco.editor.defineTheme(themeId("GitHub Dark"), dark("#0D1117", "#C9D1D9", "#FF7B72"));
  monaco.editor.defineTheme(themeId("One Dark Pro"), dark("#17191E", "#ABB2BF", "#C678DD"));
  monaco.editor.defineTheme(themeId("Tokyo Night"), dark("#16161E", "#C0CAF5", "#7AA2F7"));
  monaco.editor.defineTheme(themeId("Dracula"), dark("#191A21", "#F8F8F2", "#FF79C6"));
  monaco.editor.defineTheme(themeId("GitHub Light"), {
    base: "vs",
    inherit: true,
    rules: [{ token: "keyword", foreground: "CF222E" }, { token: "string", foreground: "0A3069" }],
    colors: { "editor.background": "#FFFFFF", "editor.foreground": "#24292F", "editor.lineHighlightBackground": "#DDF4FF66", "editorCursor.foreground": "#0969DA" },
  });
}
