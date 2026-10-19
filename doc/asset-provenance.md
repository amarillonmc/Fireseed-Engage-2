# 资产生成与来源记录 / Asset Provenance

生成日期 / Generated: 2026-10-19  
图像模型 / Image model: **Gemini 2.5 Flash Image**（通过 `nemo_media` 的 `google` provider）  
后处理 / Post-processing: Python Pillow（尺寸、WebP、Jewel 卡图背景/扫描线/底部渐隐、联系方式表）；脚本见 `tools/prepare_assets.py`。

## 1. 背景 / Backgrounds

| 文件 | 尺寸 | Prompt 摘要 |
| --- | --- | --- |
| `public/assets/bg/hero.webp` | 1344×768 | 合成器朋克数据海主视觉：巨型钻台城塞、六色能量流、中央银色漩涡、地平线十二门塔、青/品红、CRT 扫描线、左侧留标题空间 |
| `public/assets/bg/city.webp` | 1344×768 | 俯视三分之四视角的海上城塞甲板，24×24 黑钢格栅、六色矿脉导管、中央总督府尖塔、青/品红霓虹、无角色/无文字 |
| `public/assets/bg/bore.webp` | 1024×1024 | 银白之孔：黑色数据海海底的巨大银色同心圆钻口、液态镜面、六色细流、服务器方尖碑、青银与品红警示灯 |

原始 PNG 在生成阶段用于检查；为控制仓库体积，交付副本只保留 WebP。可以通过提示词重新生成 PNG。

## 2. ProjectK 武将卡图 / ProjectK Vanguard art

所有图片以 ProjectK `data/friend_dossiers/assets/outfit_first/<pageId>.png` 为参考图，重绘为合成器朋克版本；**没有把参考图直接贴进卡面**。输出为 832×1248，2:3，再转 WebP。

共同风格：动漫科幻卡图、2:3 竖幅、无文字无卡框、合成器朋克装备、深色数据海/服务器背景、青/品红霓虹边缘光、halftone 颗粒。

| 输出 | 角色 | ProjectK pageId | 参考图 | 关键设定 |
| --- | --- | --- | --- | --- |
| `kf_2.webp` | 薮猫 Serval | 2 | `outfit_first/2.png` | 橙色技术夹克、发光接缝、霓虹尾环、漂浮无人机、废墟服务器大教堂 |
| `kf_3.webp` | 耳廓狐 Fennec | 3 | `outfit_first/3.png` | 沙频黑客服、天线耳、护目镜、波形全息、黑色盐漠太阳能阵列 |
| `kf_4.webp` | 浣熊 Common Raccoon | 4 | `outfit_first/4.png` | 废料黑客夹克、工具带、机械浣熊尾、水淹服务器废料场 |
| `kf_7.webp` | 美洲豹 Jaguar | 7 | `outfit_first/7.png` | 黑金外骨骼、霓虹豹斑、利爪护手、水淹停车场 |
| `kf_8.webp` | 苏利羊驼 Alpaca Suri | 8 | `outfit_first/8.png` | 光纤毛线、织工外套、暗色纺织档案库、金/青光线 |
| `kf_9.webp` | 狮子 Lion | 9 | `outfit_first/9.png` | 镀金外骨骼、金色光纤鬃领、指挥披风、破碎企业王座厅 |
| `kf_13.webp` | 北狐 Ezo Red Fox | 13 | `outfit_first/13.png` | 北境信使大衣、毛领兜帽、保温服、极光屋顶中继站 |
| `kf_14.webp` | 银狐 Silver Fox | 14 | `outfit_first/14.png` | 白青信使外骨骼、全息挎包、磁力索、冻结单轨隧道 |
| `kf_16.webp` | 棕熊 Brown Bear | 16 | `outfit_first/16.png` | 锈铜/深绿重装装载外骨骼、液压肩、服务器机柜、坍塌数据穹顶 |
| `kf_24.webp` | 皇家企鹅 Royal Penguin | 24 | `outfit_first/24.png` | 白/金仪仗队制服、黑披风、铬肩章、水淹阅兵厅 |
| `kf_25.webp` | 帝企鹅 Emperor Penguin | 25 | `outfit_first/25.png` | 白色冷却工程师甲、橙色喙形呼吸器、机械幼崽、冻结冷却大教堂 |
| `kf_53.webp` | 鲸头鹳 Shoebill | 53 | `outfit_first/53.png` | 石板灰战术风衣、铬肩甲、喙形瞄准镜、冷却步枪、雨中的水淹服务器湿地 |

提示词均要求“no text, no logos, no card frame”，避免模型把标题/卡框画进卡图。

## 3. Jewel Savior FREE 立绘 / Jewel portraits

来源：`D:\Github\jewel-s-free101j\image\character\fXXX.png`（600×800 透明/带背景立绘）。  
授权：Jewel Savior FREE，需标注标题与 URL；见 `NOTICE.md`。

后处理：

1. 裁去多余透明边缘。
2. 生成 600×800 的深色程序化背景（元素色径向辉光、30px 青网格、斜向警示条、扫描线）。
3. 将角色居中偏下合成，元素色描边辉光。
4. 底部 150px 渐隐，交给 CSS 名称牌。
5. 输出 WebP quality 88。

使用的 24 张：

| 卡号 | Jewel 图像 | 元素 | 角色 |
| --- | --- | --- | --- |
| 189 | f124 | umbra | 黑伏 曜子 |
| 240 | f364 | ember | 虹逆 世界 |
| 275 | f068 | lumen | 莉希娅·科波拉 |
| 256 | f335 | cryo | 国代 伊依 |
| 200 | f228 | ember | 朱莲 J. 门上 |
| 205 | f090 | umbra | 御伽 美夜子 |
| 308 | f214 | radiance | 帕拉贝伦修女 |
| 223 | f134 | bloom | 顶 晴花 |
| 316 | f370 | cryo | 雪目 苏库里 |
| 387 | f122 | radiance | 弓月 玲那 |
| 274 | f067 | lumen | 莉希娅·科波拉（回声） |
| 292 | f125 | cryo | 帆村 明 |
| 294 | f101 | lumen | 樱珠 真鱼 |
| 307 | f213 | radiance | 帕拉贝伦修女（回声） |
| 341 | f211 | bloom | 樱 结衣 |
| 132 | f128 | bloom | 石神 珠子 |
| 401 | f242 | bloom | 结发 日向 |
| 394 | f245 | ember | 鸟谷 茜 |
| 140 | f178 | umbra | 抚月 怜 |
| 151 | f078 | ember | 姬乃 蜜柑 |
| 192 | f150 | radiance | 夏野 向日葵 |
| 202 | f303 | bloom | 无色衣 诗音 |
| 326 | f004 | ember | 司马 萌香 |
| 287 | f086 | cryo | 水代 香莲 |

## 4. 图标 / Icons

`public/assets/icons/favicon.svg` 与界面图标均为手写 SVG（CSS `currentColor`），未使用第三方图标库。

## 5. 未使用 / Not used

- 原作《メガミエンゲイジ！》的卡图、UI 素材、Logo、音乐。
- ProjectK 的原始游戏立绘作为卡面（仅作为生成参考）。
- Internet Archive 快照（调查时不可用）。
- 任何真实货币/支付 SDK。
