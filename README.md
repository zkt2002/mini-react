项目初始化
1.pnpm init
2.创建pnpm-workspace.yaml文件指明monorepo的链接
3.安装根目录依赖
  3.1 pnpm i eslint -D -w
  3.2 执行 npx eslint init
  3.3 期间会遇到报错，需要手动输入安装命令
      pnpm i -D -w  @typescript-eslint/eslint-plugin, @typescript-eslint/parser
  3.4 pnpm i -D -w typescript
  3.5 pnpm i -D -w @typescript-eslint/eslint-plugin
  3.6 pnpm i prettier -D -w 
  3.7 pnpm i eslint-config-prettier eslint-plugin-prettier -D -w
  3.8 为lint增加对应的执行脚本，并验证效果：
      "lint": "eslint --ext .ts,.jsx,.tsx --fix --quiet ./packages"
  3.9 安装husky 用于拦截commit 
      pnpm i husky -D -w
  3.10 初始化husky npx husky install