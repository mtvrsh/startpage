// Recognize all CSS files as module imports.
declare module "*.scss" {}

interface ImportMetaEnv {
  readonly VITE_GIT_COMMIT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
