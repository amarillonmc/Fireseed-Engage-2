# NOTICE / 第三方声明

本仓库是一个**非商业同人重制项目**，与任何原作公司无关联。以下声明适用于第三方素材与角色来源。

## 1. 原案 / Original concept

《メガミエンゲイジ！》/ *Megami Engage!*  
© G-MODE / ONE-UP / Marvelous Inc. and the respective rights holders of the participating works.  
The original service ran from 2012 to 31 March 2017. This project does not include original game code, original card illustrations, or original Japanese UI text.

## 2. Jewel Savior FREE

24 Vanguard illustrations are taken from the **Jewel Savior FREE** (ジュエルセイバーFREE) royalty-free material pack, distributed as `jewel-s-free101j.zip` by Brilliant Service Co., Ltd.

Required attribution (per the original terms):

> Title: [ジュエルセイバーFREE] / [JewelSaviorFREE]  
> URL: <http://www.jewel-s.jp/>

The original terms permit copying, public transmission, adaptation and secondary use, provided that the title/URL attribution is present and the use does not violate Japanese law or constitute obscenity. This project includes the attribution in the game's Archive modal, the repository README, and this NOTICE.

Source mirror used for development: `jewel-s-free101j` (local copy). Original README states the site and zip have been unavailable since mid-2019.

## 3. ProjectK / Kemono Friends 3

12 Vanguard characters are inspired by character data from **ProjectK**, an archive of *Kemono Friends 3* scenario and character material. The card illustrations for these Vanguards were newly generated with an image model using the archived character portraits as visual references. **No Kemono Friends game asset is redistributed as a card image.** Character names, species motifs and personalities remain the property of their respective rights holders.

Kemono Friends / けものフレンズ and related characters © Their respective rights holders. This is fan work; no affiliation or endorsement is claimed.

## 4. Generated imagery

The following images were generated for this project with **Gemini 2.5 Flash Image**:

- `public/assets/bg/hero.png` → `hero.webp`
- `public/assets/bg/city.png` → `city.webp`
- `public/assets/bg/bore.png` → `bore.webp`
- `public/assets/generals/kf_*.png` → `kf_*.webp` (12 ProjectK Vanguards)

Prompts and reference paths are recorded in `doc/asset-provenance.md`.

## 5. Fonts and libraries

- No bundled web fonts. The interface uses system font stacks (Bahnschrift, Segoe UI, Microsoft YaHei UI, Cascadia Mono, Consolas, etc.).
- Server uses only Node.js built-in modules (`node:http`, `node:sqlite`, `node:crypto`, `node:fs`, `node:path`, `node:url`).
- Client uses only browser-native HTML/CSS/ES modules. No third-party JavaScript runtime is bundled.

## 6. Data sources used during research

- User-provided `designasset/` documents and `xzz_data` card/skill archive.
- Public pages and screenshots of the original game, as listed in `doc/original-research.md`.
- Internet Archive was temporarily offline during the research window; no Wayback captures are redistributed.

## 7. Code license

The original code in this repository is provided for the user's private, non-commercial fan project. Third-party assets remain under their own terms above. If you intend to publish or commercialise, independently verify every asset and character licence.
