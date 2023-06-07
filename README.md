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
  3.11 刚才实现的格式化命令pnpm lint纳入commit时husky将执行的脚本：
      npx husky add .husky/pre-commit "pnpm lint"
      TODO：pnpm lint会对代码全量检查，当项目复杂后执行速度可能比较慢，届时可以考虑使用lint-staged，实现只对暂存区代码进行检查
  3.12 通过commitlint对git提交信息进行检查，首先安装必要的库：
      pnpm i commitlint @commitlint/cli @commitlint/config-conventional -D -w
  3.13 新建配置文件.commitlintrc.js：
        module.exports = {
          extends: ["@commitlint/config-conventional"]
        }; 
  3.14 集成到husky中：
        npx husky add .husky/commit-msg "npx --no-install commitlint -e $HUSKY_GIT_PARAMS"
        