# 后台操作指南 / Administration Guide

入口：登录后访问 `/#/admin`，或点击页首/导航中的 **后台 / ADMIN**。只有 `users.role = 'admin'` 的账号可见。

## 1. 总览 / Overview

- 玩家、在线、城塞、已占地块、行军中、持有武将、战报、NPC 数量。
- 当前赛季、商会分布、经济总量、战力榜、最近审计。
- 所有数值实时（请求时）计算，不是缓存。

## 2. 用户 / Users

搜索账号或显示名。点击“详情”：

- 修改显示名、角色（player/admin）、状态（active/banned）、所属商会、界面语言。
- 直接重置密码（清空该用户全部会话）；返回的新密码只显示一次。
- 发放/扣除货币：亮晶晶、夜静静、思考回路、四色资源、计时胶带。
- 查看城塞、武将、科技、同盟、附庸、最近战报。
- 封禁会立即阻止登录与受保护 API；封禁原因可写。

> 管理员不能删除自己；请另建一个 admin 账号作为备份。

## 3. 武将库 / Generals

字段（全部显式存储，不依赖代码）：

| 字段 | 说明 |
| --- | --- |
| `key` | 唯一键，创建后不可改；用于种子/导入 |
| `name_zh` / `name_en` | 名称 |
| `title_zh` / `title_en` | 称号 / 呼号 |
| `source` / `source_ref` | 来源与来源编号（如 Jewel 卡号、ProjectK pageId） |
| `rarity` | B / A / S / SS / P |
| `cost` | 1.0–4.0，0.5 步进 |
| `element` | lumen/ember/cryo/bloom/radiance/umbra |
| `base_atk/def/spd/int` | 基础四维（1–300）；HP 固定 100 |
| `art_url` | 卡图路径或 URL；可用“上传卡图”写入 `public/assets/generals/admin_*` |
| `innate_skill_id` | 固有技能；从技能库下拉选择 |
| `pool_weight` | 同稀有度内的抽取权重 |
| `enabled` | 关闭后不进卡池、不出现在全部档案 |
| `lore_zh/lore_en` | 档案摘录 |

操作：新建、编辑、复制（生成 `_copy_` 键）、停用（软删除，保留已拥有玩家数据）。

**重现原作卡**：按原作卡号建立 `source_ref`，填入名称/COST/稀有度/元素/属性/技能，上传卡图即可。属性公式会按等级与 COST 自动计算战斗数值。

## 4. 技能库 / Skills

- `key`、双语名称/描述、kind（active/passive）、element、rare、max_level、base_cooldown、duration。
- `effects` 是 JSON 数组。示例：

```json
[
  {"type": "production_pct", "scope": "all", "value": 0.08},
  {"type": "attack_pct", "value": 0.10}
]
```

- 主动增益示例：

```json
[{"type": "buff_attack", "value": 0.35, "duration": 600}]
```

- `pool_weight` 控制技能池权重；`enabled` 关闭后不再抽取（已拥有的卡仍保留）。
- 新增效果类型需要同步在 `server/engine.mjs`（城市/被动）或 `server/combat.mjs`（战斗）中实现聚合分支。

## 5. 赛季 / Season

- 查看历史赛季、状态、起止时间、胜者。
- 修改当前赛季胜利占领天数（支持小数；0.01 天 ≈ 14.4 分钟，适合内测）。
- “立即结束赛季”会将状态置为 ended，并给所有玩家发通知；不会立即清空世界。
- **原子重建**：
  1. 输入新的中/英赛季名、胜利占领天数。
  2. 在确认框输入 `REBUILD`。
  3. 点击“重建世界”。请求会持续 20–40 秒；期间不要重复点击。
  4. 成功：旧赛季 ended，新世界、主城、任务、资源全部重置；武将/技能/货币/永久科研/同盟保留。
  5. 失败：事务回滚，旧世界与旧赛季状态保留；查看服务端日志。

## 6. 设置 / Settings

设置按 JSON 存储在 `settings` 表；后台显示可读标签。重点：

- `map_width` / `map_height`：64–1024；**需要重建赛季才完全生效**。
- `npc_strength`：1.0 = 原作公式；0.08 = 内测校准。修改立即影响新生成/未结算的守军？已存在地块的 `max_durability` 不会被重算；重建后完全生效。
- `resource_tick_seconds`、`circuit_hours`、`storage_base`、`circuit_base_cap`。
- `registration_open`、`max_players`、`maintenance`。
- `starting_*`、`season_start_*`。
- `gacha_*` 与 `gacha_rates`（JSON，如 `{"B":48,"A":30,"S":15,"SS":6,"P":1}`）。
- `build_speed`、`research_speed`、`training_speed`、`march_speed`、`resource_yield`。
- `victory_hold_days`、`offline_cap_hours`、`season_rebuild_delay_hours`、`resource_claim_circuit`、`subbase_base_cap`。
- 维护模式：非管理员访问受保护 API 会收到 503；管理员仍可进入后台。建议在维护前先发公告。

## 7. 公告 / Announcements

双语标题与正文；`active` 控制首页通知条。只显示最新一条（`ORDER BY id DESC LIMIT 1`）。

## 8. 审计 / Audit

记录所有后台写操作：操作者、动作、目标、详情 JSON、时间。只读；用于追责和恢复上下文。

## 9. 战况 / Battles

- 最近 100 条行军：发起者、类型、起点/终点、兵力 JSON、到达时间、状态。
- 最近 60 条战报：用户、类型、标题、时间。
- 用于排查“为什么我的军队没到/没打下来”。

## 10. 常见运维动作

| 场景 | 操作 |
| --- | --- |
| 新赛季 | 后台 → 赛季 → 填名称/天数 → 输入 REBUILD → 重建 |
| 关闭注册 | 设置 → Registration open = 0 |
| 维护 | 设置 → Maintenance = 1；发公告；完成后改回 0 |
| 发放补偿 | 用户 → 详情 → 发放货币 |
| 封禁外挂 | 用户 → 详情 → 状态 banned；必要时重置密码 |
| 修卡 | 武将库 → 编辑；已拥有玩家的属性按新基础值重算 |
| 改卡池 | 技能/武将 `pool_weight` 或 `gacha_rates` |
| 数据备份 | 停机复制 `data/fireseed.db`；见 README |
