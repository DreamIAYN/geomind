# GeoMind · 格致几何

> 面向数学竞赛的 AI 平面几何工作台。简洁画板、GeoGebra 风格对象列表、关系发掘、自动命题，以及后端大模型纯几何证明 + PDF。

![GeoMind 默认工作台](screenshots/default.png)

顶栏「新建」提供两种起点：**空画布**，或**只含三角形 ABC**（`BC` 水平、`A` 在 `BC` 上方、`∠A=70°/∠B=60°/∠C=50°`）。

默认画板只有一个三角形 `ABC`：`BC` 水平，`A` 在 `BC` 上方，`∠A = 70°`、`∠B = 60°`、`∠C = 50°`。五心、外接圆、九点圆等都不会预先出现；需要时从左侧工具或右侧「三角形特征点」面板逐步构造。

![右侧三角形面板与多三角形选择](screenshots/centers.png)

![GeoGebra 风格对象列表](screenshots/algebra-list.png)

## 运行

```bash
cd ~/geomind
python3 server.py --host 127.0.0.1 --port 4173
# 打开 http://127.0.0.1:4173
```

Python 3.10+，后端依赖标准库、`mpmath`（高精度验证）、Pillow、TeX Live 2026 的 `xelatex`（证明 PDF），以及本机运行的 `miniharness` 服务（纯几何证明 agent）。

证明前请确认：

1. `miniharness` 服务运行在 `http://127.0.0.1:8000`；
2. GeoMind 的 `.secrets/miniharness_key` 中是 mini-harness 签发的 `hx_...` Key（文件权限 600，不在静态目录）；
3. 纯几何 skill 位于 `pure-geometry/SKILL.md`。

如只想临时绕过 harness，可设置 `PROOF_BACKEND=direct` 使用原 OpenCode 直连；默认是 `miniharness`。

```bash
python3 -m pip install -r requirements.txt
```

## 公网访问（Cloudflare Tunnel）

启动 cloudflared 后会得到一个临时地址：

`https://<随机子域>.trycloudflare.com`

本地服务仍只监听 `127.0.0.1:4173`，公网请求由 cloudflared 转发。重新启动隧道：

```bash
npm run tunnel
```

说明：

- Quick Tunnel 无需 Cloudflare 账号，但**没有 uptime 保证**，每次重启 URL 会变化；
- 当前 URL 可直接发给学生/同事访问；
- 公网会暴露本机的几何 API（识图、证明、验证），没有登录鉴权；后端默认模型 Key 会被任何访问者消耗。不要把它当作长期生产入口；正式部署请加 Cloudflare Access 或使用限额 Key；
- 正式部署请使用 Cloudflare Named Tunnel + Cloudflare Access（需要账号和域名），并在前面加认证。

## 第一代能力

### 1. 几何画板

- 自由点、对象上的点、垂足；**交点工具可直接点击两线交叉处，只创建点击位置的那一个交点**，圆与直线有两个交点时点哪个画哪个；垂足/垂线会绘制与基准线对齐的直角标志；**中点工具可直接点击线段取中点**，也可依次选择两个点；**中垂线工具可直接点击线段**，也可依次选择两个点；线段 / 直线 / 射线 / 向量
- 平行线、垂线、中垂线、三点内角平分线、**两条直线的两条角平分线**、**等角线**、圆的切线、根轴
- 等角线：`A → 顶点 B → C → 过 B 的直线/射线/线段`，生成关于 `∠ABC` 平分线对称的直线

![等角线](screenshots/isogonal.png)
- 圆的切线：圆上一点 → 该点处切线（垂直于半径）；圆外一点 → 两条切线；圆内点 → 无实切线
- **二次曲线（五点）**：依次选五个点，求过五点的圆锥曲线；椭圆、抛物线、双曲线与退化二次曲线都能实时重绘
- **巨龙曲线（QL-Cu1）**：依次选四条直线，构造完全四边形；曲线是“到四条直线的垂足共圆”的点轨迹，也就是 QL-Cu1。可拖动四线，曲线实时变化
- **定长点 / 定长线段**：起点 → 方向点 → 长度对象（线段、圆半径或长度测量）；长度测量的标签可以直接点击作为来源，生成的点/线段随来源长度实时变化
- **等距点**：U → B → C → A，生成 V 在 CA 上且 CV=BU；拖动 U 时 V 自动保持等长
- **定长圆**：圆心 + 长度对象 → 半径由该对象决定的圆
- **定角线**：过点 + 基线 + 角对象（或有向角测量的三点）→ 与基线成指定角的直线
- **点/线的轨迹**：选中点、直线、线段、射线或向量 →「显示轨迹」，拖动自由点即可描出点的轨迹或直线族的包络；适合发现轨迹是直线、圆、二次曲线等。轨迹是运行时图层；「停止轨迹」会清除该对象轨迹，代数区「清轨迹」可一次清除全部，不写入 JSON

![点的轨迹](screenshots/trace.png)

![直线的轨迹](screenshots/line-trace.png)

![两线角平分线](screenshots/bisectors.png)

![五点圆锥曲线](screenshots/conic-five.png)

![完全四边形与巨龙曲线](screenshots/qlcu1.png)
- 圆、三点圆、直径圆、内切圆、外接圆、九点圆、多边形、文本标注
- 文本标注：选中后可在右侧直接修改内容，或双击文本 / 点「编辑文本…」；画布使用内置中文字体，不会显示方框。切到「选择」工具后可直接拖动文本位置；属性面板可调字号（8–72 px）
- 长度/角度/面积等测量标签：切到「选择」工具后可直接拖动标签位置，测量对象会保存标签偏移；测量属性面板提供「复位标签位置」
- 轴对称、中心对称、旋转、平移、位似：可作用于点、直线、线段、射线、向量、圆、多边形和三角形，生成动态变换像
- **圆反演**：点 + 圆 → 点，满足 `OP · OP′ = r²`
- 反演可作用于整条直线（→ 过反演中心的圆）、圆（→ 圆或直线）、线段/射线/向量（→ 精确圆弧）、多边形/三角形（→ 边界圆弧）
- **伊朗反演 / 轴反射反演**：`A → B → C → P`，以 `A` 为心、幂 `AB · AC` 作反演，再关于 `∠A` 的角平分线反射；标准性质为 `B ↔ C`
- 距离、面积、线段比测量；**有向角**支持三点 `A → 顶点 → C`（顺时针为正）与两条射线（逆时针为正），显示 `+/−` 号

![有向角](screenshots/signed-angle.png)
- 选择 / 多选：点舞台顶部「多选」后普通点击累加对象；Shift/Ctrl 点击移除；也可随时用 Shift/Ctrl 直接多选。多选后右侧目标推断和 AI 分析会使用全部选中对象
- 吸附、缩放、平移、适应视图、网格 / 坐标轴开关
- 默认深色小点与细线；点的大小、颜色与线宽可在对象属性中单独调整
- 左侧工具面板紧凑分栏：基本、构造、变换、射影、度量；三角形特征点全部在右侧面板
- 右侧「对象」页采用 GeoGebra 代数视图风格：对象 / 值 / 类型三列，按点、线、圆、三角形分组，行内显示坐标、长度、半径与类型
- **五心在右侧按需添加**：重心 G、外心 O、内心 I、垂心 H、九点圆心 N 均可单独添加，也可一键生成全部 15 个特征点
- 撤销 / 重做、自动保存、JSON 导入导出、PNG / SVG / TikZ 导出
- 对象依赖图：所有派生点、线、圆随父对象实时重算
- 命令面板（`Ctrl+K`）；`Ctrl+A` 全选几何对象，`Delete` 删除选中；其余工具快捷键见设置面板

### 1.1 代数区与脚本

右侧「对象」页现在是 GeoGebra 风格的代数区：

- 每行显示 **对象 / 定义 / 值 / 类型**；定义列显示 `A=(1,2)`、`Midpoint(A,B)`、`Circle(A,B)` 等可读构造。
- 顶部命令输入框：回车执行，支持 `A=(1,2)`、`Segment(A,B)`、`Midpoint(A,B)`、`Circle(A,B)`、`Intersect(a,b)`、`PerpendicularLine(P,l)`、`ParallelLine(P,l)`、`Polygon(A,B,C)`、`Distance(A,B)`、`Angle(A,B,C)`、`SetColor(A,"red")`、`SetVisible(A,false)`、`SetValue(A,(2,3))`、`Delete(A)`、`ZoomIn()`、`ZoomOut()` 等。
- 「脚本」打开多行控制台：变量、赋值、`Sequence((cos(i),sin(i)), i, 1, 12, "Q")`、批量构造与样式操作，逐行执行并在下方输出结果。
- 双击点可重命名；眼睛按钮显隐；点行选中后右侧属性面板可改颜色/线宽/文本。
- 新增沿射线取定长点原语；识图会把 `BX·AC=CY·AB` 自动转成 `ratioDistanceOnLine`，并把三点外心 `triangleCenter` 自动转成 `circumcenter`；
- 右侧「ℂ 复数」页提供复平面参考系和 coll/cyclic/perp/para/cong/eqangle/onl/onc 命题复验，用当前构型直接检查代数残差；
- 代数区与脚本共用同一套几何依赖图，脚本创建的对象同样可拖动、参与关系扫描与证明。
- 脚本编辑器新增 **JavaScript 模式**：可调用 `api.point/segment/line/circle3/arcMid/incircleTouch` 现场构造，用 `api.bisect(f,lo,hi)` 解特殊条件，用 `api.solve(constraints)` 做数值约束求解。
- 手机端左侧对象抽屉也带命令输入与脚本入口，不必打开属性面板。

![代数区](screenshots/algebra.png)

![代数区与脚本控制台](screenshots/algebra-script.png)

### 2. 三角形特征点

三角形默认**保持干净**：创建时不会自动生成任何五心或特征点。右侧面板可先选定具体三角形，再按需添加单个特征点或点击「全部特征点」。左侧不再放置五心工具组，避免误触后产生一堆特征点。

自动识别由三条边围成的三角形，或选择三个点创建特征点包：

- 核心五心：重心 `G`、外心 `O`、内心 `I`、垂心 `H`、九点圆心 `N`
- 三个旁心 `I_A / I_B / I_C`、陪位重心 `K`、热尔岗点 `Ge`、奈格尔点 `Na`、斯皮克点 `Sp`
- 第一 / 第二费马点、费尔巴哈点
- 欧拉线、九点圆、外接圆、内切圆、中线、高线、角平分线、垂足三角形
- 三角形类型识别（锐角 / 直角 / 钝角 / 等腰 / 等边）
- 任意选中点的重心坐标与最近特征点识别

### 3. 关系发掘

Web Worker 离线扫描，按“有趣程度”排序：

- 共线、共圆、平行、垂直、三线共点
- 等长、等角、中点、相切、比例与五心恒等式
- 自动识别欧拉线、九点圆、欧拉公式、费尔巴哈定理、奈格尔线等
- 每条结论都带残差、置信度与可解释说明；点击可高亮对应对象
- 命中结论可直接设为待证目标

### 4. 自动命题

后端在 6 组随机锐角三角形上重复计算，只保留稳定成立且非平凡的关系，生成候选竞赛命题：

- 九点圆定理、欧拉线、费尔巴哈定理
- 奈格尔线、欧拉公式、九点圆心—中点链
- 每道题附难度、标签、定理提示、验证样本数
- 一键载入动态画板，继续拖拽探究或直接运行 AI 分析

### 5. AI 解题台

![大模型纯几何证明与 PDF](screenshots/llm-proof.png)

- **construction 约束求解**：construction 的 equalLength/equalAngle/共线/共圆/垂直约束会在安装前用数值求解器调整自由参数；
- **识图自校验 + 两次自动修复**：模型返回 construction 后，前端检查点是否全部生成、依赖是否完整、是否与原图归一化坐标偏差过大、目标是否生成，并对模型声明的等长/等角/共线/共圆/平行/垂直/相切条件做数值残差复核；失败时把原图、上一次 JSON 和具体失败原因一起反馈给模型，最多修复两次，而不是直接展示错误图。
- **可选 mini-harness 复核**：识图弹窗新增「使用 mini-harness 复核 / 修正」开关。开启后，若首次构图仍有阻塞问题，会把题目、当前构造 JSON、校验失败原因发给 miniharness mini-harness（`http://127.0.0.1:8000`），由 agent 返回修正后的完整 JSON，再交给前端重建/校验；只发送文本，不发送图片。需要 `.secrets/miniharness_key`，开关按浏览器本地保存，默认关闭。
- **题目文本直接交给 mini-harness agent**：粘贴或输入原题，不做离线命题猜测；agent 使用 `~/none` 的纯几何 skill 与沙箱工具现场生成证明和 PDF 所需 LaTeX。
- **证明必须使用纯几何 skill**：后端把 `pure-geometry/SKILL.md` 的现场约束注入 mini-harness 的 system prompt；证明由 mini-harness 的 agent 循环完成，不再由 GeoMind 直接请求证明模型。
- **纯几何提示**：system prompt 要求综合几何，提示模型避免坐标、向量、复数、解析几何、微积分和 CAS；不再扫描证明文本中的禁用词并拒绝 PDF。允许有向角、相似、共圆、圆幂、反演、正弦定理、角元塞瓦、斯特瓦尔特等。
- **画板 PDF 导出**：导出面板新增「PDF 图」，把当前画板高分辨率 PNG 交给后端 ctexart/xelatex 编译成 PDF；
- **证明 PDF 下载**：后端把证明编译为 ctexart PDF；默认使用当前画板截图作为题图，不让模型凭空画特殊四边形。设置 `PROOF_TIKZ=1` 才会尝试模型给出的 TikZ。前端显示证明全文和「下载证明 PDF」。
- **数值验证仍保留为独立按钮**，仅用于检查当前构型残差/稳定性，不再冒充几何证明。
- 关系探索的「设为目标」可用于给大模型提供目标；文本原题仍会原样发送，不会被离线解析覆盖。
- 探索结果中的虚拟线（如 `v:p1|p4`）会还原为实际线数据，避免目标残差为 ∞。

### 6. 截图识题 / 多模态大模型

![截图识题并自动画图](screenshots/vision.png)

点击顶栏「识图」：

- 支持拖入、选择或 `Ctrl+V` 粘贴题目截图。
- **只使用后端多模态大模型**：默认通过 mini-harness 调用 `deepseek-flash`（mini-harness direct provider，thinking 开启）读取截图，返回结构化 JSON；没有本地 OCR、规则解析或离线回退。`VISION_BACKEND=miniharness`（默认），可改为 `direct` 直连。
- 自动建图：三角形、垂足、五心、中点、线段上的点、圆、角度条件与目标都会转成**可拖动的动态画板**。
- **切线圆**：支持“过 B、P 作圆切 AC 于 E”的 `tangentPoint` 构造；E/F 由圆与直线的相切条件数值求根，不是自由点。
- 点依赖尚未建立的线/圆时，可用 `lineAD`、`circleABC` 这类名字，前端会自动建线/圆并按坐标选择交点分支。
- **构造规范编译器**：兼容模型常用的 `name/label`、`kind/sub`、`sub_type`、`line/circle` 类型名等写法，并补齐 `triangleCenter(A,B,C)`、`angleEqualOnCircle`、`pointOnLineDistance`、`pointOnCircleDistance` 等派生原语；线段求交无解时自动改用整条直线。
- **通用构图消歧**：两个圆没有交点时不再静默丢点；同一对曲线的两个交点会强制分到不同分支；圆与“由它定义的点”形成循环依赖时，自动插入隐藏半径辅助点或退为自由点；`∠XYZ=90°` 会按“顶点 Y、斜边 XZ”的 Thales 圆处理，并纠正模型把斜边认反的直径圆。
- **自由点约束求解器**：对模型声明但当前坐标不满足的等长、等角、共线、共圆、平行、垂直、相切、中点、点在线上/圆上、圆相切等条件，用有限差分 Jacobian + Levenberg–Marquardt 调整相关自由点（包括三角形顶点）；未知量按依赖图只取条件点的祖先自由点，避免无谓移动。题面为“当且仅当 DE=DF”这类条件时，会把该等式作为绘图条件自动求解。
- 形式化约束优先尺规构造；只有不可尺规表达时才用数值求解；
- 识图可返回 `script_js`：用 JavaScript 构造脚本和 `api.bisect` 处理复杂条件，前端执行并校验；
- 模型可给构造辅助点标记 `auxiliary: true`；这些点仍参与依赖和证明，但**默认隐藏**，代数区「辅助点」按钮可统一显隐；选中任意点也可手动「设为辅助点」。
- 模型 Key 只在后端使用，不下发浏览器。默认 Key 已配置；可通过 `OPENCODE_API_KEY` 覆盖。

识图与证明模型：默认都通过 mini-harness（`http://127.0.0.1:8000`）调用 `deepseek-flash`（direct provider，DeepSeek 官方 API，thinking 开启）；可用 `MINIHARNESS_MODEL` / `VISION_HARNESS_MODEL` 覆盖。识图输出上限提高到 96000 tokens、超时 600 s；若仍返回空，错误里会带 mini-harness `runId`，可直接到 `/admin/ui` 看该次完整回复。miniharness 的 `/admin/ui` 可以查看每次调用的 prompt、回复、tokens 和耗时。识图与证明均为异步任务。

后端端点：

- `POST /api/vision`：多模态识图
- `POST /api/vision/review`：可选的 mini-harness 构图复核/修正（文本） → 结构 JSON。
- `POST /api/proof/start`：启动异步证明任务，立即返回 `jobId`（避免 Cloudflare 100 秒超时）。
- `GET /api/proof/status?job=…`：轮询任务；完成后返回 Markdown、LaTeX、PDF base64。
- `POST /api/proof`：同步兼容接口（本地调试用）。
- `GET /api/logs?limit=60`：最近的识图/证明/任务日志与 AI 思考；识图条目包含完整请求、系统提示词、模型原始返回、解析后的构造 JSON、失败点与耗时。
- mini-harness 自身的调用历史在 `http://127.0.0.1:8000/admin/ui`（调用记录 / 正文），识图、证明、复盘请求都会出现在那里。
- `POST /api/ocr`：保留的旧接口，前端识图不再使用。

### 6.1 手机端操作

![手机端工具栏与画板](screenshots/mobile.png)

![手机端对象列表](screenshots/mobile-objects.png)

![手机端底部工具面板](screenshots/mobile-tools.png)

- 竖屏手机采用 GeoGebra 风格：左侧分组栏 + **底部可滑动工具面板**；面板只占下半屏，上方画布仍可见可画。点左侧「基本 / 构造 / 变换」打开对应列表，选完工具自动收起。
- 右上角浮动工具栏：选择、点、线段、圆、对象、缩放、撤销、删除、适应；工具栏可关闭，再次用「工具」恢复。
- 左侧对象抽屉：按 GeoGebra 风格列出点、线、圆、三角形，显示值与类型，可直接选中/显隐。
- 双指捏合缩放，单指拖动；移动端命中半径放大，便于选点。
- 画布改为纯白、默认关闭网格/坐标轴；左侧按钮去掉多余边框，保持简单。

### 6.2 运行日志 / AI 思考

顶栏「日志」或证明卡片「运行日志 / 思考」打开日志面板：

- **本地作图记录**：最近 100 条构造、载入、识图、脚本执行等操作。
- **后端 AI 调用**：识图提示词、题目、模型、耗时、识图结果摘要、证明正文。
- **AI 思考过程**：识图/证明开启 thinking 时，模型返回的 `reasoning_content` 会保存到后端日志；默认折叠，展开查看。
- 日志不含 API Key 和完整图片；但包含题目原文与模型输出，公网部署时请勿把日志接口直接暴露给不可信用户。
- 后端端点：`GET /api/logs?limit=60`。

![运行日志与 AI 思考](screenshots/logs.png)

**识图不会自动载入历史构型。** 模型必须现场返回 `construction` 数组；前端按顺序执行自由点、反射点、垂足、中点、平行线、切于定点的圆、线圆交点等构造，并按原图归一化坐标选择分支。题库中的精确构型只能手动载入，不参与识图覆盖。

「外角平分线与等腰梯形」不再自动套用，请手动载入或直接打开：

```text
http://127.0.0.1:4173/?scenario=exterior-bisector-trapezoid
```

该构型的点序固定为 `A、B、C、O、E、F、P、L`，E/F/P/L 都是派生点。识图只使用模型返回的构图，不再自动替换成模板。

若仍看到旧图，先硬刷新（`Ctrl+Shift+R`）；页面脚本带 `?v=95`，日志页会显示 build `2026-10-24-80`。

![外角平分线与等腰梯形](screenshots/trapezoid-vision.png)

### 7. 射影几何

![射影工具](screenshots/projective.png)

- **调和点列**：选共线三点 `A、B、C`，直接构造调和共轭点 `D`，满足 `(A,B;C,D) = −1`。
- **极点**：选一条直线和一个圆，求该直线关于圆的极点。
- **极线**：选一个点和一个圆，求该点关于圆的极线；点在圆上时退化为切线。
- **交比**：选四个共线点，直接测量交比 `(A,B;C,D)`。
- 极点/极线、调和点都是动态派生对象：拖动定义点或圆，会实时重算。

### 8. 竞赛构型库

内置 30 个动态构型；题库页可打开「高中联赛 100 题」原图题库并逐题识图：

- 基本三角形 ABC
- 欧拉线与九点圆
- 西姆松线
- 蝴蝶定理
- 热尔岗点与塞瓦
- 费马点
- 帕斯卡线
- 密克尔点
- 五点圆锥曲线
- 完全四边形与巨龙曲线（QL-Cu1）
- 外角平分线与等腰梯形（四倍角）
- 角平分线·平行弦·双切圆（四点共圆）
- IMO 2022 G2（平行线与等弦，B,C,X,Y 共圆）
- IMO 2025 G3（等弦与四次交点，CX⊥AB）
- IMO 2022 G5（平行线截边与垂线三角形，两圆相切）
- IMO 2022 G3（切圆与中点，切线交于 CD）
- IMO 2025 G6（切线反射与共线，A,Z,Q 共线）
- IMO 2025 G2（旁心圆截线段，BY⊥CX）
- IMO 2022 G4（等距点与切线，DZ 相切）
- IMO 2022 G7（共圆共垂心双三角形，外心在 OH 上）
- IMO 2025 G1（共圆切线与共线，A,P,Q 共线）
- 原创 1036（塞瓦共点与根轴，MI 为根轴）
- 原创 1037（内切圆切线与共线，O,P,Q 共线）
- 原创 1034（角度约束与圆，∠CFD+∠CAD=180°）
- 比例点与等腰三角形（X,Y 在直线 BC 上，AU=AV）
- 平行四边形·双圆交线共点（CD,AQ,BR 共点）
- 原创 1032（垂心圆与等距点，O₁O₂MN 共圆）
- 原创 1035（倍长与垂足，PL⊥BC）
- 原创 1039（弧中点与切线，OA,XY,PH 共点）
- 弧中点·内切圆·垂直（DF⊥FG）

## 原理文档

完整的实现原理见 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)；三份 PDF 测试得到的高级构型缺口见 [docs/CONSTRUCTION_GAPS.md](docs/CONSTRUCTION_GAPS.md)；逐题通过状态见 [docs/SUPPORT_STATUS.md](docs/SUPPORT_STATUS.md)；高中联赛 100 题抽样测试见 [docs/LEAGUE100_TEST.md](docs/LEAGUE100_TEST.md)，识图前 50 题回归与第 5 题复盘见 [docs/LEAGUE50_TEST.md](docs/LEAGUE50_TEST.md)。

## 架构

```
index.html              单页应用外壳
css/app.css             设计系统 / 响应式布局
js/geometry.js          几何内核：对象依赖、求交、五心、变换、二次曲线/QL-Cu1
js/relations.js         关系检测（纯函数）
js/relations-worker.js  Web Worker 包装
js/scenarios.js         题库构型与综合法证明
js/solver.js            目标求值、稳定性、证明叙事、后端 payload
js/app.js               画布渲染、工具、面板、交互、导出
js/api.js               后端客户端
js/vision.js            截图 → 构造 JSON → 动态画板
server.py               stdlib HTTP + 50 dps 验证 + 自动命题 + 大模型识图/证明/PDF
fonts/                  中文子集字体（FandolHei · 约 270 KB WOFF2）
test/                   Node / Python 测试与视觉截图
```

### 后端 API

- `GET /api/health`：内核版本、精度、缓存状态
- `POST /api/verify`：目标高精度复核，返回残差、检查项、计算过程
- `POST /api/generate`：自动命题，返回 6 个候选与顶点坐标
- `POST /api/vision`：多模态识图
- `POST /api/vision/review`：可选的 mini-harness 构图复核/修正（文本）
- `POST /api/proof/start`：启动纯几何证明任务
- `GET /api/proof/status?job=…`：证明任务状态 / 结果
- `POST /api/proof`：同步证明接口（本地调试）
- `GET /api/logs?limit=60`：识图 / 证明 / AI 思考日志
- `POST /api/solve`：`verify` 的兼容别名

## 证明失败排查

如果界面显示 **纯几何证明失败 · Failed to fetch**，这不是模型返回的证明错误，而是浏览器没有拿到后端响应。常见原因：

- 后端正在重启，或 Cloudflare Quick Tunnel 短暂断开；
- 页面是在旧的 API 客户端上打开的；
- 请求体过大或网络中断。

现在前端会先做 `/api/health` 预检，证明启动失败会自动重试 3 次，轮询中断会重试 5 次，并把错误转成“后端未连接 / 连接中断，请重试”的可读提示；证明卡片上有「重试证明」和「查看日志」。


## 性能

- Canvas 按脏标记渲染，静态画面不占动画帧；DPR 上限 2
- 关系扫描放入 Web Worker，避免主线程卡顿；示例图形 4–12 ms
- 后端 `mpmath` 复核通常 < 2 ms；相同 payload 600 s 缓存
- 自动命题 6 组构型约 1 s，结果缓存 30 min
- HTTP 静态资源支持 gzip、Cache-Control、HTTP/1.1 keep-alive
- 中文字体按实际字符集子集化，10.4 MB → 约 250 KB

## 已知边界（第一代）

- 不是完整的 GeoGebra 替代品：暂未实现参数动画时间轴、包络、自定义函数/递归；二次曲线与 QL-Cu1 使用隐式采样绘制，点的轨迹是运行时采样。
- 几何证明改为后端大模型 thinking 模式生成；模型仍可能出错，界面不再用本地模板冒充证明。
- 自动命题当前主要围绕三角形五心与九点结构；完全四边形、两圆、射影构型的随机命题留给下一代。
- **不宣称与 GeoGebra 一比一等同**。GeoGebra 是完整动态几何系统，目前尚未覆盖：参数动画时间轴、包络、3D、完整 CAS、表格/概率统计、复杂不等式区域等。当前专注竞赛平面几何 + 射影核心 + 关系/命题/证明 + 二次曲线/QL-Cu1 + 轻量脚本。
- 视觉识图与几何证明默认通过 mini-harness 使用 `deepseek-flash`（direct provider，thinking 开启）；识图仍只走多模态大模型，没有本地 OCR/规则回退。mini-harness 不可用时默认不回退（`VISION_DIRECT_FALLBACK=0`），避免静默改用 OpenCode；需要回退时显式设为 `1`。
- 数值验证、关系扫描、稳定性检验仍由本地内核完成；几何证明由大模型在纯几何约束下生成，并编译为 PDF。
- 公网入口没有登录鉴权，且后端配置了默认模型 Key；任何拿到 URL 的人都能消耗模型额度。请勿长期公开，生产部署请加 Cloudflare Access / 自建鉴权，或把默认 Key 换成限额 Key。
- 证明通过异步任务轮询，避免 Cloudflare Quick Tunnel 的 100 秒响应超时。

## 开发浏览器（已常驻）

项目已在 `.pw-browsers/` 安装 Chromium，并在 `node_modules/` 保留 Playwright，不需要重复下载。

```bash
npm run browser:check          # 验证浏览器可用
npm run screenshot -- http://127.0.0.1:4173/ screenshots/current.png
```

只有在新机器或删除 `.pw-browsers/` 后才需要执行 `npm run browser:setup`。

![任意对象反演](screenshots/inversion.png)

## 测试

```bash
node test/geometry.test.mjs
python3 test/test_backend.py
```

## 参考与致谢

- 用户提供的 `~/none` 数学竞赛工作区：构型库、五心条目、纯几何规范与书写风格。
- GeomTool v8（cybcatppuccino）在“关系发掘 / 本地内核 / 复数法”方向上的启发；本项目未复用其代码或数据。
- 通矩模型（TongGeometry）关于“自主命题 + 自动解题”的问题设定。
- 字体：Fandol（TeX Live，GPL 字体例外条款）。
