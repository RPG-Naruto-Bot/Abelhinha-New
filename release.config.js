// release.config.js
module.exports = {
  branches: [
    "main",
    { name: "develop", prerelease: "beta" }, // NOVO: suporte a develop com beta
  ],
  tagFormat: "v${version}",
  plugins: [
    [
      "@semantic-release/commit-analyzer",
      {
        preset: "conventionalcommits",
        releaseRules: [
          { type: "chore", release: false },
          { type: "docs", release: false },
          { type: "style", release: false },
          { type: "refactor", release: false },
          { type: "test", release: false },
          { type: "perf", release: "patch" }, // NOVO: perfs geram patch
          { type: "ci", release: false }, // NOVO: CI não gera release
        ],
      },
    ],
    "@semantic-release/release-notes-generator",
    [
      "@semantic-release/changelog",
      {
        changelogFile: "CHANGELOG.md",
        changelogTitle: "# 🐝 Changelog — Abelhinha-v2\n\nTodas as mudanças notáveis neste projeto são documentadas neste arquivo.",
      },
    ],
    [
      "@semantic-release/npm",
      {
        npmPublish: false, // evita publish no npm
      },
    ],
    [
      "@semantic-release/github",
      {
        successComment: "✅ Release v${nextRelease.version} publicado!\n\n${nextRelease.notes}",
        failComment: "❌ Release falhou. Verifique os logs.",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["CHANGELOG.md", "package.json", "package-lock.json"], // NOVO: inclui lock file
        message: "chore(release): v${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
  ],
};
