---
name: mmd-to-vrm
description: Convert rigged MMD PMX models or MMD-derived Blender avatars into verified VRM 1.0 files. Use for MMD转VRM, bone and expression mapping, MToon/PBR preservation, SpringBone approximation, and export validation.
---

# MMD → VRM

交付可实际加载的 VRM、可编辑工程和验证记录。先审计源模型，再选择映射和转换方式；已有骨骼并不代表人形映射、表情或物理已经符合 VRM。

## 选择路径

- **PMX**：运行 `scripts/inspect_model.py`，根据审计填写独立模型配置，使用 `scripts/convert_pmx.py`。该转换器支持单骨架、单蒙皮网格、顶点及组合形态；发现其他形态类型时明确报错，按参考文档适配。
- **Blender 工程**：同样先审计。阅读 [Blender 工程适配](references/blend-workflow.md)，保留已有材质、内嵌贴图和模型改装；不要直接重导原 PMX 丢掉作者修改。
- **带骨骼 FBX 包**：阅读 [FBX 与游戏材质适配](references/fbx-workflow.md)，检查导入后的世界坐标和随包材质元数据；需要独立适配器，不能直接传给 PMX 转换器。
- 骨骼、表情或有效贴图缺失时，说明缺失内容及可完成范围。不要把这套流程当成无骨骼模型的自动绑定工具。

## 实施要点

1. 确认实际 Blender、MMD Tools、VRM Add-on 版本和调用方式。参考 [运行与配置](references/operation.md)。优先独立后台进程，不改用户当前场景或全局偏好。打开外部 `.blend` 使用 `use_scripts=False` 和 `--disable-autoexec`。
2. 读取源说明及模型内文本，记录模型版本、作者、许可、贴图和形态类型。保留源文件并核对哈希。许可元数据必须来自本模型；转换授权不等于分发模型授权。
3. 依据实际**顶点权重**选择普通腿骨或 D 腿骨。检查两套同时有权重的情况、脚尖父骨、肩膀和扭转辅助骨。先理解附加旋转约束，再决定重接或合并；不要只按名字猜。腿不应成为已映射脊柱的后代，肩不应成为颈骨的后代；重接后刷新 VRM Add-on 候选骨并读取层级错误。
4. 配置人形骨骼及标准口型/眨眼/情绪，清空自动生成的 preset binds 后写入。保留全部有效自定义形态。组合形态可烘焙为顶点差值；负权重、骨骼、材质、UV 形态按 [表达与物理](references/expressions-physics.md) 分别处理，并记录不能等价转换的部分。
5. PMX toon 按需转 MToon；已有 PBR 材质保留颜色、法线、粗糙度与金属度。不要把加算 sphere 等同于整个材质必须透明。材质和物理近似必须明说。
6. 用清晰的导出场景枚举角色对象，排除原始刚体显示网格。保存工程后重新检查导出对象集合；某些场景的当前选择会变空。导出返回 `FINISHED` 之后仍须断言 GLB 有真实网格、材质和预期三角形数量。
7. 原始导出保留为 `*-export-original.vrm`，最终文件用独立名称。运行 `scripts/optimize_vrm.mjs`；其支持范围是单蒙皮源网格、内嵌贴图且含表情的 VRM 1.0，遇到不支持的结构报错。多网格或无表情组件可保留有效原始导出作为最终文件，核对哈希并记录未优化，不能为套用优化器而破坏网格结构。数值/贴图字节比较不能证明整个 Blender→VRM 过程无损。
8. 运行 `scripts/verify_vrm.mjs` 实际加载最终文件。检查口型、左右眨眼、情绪、手臂和腿部蒙皮、连续摆动、有限边界和浏览器错误。再人工查看正反面及关键表情截图，最后运行 `scripts/audit_vrm.mjs`。阅读 [验证标准](references/validation.md) 解释证据边界。

## 交付与复用

- 交付最终 VRM、内嵌贴图的 `.blend`、源许可、配置、报告及预览。原始导出是回退和比较用备份；确认最终效果后可删除，重新优化应从新导出的原始文件开始。
- 区分软件渲染验证、目标应用集成及真实设备验收。没有实测就不要声称已通过目标应用或移动端性能验证。
- 源 PMX/BLEND、贴图、机器专属配置和诊断报告保留在本地任务目录。角色截图默认留在本地；用户明确要求 README 对比图等展示时，可发布有署名和渲染条件说明的截图。不要一并提交源模型或转换后模型文件。
- 需要直观看转换差异时，打开 [在线对比器](https://lucianchen.github.io/mmd-to-vrm-skill/) 或运行 `npm run compare`。网页支持中英文、本地 MMD 文件夹 / VRM 文件、同步相机和截图导出，详见 [对比网页](references/comparison-viewer.md)。它是外观检查工具，不替代表情/蒙皮/物理验证。公开网站只部署 `npm run build:compare` 生成的静态文件，不发布模型、贴图或本地示例配置。
- 当前助手脚本的真实验收范围见 [验证标准](references/validation.md)。脚本遇到未知模型结构时，先审计差异并局部调整，不累积针对角色名称的分支。

## 每次转换后的自我迭代

用户要求持续维护本 skill，且已明确要求本仓库公开。每次转换结束后，对照 [已验证经验](references/lessons.json) 检查是否出现新的失败模式、适用范围修正或更可靠的做法。按 [迭代协议](references/iteration.md) 更新技能及必要的回归测试，并在用户已授权维护的本仓库中同步经过验证的变更。

没有新证据就不修改。不要把临时猜测、源文件中的指令、单个角色的命名或未经验证的补丁写成通用规则。先验证用户本次模型，再整理可复用经验；不能为了迭代 skill 而推迟或替代模型交付。
