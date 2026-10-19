# 原作资料与复刻依据 / Original Research & Fidelity Notes

调查日期 / Research date: 2026-10-19  
调查人 / Researcher: Fireseed Engage project  
方法 / Method: 本地资料优先；公开网页检索与原文抓取；Internet Archive 在调查时段不可用（503），未使用其快照。

---

## 1. 已确认的事实 / Confirmed facts

| 事实 | 来源 |
| --- | --- |
| 《メガミエンゲイジ！》是 G-MODE 开发、ONE-UP 运营的浏览器战略模拟 RPG，2012 年先在 mixi 平台上线，后推出官方网页版，2017 年 3 月 31 日停服 | 用户提供的设计文档草稿 `designasset/日本网页游戏《メガミエンゲイジ》设计文档草稿.docx`；[ネトゲブックマーク 游戏页](https://netgamebm.com/games/view/600)；[停服新闻](https://netgamebm.com/game_news/view/78502/) |
| 以跨作品 Galgame 角色为卖点，登场角色总数 577，曾获吉尼斯“跨作品登场角色最多的卡牌游戏”认定 | 设计文档草稿；[MANTANWEB 报道](https://mantan-web.jp/article/20140131dog00m200017000c.html)；[PR TIMES 资料](https://prtimes.jp/a/?c=7428&r=1&f=d7428-20130522-4947.pdf) |
| 原作有太阳/月/星/大地四位女神与四阵营；玩家为“Master”，经营都市、召唤角色、争夺领地 | [low-game 介绍](http://low-game.com/slg/megamiengage.html)；[game-stalker 介绍](http://game-stalker.com/megamiengeiji.html) |
| 卡牌有稀有度（B/A/S/SS/P）、COST、攻击/防御/智力/速度、HP、技能；卡面可显示数值，卡背/翻转显示技能 | 用户提供数据；[4Gamer 卡牌截图](https://www.4gamer.net/games/178/G017898/20121101066/screenshot.html?num=012)；[4Gamer 图片库](https://www.4gamer.net/games/178/G017898/screenshot.html?mode=thumbs) |
| 原作包含基地/设施/资源、部队、领地、阵营战、赛季、抽卡、技能点等；后期有 Raid/Arena/Battle Tower 等玩法 | 设计文档草稿；[Gamer 技能点系统报道](https://www.gamer.ne.jp/news/201210030032/)；[OnlineGamer P 稀有度报道](https://www.onlinegamer.jp/news/201406200017/) |
| 2014 年推出手机版《メガミエンゲイジ！クエスト》 | [Famitsu App 报道](https://app.famitsu.com/20141030_460469) |

> 以上“事实”来自公开资料与用户文档的交叉印证。具体数值（卡牌属性、技能倍率、UC 概率等）并没有完整的官方公开表；用户提供的 `xzz_data` 是现存最完整的卡名/技能文本档案之一。

## 2. 用户提供的数据 / User-provided data

位于 `designasset/`：

- `initial-setting.txt`：魔改后的核心规则（六色资源、思考回路、24×24 城塞、十二门、兵种、技能、科技、赛季边界）。
- `internal-beta-readiness-spec-20260719.txt`：内测准入、跨赛季资产、赛季重建、经济、科研、地图与侦察、数值来源优先级。
- `日本网页游戏《メガミエンゲイジ》设计文档草稿.docx`：原作机制综述与参考来源。
- `xzz_data/cards.json` / `cards.md`：4,708 张卡片的 ID、卡名、技能引用、同一角色关系。
- `xzz_data/skills.json` / `skills.md`：470 个技能的名称、等级 1–10 的效果文本、COST/CT。
- 旧实现 `../fireseed-engage`（工作区外）的 `doc/`：武将、NPC、设施、科技、技能设计文档；本项目参考了其设计意图，但代码为全新 Node/SQLite 实现。

数据修复说明：`cards.json` / `skills.json` 是 Shift-JIS 文本被当作 Latin-1 再存为 UTF-8 的“双重乱码”。本项目没有直接把这些乱码写入游戏，而是从原始 CSV/日文文本中抽取可用结构，并用新的中英双语内容重写。`xzz_data` 中卡名与技能文本可用于后续建立完整卡库；当前种子只选取了 24 个技能作为框架范例。

## 3. 原作 UI 观察 / UI observations

从 4Gamer 与 game-stalker 的低分辨率截图可确认：

- 卡面：左上稀有度 + COST，右下元素图标，底部姓名与版权来源；卡牌可翻面看技能。
- 卡背/详情：ATK/DEF/INT/SPD 数值、HP 条、稀有度色框。
- 页面：顶部资源条 + 横向功能菜单（拠点/デッキ/施設/領地/地図/部隊/アリーナ/ランキング/メール/クエスト），中央主视图，弹窗/浮层操作。
- 基地：鸟瞰网格、彩色水晶矿、建筑等级、浅色系 UI、萌系卡牌框。

本项目保留“顶部资源条 + 横向导航 + 中央主视图 + 浮层”的信息架构，但视觉改为深色 synthpunk；没有复刻原作的具体像素布局或素材。

## 4. 复刻取舍 / Fidelity decisions

### 保留

- 24×24 城塞网格与设施占格。
- 六色资源、亮/夜低产率、四色建造/训练、思考回路占领。
- 12 门 + 中央孔；门在钟表盘方向、孔在正中心。
- 兵种相克/攻城、锤子兵破耐久、侦察、行军倒计时。
- 武将稀有度/COST/元素/四维/三技能、升级、抽卡、重复。
- 科技、任务、同盟、排名、赛季保留边界。
- 卡牌翻面查看技能。

### 改写

- 四位女神/日月星 → 六商会；避免使用原作阵营术语。
- CP/MP 付费 → 亮晶晶/夜静静，纯游戏内获得；无真实付费。
- 魔力 → 六色资源；Charisma → 思考回路。
- 原作角色 → Jewel Savior FREE + ProjectK 再绘角色；不复用原作卡图。
- UI 视觉 → synthpunk 深色霓虹；原作浅色萌系仅作为信息架构参考。
- 原作后期 Raid/Arena/Tower → 未实装；聚焦魔改文档的核心循环。

### 未取得 / 不可确认

- 原作的完整卡牌数值表、抽卡概率、赛季时长、活动排期。
- 原作的完整 UI 截图/素材（Internet Archive 调查时 503；4Gamer 只有少量低分辨率图）。
- 原作的服务器端逻辑、数据库结构。
- 原作的音乐/音效。

这些空白不影响本项目的可玩循环，但意味着“数值 1:1 复刻”不可能；本项目以用户魔改文档 + 可配置框架重现“结构与手感”。

## 5. 参考链接 / References

1. ネトゲブックマーク：メガミエンゲイジ <https://netgamebm.com/games/view/600>
2. ネトゲブックマーク：服务结束新闻 <https://netgamebm.com/game_news/view/78502/>
3. 4Gamer：BROWSER版 メガミエンゲイジ！图片库 <https://www.4gamer.net/games/178/G017898/screenshot.html?mode=thumbs>
4. 4Gamer：2012-11-01 截图页 <https://www.4gamer.net/games/178/G017898/20121101066/screenshot.html?num=012>
5. game-stalker：メガミエンゲイジ <http://game-stalker.com/megamiengeiji.html>
6. ローゲームラボ：メガミエンゲイジ！ <http://low-game.com/slg/megamiengage.html>
7. atwiki：メガミエンゲイジ @ ウィキ <https://w.atwiki.jp/megamiengage/>
8. Seesaa Wiki：メガミエンゲイジ！攻略Wiki（调查时 503） <https://seesaawiki.jp/megamiengage/>
9. view.xzz.jp：メガミエンゲイジ Memory（卡牌/技能数据库，用户数据来源） <https://view.xzz.jp/>
10. PR TIMES：メガミエンゲイジ 资料 PDF <https://prtimes.jp/a/?c=7428&r=1&f=d7428-20130522-4947.pdf>
11. OnlineGamer：P 稀有度/婚纱召唤报道 <https://www.onlinegamer.jp/news/201406200017/>
12. Gamer：技能点系统报道 <https://www.gamer.ne.jp/news/201210030032/>
13. Famitsu App：メガミエンゲイジ！クエスト <https://app.famitsu.com/20141030_460469>
14. MANTANWEB：吉尼斯认定报道 <https://mantan-web.jp/article/20140131dog00m200017000c.html>
15. Internet Archive CDX API（调查时 503，未使用） <https://web.archive.org/cdx/search/cdx?url=megamiengage.jp&output=json>

## 6. 来源可靠性分级

- **A（可直接支撑实现）**：用户提供的魔改文档、内测规格、`xzz_data` 结构、Jewel Savior FREE 授权文本。
- **B（可支撑背景/UI 参考）**：4Gamer、game-stalker、low-game、PR TIMES、OnlineGamer 等公开报道。
- **C（背景/二手）**：攻略 Wiki、玩家回忆、设计文档草稿中的综述段落。
- **D（不可用）**：Internet Archive（调查时离线）、失效的官方下载页、原作服务端。

本项目在文档与代码注释中只把 A/B 级来源当作事实；C 级只用于氛围与命名参考；D 级明确标注“未取得”。
