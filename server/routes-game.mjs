import { route, requireUser } from './http.mjs';
import { get, all } from './db.mjs';
import { createSession, destroySession } from './auth.mjs';
import {
  registerUser, loginUser, bootstrapView, stateView, cityView, buildFacility, upgradeFacility,
  demolishFacility, renameCity, trainUnits, instantFinish, assignGeneral, unassignGeneral,
  collectionView, skillCollectionView, drawGeneral, drawSkill, levelUpGeneral, equipSkill,
  unequipSkill, levelUpSkill, activateSkill, healGeneral, researchView, startResearch,
  shopView, buyShopItem, questView, claimQuest, mapView, claimTile, attackTile, scoutTile,
  attackPreview, tileView, rankingView, reportsView, markReports, chatView, postChat,
  allianceView, createAlliance, joinAlliance, leaveAlliance, profileView, movementView, convertSubbase, abandonTile, reinforceTile,
} from './actions.mjs';
import { SHOP_ITEMS } from './content.mjs';

const num = (v) => Number(v);

route('POST', '/api/register', async (ctx) => {
  const { userId } = registerUser({
    username: ctx.body.username, displayName: ctx.body.displayName, password: ctx.body.password,
    charter: ctx.body.charter, locale: ctx.body.locale,
  });
  const session = createSession(userId, ctx.ip, ctx.req.headers['user-agent'] || '');
  ctx.setSession(session.token, session.csrf);
  return { user: bootstrapView({ ...ctx, user: get('SELECT * FROM users WHERE id=?', userId) }).user, csrf: session.csrf };
});

route('POST', '/api/login', async (ctx) => {
  const { session, user } = loginUser({ username: ctx.body.username, password: ctx.body.password }, ctx);
  ctx.setSession(session.token, session.csrf);
  return { user, csrf: session.csrf };
});

route('POST', '/api/logout', async (ctx) => {
  if (ctx.session) destroySession(ctx.session.token);
  ctx.clearSession();
  return { ok: true };
});

route('POST', '/api/locale', async (ctx) => {
  const user = ctx.user;
  if (user) {
    const locale = ctx.body.locale === 'en' ? 'en' : 'zh';
    const { run } = await import('./db.mjs');
    run('UPDATE users SET locale=? WHERE id=?', locale, user.id);
    return { locale };
  }
  return { locale: ctx.body.locale === 'en' ? 'en' : 'zh' };
});

route('GET', '/api/bootstrap', async (ctx) => bootstrapView(ctx));
route('GET', '/api/health', async () => ({ status: 'ok', time: Date.now() }));

route('GET', '/api/state', async (ctx) => {
  const user = requireUser(ctx);
  return stateView(user.id, ctx);
});

route('GET', '/api/profile', async (ctx) => {
  const user = requireUser(ctx);
  return profileView(user.id);
});

route('GET', '/api/city/:id', async (ctx) => {
  const user = requireUser(ctx);
  return { city: cityView(user.id, num(ctx.params.id)) };
});

route('POST', '/api/city/:id/build', async (ctx) => {
  const user = requireUser(ctx);
  return buildFacility(user.id, num(ctx.params.id), ctx.body);
});
route('POST', '/api/city/:id/upgrade', async (ctx) => {
  const user = requireUser(ctx);
  return upgradeFacility(user.id, num(ctx.params.id), num(ctx.body.facilityId));
});
route('POST', '/api/city/:id/demolish', async (ctx) => {
  const user = requireUser(ctx);
  return demolishFacility(user.id, num(ctx.params.id), num(ctx.body.facilityId));
});
route('POST', '/api/city/:id/rename', async (ctx) => {
  const user = requireUser(ctx);
  return renameCity(user.id, num(ctx.params.id), ctx.body);
});
route('POST', '/api/city/:id/train', async (ctx) => {
  const user = requireUser(ctx);
  return trainUnits(user.id, num(ctx.params.id), ctx.body);
});
route('POST', '/api/city/:id/instant', async (ctx) => {
  const user = requireUser(ctx);
  return instantFinish(user.id, num(ctx.params.id));
});
route('POST', '/api/city/:id/assign', async (ctx) => {
  const user = requireUser(ctx);
  return assignGeneral(user.id, num(ctx.params.id), num(ctx.body.playerGeneralId));
});
route('POST', '/api/city/:id/unassign', async (ctx) => {
  const user = requireUser(ctx);
  return unassignGeneral(user.id, num(ctx.body.playerGeneralId));
});

route('GET', '/api/map', async (ctx) => {
  const user = requireUser(ctx);
  return mapView(user.id, { cx: num(ctx.query.get('cx') ?? 256), cy: num(ctx.query.get('cy') ?? 256), zoom: num(ctx.query.get('zoom') ?? 6) });
});
route('GET', '/api/tile/:x/:y', async (ctx) => {
  const user = requireUser(ctx);
  return { tile: tileView(user.id, num(ctx.params.x), num(ctx.params.y)) };
});
route('POST', '/api/map/claim', async (ctx) => {
  const user = requireUser(ctx);
  return claimTile(user.id, { x: num(ctx.body.x), y: num(ctx.body.y) });
});
route('POST', '/api/map/subbase', async (ctx) => {
  const user = requireUser(ctx);
  return convertSubbase(user.id, { x: num(ctx.body.x), y: num(ctx.body.y) });
});
route('POST', '/api/map/abandon', async (ctx) => {
  const user = requireUser(ctx);
  return abandonTile(user.id, { x: num(ctx.body.x), y: num(ctx.body.y) });
});
route('POST', '/api/map/attack', async (ctx) => {
  const user = requireUser(ctx);
  return attackTile(user.id, ctx.body);
});
route('POST', '/api/map/scout', async (ctx) => {
  const user = requireUser(ctx);
  return scoutTile(user.id, ctx.body);
});
route('POST', '/api/map/reinforce', async (ctx) => {
  const user = requireUser(ctx);
  return reinforceTile(user.id, ctx.body);
});
route('POST', '/api/map/preview', async (ctx) => {
  const user = requireUser(ctx);
  return attackPreview(user.id, ctx.body);
});
route('GET', '/api/movements', async (ctx) => {
  const user = requireUser(ctx);
  return { movements: movementView(user.id) };
});

route('GET', '/api/generals', async (ctx) => {
  const user = requireUser(ctx);
  return collectionView(user.id);
});
route('POST', '/api/gacha/general', async (ctx) => {
  const user = requireUser(ctx);
  return drawGeneral(user.id, ctx.body);
});
route('POST', '/api/gacha/skill', async (ctx) => {
  const user = requireUser(ctx);
  return drawSkill(user.id, ctx.body);
});
route('POST', '/api/general/:id/levelup', async (ctx) => {
  const user = requireUser(ctx);
  return levelUpGeneral(user.id, num(ctx.params.id));
});
route('POST', '/api/general/:id/equip', async (ctx) => {
  const user = requireUser(ctx);
  return equipSkill(user.id, num(ctx.params.id), num(ctx.body.playerSkillId), num(ctx.body.slot));
});
route('POST', '/api/general/:id/unequip', async (ctx) => {
  const user = requireUser(ctx);
  return unequipSkill(user.id, num(ctx.params.id), num(ctx.body.slot));
});
route('POST', '/api/general/:id/activate', async (ctx) => {
  const user = requireUser(ctx);
  return activateSkill(user.id, num(ctx.params.id), ctx.body.skillKey);
});
route('POST', '/api/general/:id/heal', async (ctx) => {
  const user = requireUser(ctx);
  return healGeneral(user.id, num(ctx.params.id));
});
route('GET', '/api/skills', async (ctx) => {
  const user = requireUser(ctx);
  return skillCollectionView(user.id);
});
route('POST', '/api/skills/:id/levelup', async (ctx) => {
  const user = requireUser(ctx);
  return levelUpSkill(user.id, num(ctx.params.id));
});

route('GET', '/api/research', async (ctx) => {
  const user = requireUser(ctx);
  return researchView(user.id);
});
route('POST', '/api/research', async (ctx) => {
  const user = requireUser(ctx);
  return startResearch(user.id, ctx.body.techKey);
});

route('GET', '/api/shop', async (ctx) => {
  const user = requireUser(ctx);
  return shopView(user.id);
});
route('POST', '/api/shop/buy', async (ctx) => {
  const user = requireUser(ctx);
  return buyShopItem(user.id, ctx.body.itemId);
});

route('GET', '/api/quests', async (ctx) => {
  const user = requireUser(ctx);
  return { quests: questView(user.id) };
});
route('POST', '/api/quests/:key/claim', async (ctx) => {
  const user = requireUser(ctx);
  return claimQuest(user.id, ctx.params.key);
});

route('GET', '/api/rankings', async (ctx) => {
  const user = requireUser(ctx);
  return rankingView(user.id, ctx.query.get('type') || 'power');
});
route('GET', '/api/reports', async (ctx) => {
  const user = requireUser(ctx);
  return { reports: reportsView(user.id) };
});
route('POST', '/api/reports/read', async (ctx) => {
  const user = requireUser(ctx);
  return markReports(user.id, ctx.body.ids);
});
route('GET', '/api/chat', async (ctx) => {
  const user = requireUser(ctx);
  return { messages: chatView(user.id) };
});
route('POST', '/api/chat', async (ctx) => {
  const user = requireUser(ctx);
  return postChat(user.id, ctx.body.body);
});

route('GET', '/api/alliance', async (ctx) => {
  const user = requireUser(ctx);
  return allianceView(user.id);
});
route('POST', '/api/alliance/create', async (ctx) => {
  const user = requireUser(ctx);
  return createAlliance(user.id, ctx.body);
});
route('POST', '/api/alliance/:id/join', async (ctx) => {
  const user = requireUser(ctx);
  return joinAlliance(user.id, num(ctx.params.id));
});
route('POST', '/api/alliance/leave', async (ctx) => {
  const user = requireUser(ctx);
  return leaveAlliance(user.id);
});
