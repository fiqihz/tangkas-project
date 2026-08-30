import next from "eslint-config-next";

const eslintConfig = [
  ...next,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "src/lib/domain/simulate*.ts",
    ],
  },
];

export default eslintConfig;
