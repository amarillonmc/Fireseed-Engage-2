# 运维手册 / Operations Runbook

适用版本：Fireseed Engage 2.0（Node 24 + SQLite）  
目标规模：单进程、默认 ≤50 名玩家、内测/小规模公测。

---

## 1. 启动与停止

### 开发

```powershell
node server.mjs
# 或自动重启
node --watch server.mjs
```

### Windows 服务

使用 NSSM：

```powershell
nssm install Fireseed "C:\Program Files\nodejs\node.exe" "D:\Fireseed\server.mjs"
nssm set Fireseed AppDirectory "D:\Fireseed"
nssm set Fireseed AppEnvironmentExtra "HOST=127.0.0.1" "PORT=8080"
nssm start Fireseed
```

或任务计划程序：触发器“系统启动时”，操作 `node.exe server.mjs`，起始于项目目录。

### Linux systemd

见 README 的 unit 示例。日志：

```bash
journalctl -u fireseed -f
```

停止前建议先在后台开启维护模式，避免玩家操作丢失。

---

## 2. 端口与反向代理

- 默认监听 `127.0.0.1:8080`，不要直接暴露到公网。
- 通过 Caddy/Nginx/IIS ARR 终止 TLS 并反代。
- 反代必须保留：
  - `Host`
  - `X-Forwarded-Proto`
  - `X-Real-IP`（可选，当前仅用于日志）
- 应用在 `x-forwarded-proto: https` 时为会话 cookie 加 `Secure`。
- 不要在代理层缓存 `/api/*` 或 `index.html`；应用已设置 `no-store` / `no-cache`。

---

## 3. 数据库

路径：`data/fireseed.db`（WAL 模式）。相关文件：`-wal`、`-shm`。

### 备份

```powershell
# 推荐：短暂停机
Stop-Service Fireseed
Copy-Item data\fireseed.db data\backups\fireseed-$(Get-Date -Format yyyyMMdd-HHmmss).db
Start-Service Fireseed
```

在线备份（Python）：

```python
import sqlite3, datetime
src = sqlite3.connect('data/fireseed.db')
dst = sqlite3.connect(f"data/backups/fireseed-{datetime.datetime.now():%Y%m%d-%H%M%S}.db")
src.backup(dst)
dst.close(); src.close()
```

### 恢复

1. 停服。
2. 把备份复制回 `data/fireseed.db`，删除旧的 `-wal`/`-shm`。
3. 启动，运行 `node tools/smoke.mjs`，后台抽查用户/赛季。

### 压缩

停机后：

```sql
VACUUM;
```

### 迁移

`schema.sql` 只有 `CREATE TABLE IF NOT EXISTS`，不会给已有表加列。升级前：

1. 备份。
2. 在副本上执行迁移 SQL。
3. 验证 `node tools/smoke.mjs` + 登录 + 后台。
4. 再对生产执行。

---

## 4. 赛季操作

1. 发公告：赛季结束时间、保留/重置范围。
2. 后台 → 赛季 → 修改胜利占领时间（内测可 0.01 天）。
3. 等待胜利结算，或“立即结束赛季”。
4. 重建：输入 `REBUILD` → 重建。请求 20–40 秒；观察服务端日志。
5. 重建后检查：
   - 新赛季状态 active；
   - 玩家主城数量 = 玩家数；
   - 武将/技能/亮夜/永久科研/同盟保留；
   - 四色/回路/领地/设施重置；
   - 十二门与孔位置正确。
6. 公告新赛季开始与补偿。

**失败处理**：事务回滚，旧世界保留。查看日志，修复原因后重试；不要手工删除 `seasons` 行。

---

## 5. 监控

| 指标 | 方式 |
| --- | --- |
| 进程存活 | systemd / NSSM / 任务计划程序 |
| HTTP | `GET /api/health` 返回 `{ok:true}` |
| 错误 | stdout/stderr / journald；`[api]` 与 `[tick]` 前缀 |
| 数据库大小 | `data/fireseed.db` + WAL |
| 赛季状态 | 后台总览/赛季 |
| 在线 | 后台总览 |

建议外部 uptime 监控每 1–5 分钟请求 `/api/health`，并在进程退出时告警。

---

## 6. 安全清单

- [ ] 修改默认管理员密码。
- [ ] 绑定 `127.0.0.1`，通过 HTTPS 反代。
- [ ] 不在公网暴露 `data/`、`tools/`、`server/`、`doc/`。
- [ ] 只允许可信代理设置 `X-Forwarded-Proto`。
- [ ] 定期备份，且备份文件不在 Web 根。
- [ ] 关闭注册时设置 `registration_open=0`。
- [ ] 维护时设置 `maintenance=1`。
- [ ] 定期检查审计日志。
- [ ] 不要在生产开启 `NODE_ENV=development` 或输出调试。
- [ ] 限制后台账号数量；给每个管理员独立账号。
- [ ] 如果使用 CDN/WAF，允许 WebSocket 不需要（本应用只用 HTTP 轮询）。

---

## 7. 故障排查

| 症状 | 排查 |
| --- | --- |
| 启动报 `ERR_UNKNOWN_BUILTIN_MODULE: node:sqlite` | Node 版本过低；升级到 Node 24+ |
| 启动后卡住 20–40 秒 | 首次生成 512×512 世界，正常；看 stdout |
| `EADDRINUSE` | 端口被占用；改 `PORT` 或停止旧进程 |
| 登录 403 `csrf` | 页面会话过期；刷新；确认反代没有改写 cookie |
| 所有玩家 503 | 维护模式开启；后台改回 0 |
| 地图空白 | `/api/map` 500；看日志；确认 DB 完整 |
| 资源不增长 | `resource_tick_seconds` 过大；用户离线超过 `offline_cap_hours` |
| 赛季重建失败 | 事务回滚；检查磁盘空间/DB 锁；重试 |
| 卡图 404 | `public/assets/generals/<file>.webp` 缺失；后台重新上传/填 URL |
| 时间显示异常 | 服务器时区；应用内部用 epoch ms，前端本地化；不影响结算 |

---

## 8. 容量与扩展

当前为单进程 + SQLite：

- 适合 ≤50 玩家、每秒几十个请求。
- 若需更大规模：
  - 把 SQLite 换 PostgreSQL/MySQL（重写 `server/db.mjs` 与 SQL 方言）；
  - 把 tick 拆为独立 worker；
  - 引入 Redis 缓存；
  - 地图分块存储/预渲染；
  - 会话存 Redis。
- 不要在多进程间共享 SQLite 写入；如需多进程，先做数据库迁移。

---

## 9. 发布检查清单

- [ ] `node --check` 全部 server/public JS。
- [ ] `node tools/smoke.mjs`。
- [ ] 登录、建城、训练、研究、抽卡、出征、战报。
- [ ] 中/英切换，关键页面无残留中文/英文。
- [ ] 后台用户/武将/技能/赛季/设置可打开。
- [ ] 备份已做。
- [ ] 公告与维护窗口已通知。
- [ ] 回滚方案：上一版代码 + 赛前 DB 快照。
