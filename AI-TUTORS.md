# 见微 / 知著：AI 双角色讲解

原答案、题库、学生作答及评分保留。试卷回顾、提交后的题目解析和错题结果下方增加可折叠的 AI 讲解。见微用渐变粉色讲细节，知著用渐变蓝色分步启发；SVG 延续同心圆、飞白尾迹和朱砂点。请求只包含题目、作答与原解析，不附带姓名或学号。AI 输出仍需教师及学生结合教材判断。

## 运行和部署

本地：服务端配置 DEEPSEEK_API_KEY 后运行 npm run dev，访问 /dev/ai-tutors 验收。此预览仅在开发环境注册；生产 Netlify Function 不接受预览头绕过登录。

生产：Netlify Functions 的服务端环境必须配置 DEEPSEEK_API_KEY；绝不能使用 VITE_ 前缀保存密钥。会话校验使用 SUPABASE_URL 和 SUPABASE_ANON_KEY，也兼容已有 VITE_SUPABASE_* 环境变量。默认模型为 deepseek-flash，关闭思考模式以返回及时可见的讲解。/api/tutor 经 netlify.toml 路由到函数，保留 SPA 回退。

## 原版恢复

原版基线分支：codex/baseline-before-ai-tutors-20261118，对应提交 327a58adcd5b9fdfc6e4384458e1f484be72009b。

快速隐藏入口：设置 VITE_AI_TUTORS_ENABLED=false 并重新构建发布，原解析与原页面继续可用。本地浏览器已验证关闭后不出现 AI 面板。

停止服务端调用：设置 AI_TUTORS_ENABLED=false；不删除题目、作答或其他数据库记录。

完整源码回退：对本次功能提交使用 git revert，并按仓库发布流程推送 main。不要使用 reset --hard 或 clean 删除用户的其他未提交修改。原版另有本地 git archive 备份保存在项目小组工作台的 .runtime/backups。

## 验证

npm test：17 项测试覆盖角色提示差异、会话鉴权、生产隔离、无密钥、禁用、请求与响应体超时、当前模型参数和多轮追问裁剪。npm run build 构建成功。浏览器真实调用已验证见微给出细节解释、知著首轮给出一个引导问题，关闭前端开关后原解析仍可阅读。

官方接口依据：https://api-docs.deepseek.com/api/create-chat-completion/ 。Netlify 配置依据：https://docs.netlify.com/build/functions/configuration/ 。
