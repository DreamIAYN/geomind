# GeoMind 原理与实现

本文说明 GeoMind 各部分的实际实现，而不是产品介绍。重点包括：几何依赖图、关系扫描、目标求值、代数脚本、识图、AI 证明、日志和 PDF。

## 1. 总体结构

```text
index.html / css            前端外壳
js/geometry.js              几何内核：对象、依赖、求交、五心、变换、二次曲线/QL-Cu1
js/relations.js             关系检测纯函数
js/relations-worker.js      关系扫描 Web Worker
js/solver.js                目标求值、稳定性、目标文本
js/scenarios.js             动态构型与构型库
js/vision.js                识图 JSON → 几何对象
js/app.js                   渲染、交互、代数区、脚本、导出、面板
js/api.js                   后端客户端（含证明轮询）
server.py                   stdlib HTTP、mpmath 验证、LLM 代理、PDF
fonts/                      中文字体子集
```

前端是单页 ES Module 应用；后端是 Python 标准库 `ThreadingHTTPServer`。没有数据库，画板保存在浏览器 `localStorage`。

## 2. 几何对象与依赖图

每个对象至少有：

```js
{
  id, type, sub, deps: [], label, visible,
  style: { color, width, dash, pointSize, ... },
  x, y,        // 自由点或文本位置
  g, valid, error
}
```

`deps` 是父对象 ID。`computeObject()` 根据 `type/sub/deps` 计算 `g`：

- 点：自由点、中点、垂足、交点、三角形中心、圆上点、线上点、反演点、变换点等；
- 线：两点线、平行线、垂线、中垂线、角平分线、等角线、切线、根轴、定角线等；
- 圆：圆心+过点、三点圆、内切/外接/九点圆、定长圆、反演圆等；
- 多边形、三角形、圆弧、测量、文本、曲线。

`recompute(state)`：

1. 用 `topoOrder` 对依赖图做拓扑排序；
2. 依次调用 `computeObject`；
3. 设置 `valid/error`；
4. 三角形同时缓存 `metrics`。

因此拖动自由点后，所有后代自动重算；删除父对象时依赖对象会失效或被移除。

## 3. 几何计算

### 3.1 交与曲线

`intersectionOfCurves()` 支持：

- 直线/线段/射线 × 直线；
- 直线 × 圆；
- 圆 × 圆。

线段/射线通过 `bounds` 限制参数范围；圆的交点用圆心距和根轴求。

交点对象保存 `branch`，用于在同两个曲线的多个交点中选第几个。

### 3.2 三角形中心

`triangleMetrics()` 计算边长、面积、外接圆半径 `R`、内切圆半径 `r`，并求：

- 重心 `G`、外心 `O`、内心 `I`、垂心 `H`、九点圆心 `N`；
- 旁心、陪位重心、热尔岗点、奈格尔点、斯皮克点、费马点、费尔巴哈点等；
- 欧拉线、九点圆、垂足三角形、中线/高线/角平分线。

复杂中心用标准重心坐标/向量公式实现；结果再进入普通依赖图。

### 3.3 变换与反演

支持轴对称、中心对称、旋转、平移、位似；对点、线、圆、多边形、三角形均可作用。

反演 `OP · OP' = r²`：

- 点 → 点；
- 直线 → 过反演中心的圆；
- 圆 → 圆或直线；
- 线段/射线/向量 → 精确圆弧；
- 多边形/三角形 → 边界圆弧。

伊朗反演先以 `AB·AC` 为幂反演，再关于 `∠A` 平分线反射。

## 4. 二次曲线与巨龙曲线

### 4.1 五点二次曲线

五个点确定一般二次曲线：

```text
A x² + B xy + C y² + D x + E y + F = 0
```

实现：

1. 构造 5×6 矩阵，每行 `[x², xy, y², x, y, 1]`；
2. 高斯消元求一维零空间；
3. 归一化系数；
4. 渲染时在视口内用 marching squares 对隐式函数采样，连接零等值线段。

因此椭圆、抛物线、双曲线和退化二次曲线共用同一套渲染。

### 4.2 QL-Cu1（巨龙曲线）

输入四条直线，取到四条直线垂足共圆的点轨迹：

1. 对候选点 `P`，投影到四条直线得到四个垂足；
2. 四点共圆等价于 4×4 行列式为零：

```text
| x_i²+y_i²  x_i  y_i  1 | = 0
```

3. 对归一化坐标计算该行列式，marching squares 提取零等值线。

该轨迹通过六条直线的交点，并满足 QL-Cu1 的垂足共圆定义。

### 4.3 点的轨迹

轨迹不是几何对象，而是运行时图层：

- 选中点/直线/线段/射线/向量 → 显示轨迹；
- 拖动任意自由点时，对点坐标或线对象快照采样；
- 直线族以低透明度逐条绘制，可用于观察包络；
- 采样步长按屏幕像素控制，超过 5000 点后抽稀；
- 渲染为低透明度折线；
- 「停止轨迹」删除该对象轨迹；「清轨迹」删除全部；不写入 JSON，刷新或新建画板后清空。

## 5. 关系扫描与目标求值

`buildSnapshot(state)` 把点、线、圆、三角形、测量转成纯数据。`runDetection()` 检测：

- 共线、共圆、平行、垂直、三线共点；
- 等长、等角、中点、相切、比例、五心恒等式。

扫描在 Web Worker 中运行，避免阻塞主线程；结果按“有趣程度”排序并带残差。

`solver.js` 把目标转成数值残差：

- 共线：叉积/尺度；
- 共圆：4×4 行列式；
- 平行/垂直：方向叉积/点积；
- 中点、等长、相切、等角等；角度可按有向角约定。

`stabilityCheck()` 对自由点做多组随机微扰，观察目标是否仍成立：

- 残差小且稳定 → `verified`；
- 残差小但微扰不稳定 → `unstable`（当前构型成立）；
- 否则 `failed`。

高精度复核由后端 `mpmath` 50 dps 完成。

## 6. 代数区与脚本

右侧代数区显示：

```text
对象 / 定义 / 值 / 类型
```

定义字符串由 `objDef()` 生成，例如：

```text
A = (1.000, 2.000)
s = Segment(A, B)
D = Midpoint(A, B)
ω = Circle(A, B)
P = Intersect(a, b)
```

顶部命令栏和脚本控制台共用一个轻量解释器：

1. `splitTop()` 按顶层逗号拆分参数；
2. `mathEval()` 递归下降解析 `+ - * / ^`、括号、`pi/e`、`sin/cos/sqrt/...` 和变量；
3. `commandName()` 解析 `Command(args)`；
4. `runAlgebraLine()` 把命令映射到 `addObject` / `addLineObj` / `addCircleObj` / `addMeasure`；
5. `runScript()` 逐行执行，变量保存在局部 `vars`，一次 `pushHistory`，最后统一重算。

支持 `Sequence((cos(i),sin(i)), i, 1, 12, "Q")` 这类点列生成，最多 200 个点/次。

脚本不是图灵完备语言：没有递归、自定义函数、完整 CAS 和任意控制流。

## 7. 识图流程

### 7.1 后端

`POST /api/vision`：

1. 接收图片（data URL）和可选题目文字；
2. 图片缩放到最长边 1600，转 JPEG；
3. 默认通过 mini-harness `POST /v1/agent/run` 调用 `deepseek-flash`（direct provider，thinking 开启；`images` 传图，`max_steps=2`）；
4. mini-harness 不可用时，`VISION_DIRECT_FALLBACK=1` 会回退到直连视觉模型；
5. 解析 JSON，做字段缺省；
6. 返回结构化构图数据，并把 prompt、结果、harness runId/tokens 写入日志；
7. 调用历史可在 `http://127.0.0.1:8000/admin/ui` 的「调用记录」查看。

不会按关键词自动套用已知构型模板；之前的自动模板覆盖已移除。

### 7.2 前端

`buildVisionState(data)` 把 JSON 转成对象：

- `kind: foot` → 垂足；
- `triangleCenter` → 三角形中心；
- `midpoint` → 中点；
- `onSegment` → 线段上的点 + 约束；
- `intersection` → 交点；
- `free` → 自由点；
- `segments/lines/circles` → 对应对象；
- `goal` → 目标。

因此模型能表达的语义构造会变成派生点；表达不了的关系只能落成自由点。识图不是约束求解器。

对于 `equalDistance`，V 由 U 派生：取 `BU` 的长度，沿 `C→A` 方向放到 CA 上。每次 `recompute` 都重新取长度，因此拖动 U 后 `CV=BU` 仍成立；若 BU 超过 CA 则构造无效。

对于 `tangentPoint`，构建器把“过 B、P 且与 AC 切于 E”的切点视为派生点：沿 AC 参数化 E，利用圆心在 E 的法线上且到 B/P 等距，得到关于参数 t 的方程，再扫描/二分求根。这样 E/F 不是自由点，圆 BPE/CPF 与对应边相切。

点依赖尚未建立的线/圆时，`lineAD`、`circleABC` 这类名字会按点名自动构造；交点分支按模型给的归一化坐标选最近的那个。

对于 `angle-double` 约束，构建器会把 P 从 `pointOnLine` 转成 `angleDouble` 派生点：每次 `recompute` 都在线段上重新扫描/二分求角条件根，因此拖动三角形后 P 仍满足约束，且 P 被标记为 `locked`，不能单独拖动。若题面明确 `AD` 是高，而模型把 D 给了 free，构建器会强制把 D 改为 A 到 BC 的垂足。

若模型把某点标为 `auxiliary: true`（辅助圆心、辅助交点等），构建后该点仍参与依赖计算，但默认 `visible=false`，可在代数区用「辅助点」按钮统一显隐；选中任意点也可手动设为辅助点。

## 8. AI 证明流程

### 8.1 请求与异步任务

前端发送：

```json
{
  "problem_text": "...",
  "goal": {...},
  "geometry": "点/线/圆/目标摘要",
  "image": "data:image/jpeg;base64,..."
}
```

`POST /api/proof/start` 立即返回 `jobId`，后台线程执行；前端轮询 `GET /api/proof/status?job=...`。这样避免 Cloudflare 100 秒超时。

### 8.2 模型调用

- 模型：通过 mini-harness 调用 `deepseek-flash`（direct provider，thinking 开启；`MINIHARNESS_MODEL` 可覆盖）；
- mini-harness agent 最大 8 步（GeoMind 请求 4 步）；
- system prompt 要求纯综合几何，禁止坐标/向量/复数/解析几何等；
- 返回 JSON：`title/statement/proof_markdown/proof_latex/tikz`；
- 每次模型调用记录在 mini-harness `/admin/ui` 的调用历史中。

**不再检查证明文本中的禁用词并拒绝 PDF**。是否采用某种方法由模型和阅读者判断；服务端只做 JSON 解析、PDF 编译和错误处理。

### 8.3 为什么慢

主要耗时是模型 thinking 本身，而不是 PDF：

- 模型先生成数万 reasoning token，再生成证明正文；
- 复杂题常见 30k–40k reasoning token；
- 实际耗时约 1–5 分钟；服务端超时 900 秒；
- PDF 编译通常 1–5 秒；
- 前端轮询间隔 1.8 秒，影响很小。

证明卡片会显示实时耗时。

### 8.4 PDF

- 使用 `ctexart` + `xelatex`；
- 默认用当前画板压缩图作题图；
- 只有 `PROOF_TIKZ=1` 才使用模型给的 TikZ；
- 如果 LaTeX 编译失败，尝试无 TikZ、再把 Markdown 纯文本作为后备；
- 返回 PDF base64，前端 Blob 下载。

## 8.5 文本与测量标签

文本对象保存 `x/y` 与 `style.fontSize`；测量对象默认锚点由几何关系计算（距离取中点、角取顶点等）。拖动标签时：

- 文本更新 `x/y` 与 `g`；
- 测量写入 `meta.labelPos`，渲染和命中检测优先使用该绝对坐标；
- `labelPos` 随对象一起序列化；测量属性面板可清除它，恢复几何锚点。

拖动只在「选择」工具下生效，避免与测量工具连续取点冲突。

## 8.6 construction 约束求解

construction 执行后，如果带 `constraints`，会把标签映射为依赖图对象，用有限差分 Gauss–Newton 求解自由参数；约束不满足时仍会进入校验/修复流程。

## 8.6 识图自校验与修复

construction 执行后做一次本地校验：

- data.points 中每个点是否生成；
- 点是否 valid；
- 是否与原图归一化坐标偏差过大；
- goal 是否生成。

有错误时把错误列表连同原图和题目重新发给模型修复一次；修复后仍失败则展示并明确警告，不静默当作正确。

## 8.6 模型现场 construction

识图不再按题目文字匹配历史 scenario。模型返回 `construction` 数组，前端按依赖拓扑执行：

- free 点用原图归一化坐标 `at`；
- 派生点用 `reflectLine / foot / midpoint / pointOnLine / intersection / tangentCirclePoint / angleDouble / equalDistance`；
- 构造线用 `through / parallel / perp / perpbis / bisector`；
- 圆用 `threePoints / centerThrough / tangentAtPoint`；
- 交点无显式坐标时，若两对象共享一个点（如 FA 与过 A 的圆），取离共享点更远的另一交点，避免 P/Q 落在 A。

## 8.6 弧中点与内切圆切点

- `midpointArc`：deps 为 `[外接圆,B,A,C]` 时取含 A 的弧 BAC 中点；deps 为 `[外接圆,B,C]` 时取另一段弧 BC 中点。
- `incircleTouch`：按 `AF=s-a`、`BF=s-b` 在 AB 上取内切圆切点，不依赖自由摆放。
- 过 B 作 AB 垂线与 EF 的交点给出 N；BN=EM 作为条件构型时，场景中取满足该等式的三角形。

## 8.7 证明：pure-geometry + mini-harness

证明任务默认走 `miniharness` mini-harness：

1. GeoMind 读取 `pure-geometry/SKILL.md`，截取操作规则注入 system prompt；
2. `POST /v1/agent/run` 交给 mini-harness agent，prompt 包含题目、目标、当前构型摘要和严格 JSON 输出要求；
3. agent 可使用其沙箱工具做辅助图/草稿，最终返回 JSON 证明；
4. GeoMind 继续用 `ctexart` + `xelatex` 编译 PDF。

Key 只存放在 `.secrets/miniharness_key`；`PROOF_BACKEND=direct` 是应急回退，不改变默认架构。

## 8.8 JavaScript 构造脚本

脚本编辑器可在 DSL 与 JavaScript 间切换。JS 模式暴露 `api`：

- `point/segment/line/circle3/arcMid/incircleTouch/midpoint/foot/intersection`
- `bisect(f, lo, hi, iters)`：特殊条件的单参数二分求根
- `solve(constraints, opts)`：基于依赖图有限差分 Gauss–Newton 的约束求解
- `recompute()` 与几何向量函数

这为「条件构型」（如 `OW=OD`、`BN=EM`）提供现场求解路径，而不是套历史 scenario。

## 8.9 复数法验证

右侧「ℂ 复数」页把当前有效点映射为复平面坐标 z=x+iy，并支持命题：

- `coll(A,B,C)`、`cyclic(A,B,C,D)`
- `perp/para(A,B,C,D)`
- `cong(A,B,C,D)`、`eqangle(A,B,C,D,E,F)`
- `onl(P,A,B)`、`onc(P,A,B,C)`

每个命题化简为复比/交比的实部、虚部或模残差，显示在面板中。它是当前构型的数值代数复验，用于发现画错/整理关系，不替代纯几何证明。

## 9. 日志

后端内存日志最多 80 条：

- `vision`：提示词、题目、识图结果摘要、点/线段数量、模型、耗时、thinking；
- `proof_job`：任务启动；
- `proof`：题目、证明正文、thinking、PDF 是否有、错误、耗时。

前端另有最近 100 条本地作图记录。

`GET /api/logs?limit=60` 返回日志；不记录 API Key 和完整图片。

## 10. API

```text
GET  /api/health
POST /api/verify
POST /api/generate
POST /api/vision
POST /api/proof/start
GET  /api/proof/status?job=...
POST /api/proof          同步兼容
GET  /api/logs?limit=60
POST /api/ocr            旧接口，前端不再使用
```

## 11. 性能与边界

- Canvas 按脏标记渲染，DPR 上限 2；
- 关系扫描 Worker，示例 4–12 ms；
- 二次曲线/QL-Cu1 隐式采样：QL-Cu1 步长约 20px，首次计算可能 100–300 ms；
- 轨迹最多 5000 点后抽稀；
- 识图 thinking 让耗时增加，但提高复杂题 JSON 稳定性；
- 证明是 LLM 生成 + 方法提示 + PDF 编译，不是 Lean 形式化验证，仍可能证错；
- 识图模型不是约束求解器，复杂复合关系可能退化为自由点。
