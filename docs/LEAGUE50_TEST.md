# 高中联赛 100 题 · 识图前 50 题回归（2026-10-21）

材料：`data/league100/p001.png … p050.png` + `data/league100/index.json` 题面。  
识图：OpenCode Zen `deepseek-v4.1-flash`，图片 + 题面一起送入，由模型输出 `construction`；前端只负责规范化、编译成动态画板并校验。  
评测脚本：`test/league100_pipeline.mjs`。它复刻浏览器流程：识图 → 建板 → 校验 → 最多两次“带原图 + 上次 JSON + 失败原因”的模型修复。

## 结果（前 50 题）

| 指标 | 题数 |
|---|---|
| 构图校验零问题 | 33 / 50（66%） |
| 所有识别到的点都能生成（无无效点） | 45 / 50（90%） |
| 识图目标成功建立 | 约 40 / 50 |

说明：`零问题` 要求模型的每个点/线/圆依赖有效、目标可建立、模型声明的条件残差达标。  
`所有点都能生成` 是用户最直观的“图画出来了”指标：即使某个派生构造退化，也会按模型给出的原图坐标放置该点，并继续画出依赖它的线/圆；这类点会在校验里明确标为“依赖未建立/构造退化”，不会静默冒充正确。

## 第 5 题：为什么以前修复后还是错的

原题：`∠BAD=∠BCD=90°`，即 **A、C 都在以 BD 为直径的圆上**。  
旧输出的问题是：

1. A、B、C、D 全写成 `free`，两个直角条件只存在于题面文字里，构图中没有任何体现；
2. 修复后模型又建了 `circleAC`（直径 AC），把 B、D 放到这个圆上——正好把斜边认反了；
3. P、Q 被写成 `free`，而题面要求它们是 `△BEM`、`△DFN` 的外心。

现在前端的构图编译器会：

- 从模型给出的题面中读取 `∠XYZ=90°`，按 **顶点 Y、斜边 XZ** 建立 `diameter(X,Z)`；
- 若模型建了端点本身就是直角顶点的“直径圆”（如 `circleAC`），判定为错误斜边并删除，依赖它的点回到自由点；
- 再把 A、C 提升为 `pointOnCircle(diameter(B,D))`；
- P、Q 由 `triangleCenter(O, [B,E,M])`、`triangleCenter(O, [D,F,N])` 生成；
- 校验交点、外心、相切目标；失败时最多自动修复两次，每次把原图、上次 JSON 和具体失败原因一起送回模型。

修复后的结构：

```text
B, D = free
diamBD = circle diameter(B,D)
A, C = pointOnCircle(diamBD)
E = reflectLine(A, lineCB)
F = reflectLine(A, lineCD)
M = intersection(lineAE, lineBD)
N = intersection(lineAF, lineBD)
P = circumcenter(B,E,M); omegaP = circle threePoints(B,E,M)
Q = circumcenter(D,F,N); omegaQ = circle threePoints(D,F,N)
goal = tangent(omegaP, omegaQ)
```

## 已补齐的通用缺口

- 构造规范：`name`/`label`、`kind`/`sub`、`sub_type`、`type` 混用；`triangleCenter` 三点依赖；`line`/`circle` 作为类型名；缺省三角形顶点；`data.circles` 与 `construction` 去重。
- 新派生点：`angleEqualOnCircle`、`pointOnLineDistance`、`pointOnCircleDistance`、`triangleCenter` 三点形式、`orthocenter/incenter/centroid/ninePointCenter/excenter` 便捷名。
- 圆与线段求交：无交点时自动改用整条直线（几何题里“交 BC 于”通常指直线）。
- 分支选择：先按原图坐标，再按模型声明的条件残差做局部搜索；同一对曲线的两个交点强制分到不同分支。
- 循环依赖：圆过某点、该点又由圆定义时，自动插入隐藏的“半径辅助点”或把点退为自由点。
- 圆内接四边形、等长、等角、直角（Thales）等题面条件提升为构造；直角条件不再把 `∠ABC>90°` 误判为 `=90°`。
- 校验：点是否存在/有效、依赖是否悬空、坐标偏差、模型声明的等长/等角/共线/共圆/平行/垂直/相切残差；失败原因直接作为下一次修复的输入。
- 日志：`/api/logs` 现在保存完整请求、系统提示词、模型原始返回、解析后的 JSON、失败点、耗时和 token 用量。

## 仍未解决

- 轨迹/定点（第 15、40 题）没有目标类型；
- 条件点只给了自由坐标、没有给出可求解约束（第 26、31、35、41 题）；
- 少数构型在模型坐标下退化（第 22、27、36、37 题），目前按原图坐标兜底绘制，不能保证动态正确；
- 圆幂/根轴/公切圆族仍主要依赖模型自己给出构造。

## 复现

```bash
# 需要先启动后端（建议新端口，避免旧进程缓存）
python3 server.py --host 127.0.0.1 --port 4174
VISION_API=http://127.0.0.1:4174/api/vision \
  node test/league100_pipeline.mjs --start 1 --end 50 --jobs 3 --repairs 2 --force true
```

## 首次识别（不做修复）抽样

对第 1–20 题只跑第一次识图、不触发修复，按“阻塞错误”统计（`⚠` 开头的约束/坐标警告不计入失败）：

- 13 / 20 首次即通过（65%）；
- 7 / 20 仍有缺失派生点，需要第二次修复或人工；
- 典型失败是“直线 l 由它自己的交点 D、E 定义”这类循环依赖，以及条件点只给自由坐标。

这说明“首次 0%”不是模型每次都不行，而是旧版把循环依赖造成的整片退化点都算成了失败；修复循环依赖后，首次通过率已经能到约六成，但离“大部分任意图首次即正确”仍有差距。

## 内心·垂直平分线题（用户样例）

题面：`I` 为内心，任意直线 `l` 交 `AI,BI,CI` 于 `D,E,F`，`x,y,z` 为 `AD,BE,CF` 的垂直平分线，证明 `x,y,z` 围成三角形的外接圆 `Θ` 与 `ABC` 外接圆 `ω` 相切。

旧输出的根因：

1. `lineL` 用 `deps:["D","E"]` 定义，而 D、E 又是 `l` 与 `AI/BI` 的交点——循环依赖，导致 D/E/F/P/Q/R/S 全部退化为自由点；
2. `x,y,z` 依赖 D/E/F，随之全部失效；
3. 目标 `Θ` 没有生成，所以首次校验必然失败。

现在：

- 识别到“直线由自身交点定义”时，自动插入两个隐藏自由端点，`l` 变成真正自由的直线，D/E/F 再按交点求；
- 交点分支改为越界时夹到有效分支，避免单交点被 `branch:1` 误判退化；
- 顶层的 `segments/lines/circles` 全部补画；
- 目标 `circlesTangent` 正常建立。

首次结果：23 个构造对象、0 个无效点、`Θ` 与 `ω` 相切残差 `3.6e-15`、0 条警告。回归文件：`test/incenter-perp-vision-v6.json`。

## 旁切圆·切点·中点题（用户样例）

题面：`ω` 为角 A 内的旁切圆，`D,E,F` 为 `ω` 与 `BC,CA,AB` 的切点；`P,Q=(AEF)∩BC`，`M` 为 `AD` 中点，证明 `(MPQ)` 与 `ω` 相切。

模型首次把 D、E、F 写成 `free`，把 ω 写成 `threePoints(D,E,F)`，等于没有旁切圆。  
现在编译器读到“旁切圆 + D、E、F 分别是 ω 与 BC、CA、AB 的切点”后：

- 建 `IA=triangleCenter(IA,[A,B,C])`；
- `ω=circle excircle(A,B,C,index=0)`；
- `D=foot(IA,lineBC)`、`E=foot(IA,lineCA)`、`F=foot(IA,lineAB)`；
- 后续 `(AEF)∩BC`、`M=midpoint(A,D)`、`(MPQ)` 全部动态派生。

首次结果：0 个无效点，`(MPQ)` 与 `ω` 内切残差 `2.9e-15`，0 条校验问题。回归文件：`test/a-excircle-vision.json`。

## 六边形·公共垂直平分线题（用户样例）

题面：凸六边形 `ABCC₁B₁A₁`，`AB=BC`，`AA₁,BB₁,CC₁` 有相同垂直平分线；`D=AC₁∩A₁C`，`E=(ABC)∩(A₁BC₁)` 异于 B，证明 `BB₁∩DE` 在 `(ABC)` 上。

模型首次把 A₁/B₁/C₁ 都写成 `free`，AB=BC 只写在 constraints，D/E 交点也因 schema 的 `sub/type` 顺序问题退化为自由点。

现在：

- 识别 `AB=BC`，把 C 放到以 B 为圆心、过 A 的圆上；
- 识别“AA₁、BB₁、CC₁ 有相同垂直平分线”，建一条自由直线 l，A₁/B₁/C₁ 全部由 `reflectLine` 得到；
- 兼容 `{sub:"point", type:"intersection"}` 这种“类型写在 type、对象写在 sub”的反向 schema；
- D/E/P 全部恢复为交点。

首次结果：0 个无效点，`BB₁∩DE` 在 `(ABC)` 上残差 `2.6e-15`，0 条校验问题。回归文件：`test/hexagon-vision.json`。

## 可选 mini-harness 构图复核

识图弹窗新增开关「使用 mini-harness 复核 / 修正」，默认关闭，选择状态保存在浏览器 localStorage。

触发条件：首次识图 + 前端编译后仍有**阻塞问题**（不是 `⚠` 约束警告）。流程：

1. 前端把题目、当前完整 construction JSON、失败原因发给 `POST /api/vision/review`；
2. 后端调用 miniharness mini-harness（`http://127.0.0.1:8000/v1/agent/run`，Key 在 `.secrets/miniharness_key`）；
3. agent 返回修正后的完整 JSON；
4. 前端重新 `buildVisionState` + `validateVisionState`，只有阻塞问题不增加时才采用；
5. 之后仍失败才继续走原来的多模态修复。

只发送文本，不发送图片；日志中记为「mini-harness 复核」，保存请求、系统提示词、原始返回、解析 JSON 和耗时。

回归样例：`test/hexagon-harness.json`。第一次识图把 A₁/B₁/C₁ 留成自由点、D/E 退化；harness 返回了公共垂直平分线 l 和三个 `reflectLine`，前端重建后 0 无效点、目标残差 `1.2e-14`。

## 内心·切点圆·∠IPM=90°（用户样例）

题面：`I` 为内心，内切圆切 `BC` 于 `D`，`M` 为 `BC` 中点，`AI` 交外接圆于 `L`，`ω` 以 `L` 为圆心且与 `AB,AC` 相切，`P=ω∩AD`，证明 `∠IPM=90°`。

模型首次的构造问题：

- `ω` 写成 `centerThrough(L,P)`，而 P 又是 `ω∩AD`，循环依赖；
- `L` 没有 coordinate，交点分支停在 A；
- 目标被写成 `IM⊥MP`，而题面是 `∠IPM=90°`，正确两条线是 `PI` 和 `PM`；
- 内切圆切点 D 没有带上 `side`，落到了 AB 上。

现在：

- 编译器把 `以 L 为圆心且与 AB 相切` 改成 `T=foot(L,lineAB)`、`ω=centerThrough(L,T)`；
- `L` 用题面坐标和最终分支复核选第二个交点；
- 目标从 `∠IPM=90°` 解析为 `PI⊥PM`；
- `incircleTouch` 保留 `side:"BC"`。

结果：D 在 BC 上，L 为 AI 与圆的第二交点，ω 为切圆，P 在 AD 上；∠IPM 残差 `1.7e-15`。只有模型自己写错的 `IM⊥MP` 约束留下一条 `⚠` 警告。回归文件：`test/incenter-midpoint-vision.json`。

## AB<AC·延长线等长·BC中垂线（用户样例）

题面：`X` 在 `BA` 延长线上且 `BX=AC`，`Y` 在 `CA` 上且 `CY=AB`，`XY` 与 **BC 的中垂线** 交于 `P`，证明 `∠BPC+∠BAC=180°`。

模型首次：

- `X` 的 `pointOnLineDistance` 长度写成 `BA`，落到 A；
- `Y` 的长度写成 `CA`，也落到 A；
- 于是 `lineXY` 退化，P 变自由点；
- 把 `XY 与 BC 的中垂线` 误解成 `perpbis(X,Y)∩BC`；
- 目标误判为 `BX=AC` 的 equalLength，而不是 angleSum。

现在编译器按句式重建：

```text
X = pointOnLineDistance(lineBA, B, A, C)
Y = pointOnLineDistance(lineCA, C, A, B)
P = intersection(lineXY, perpbis(B,C))
goal = angleSum([[B,P,C],[B,A,C]], 180°)
```

结果：X、Y、P 都在 BC 的 A 所在一侧，P 在 BC 中垂线上；角和 180°，残差 0。回归文件：`test/perpbis-bc-vision.json`。

## GLM / mini-harness 接入与空回复排查

GeoMind 的识图默认改为：

```text
POST http://127.0.0.1:8000/v1/agent/run
model: deepseek-flash
images: [data:image/jpeg;base64,...]
max_steps: 2
max_tokens: 96000
timeout: 600s
```

如果 GeoMind 报“大模型返回为空”，但现在错误里会附带 mini-harness `runId`：

```text
mini-harness 返回为空（runId run_...）；请到 mini-harness /admin/ui 查看该次调用正文
```

在 `http://127.0.0.1:8000/admin/ui` →「调用记录」按 runId 搜索，点「查看」可以看到完整 request messages、模型回复、reasoning、tool calls 和 token 用量。

常见原因：

- GLM 的 reasoning 吃掉了 completion 配额，`content` 为空；已把识图输出上限从 32k 提到 96k；
- mini-harness 请求体超过 32k prompt 限制（尤其是修复时附带大 JSON）；这种会走直连回退，直连也可能空回复；
- 直连回退模型达到自己的 token 上限。

GeoMind 自己的 `/api/logs` 也会记录 `runId`、steps、tokens 和状态 `empty`，方便和 mini-harness 对齐。

## 自由点约束求解器（DE=DF 样例）

题面：非等腰 `△ABC`，`AD,BE,CF` 为角平分线，`M,N` 为 `BC,EF` 中点，过 `M` 作 `AD` 平行线交 `AN` 于 `L`，证明 `L` 在外接圆上 **当且仅当** `DE=DF`。

模型给出的 A/B/C 初始坐标只满足“大致像”，`DE=1.3131`、`DF=1.2427`，条件不成立。

求解器：

- 未知量：与目标条件相关的自由点坐标（通过依赖图收集祖先自由点，这题是 A/B/C）；
- 残差：`Deq=|DE-DF|/scale`，用有限差分 Jacobian + Levenberg–Marquardt 迭代；
- 触发：题面出现“当且仅当”，且 goal 是 `equalLength`，自动把目标等式作为绘图条件求解；
- 也适用于模型写在 `constraints` 里的等长、等角、共线、共圆、平行、垂直、相切、中点、点在线上/圆上等条件。

结果：

```text
DE = 1.3844318159979252
DF = 1.3844317949152032
残差 = 1.5e-8
```

同时 L 到外接圆的偏差约 `3.8e-7`，符合“DE=DF ⇒ L 在外接圆上”。回归文件：`test/angle-bisector-solver.json`。

## 速度模式：默认关闭自动修复

为追求首次出图速度，识图弹窗新增「自动修复」开关，**默认关闭**：

- 关闭时：只调用一次 `/api/vision`，构建、校验后直接显示；失败只记录警告，不再发第二次/第三次请求；
- 开启时：才允许 mini-harness 复核和原来的两次多模态修复；
- 「使用 mini-harness 复核 / 修正」也必须配合「自动修复」才会触发；
- 两项选择都保存在 localStorage。

关闭自动修复不会跳过前端编译器、依赖补全、条件求解器和分支选择，只是不再回模型返工。
