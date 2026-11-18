// 拖拽合成：把「拖动的兵牌」当成材料，合到「被拖到的兵牌」上（目标留在原位置，等级 +1）
// 兵营页与布阵页共用；返回 mergeUnits 的结果，失败/满级时直接弹提示
import { mergeUnits, maxLevel } from '../core/merge.js';
import { troopById, unitName } from '../core/units.js';
import { playSfx } from '../core/audio.js';

export function mergeByDrag(game, targetId, materialId) {
  const r = mergeUnits(game.state, targetId, materialId);
  if (!r.ok) {
    playSfx('error', { volume: 0.7 });
    const why = r.reason === 'trial' ? '试用兵不能合成（试用期结束会自动消失）'
      : r.reason === 'max' ? `已满级 Lv${maxLevel()}，不能再合成`
      : r.reason === 'cap' ? `该兵种当前档位最高 Lv${r.cap}（第 250 关后放开），不能再升`
        : r.reason === 'troop' ? '兵种不同，不能合成（要同兵种 + 同等级）'
          : r.reason === 'level' ? '等级不同，不能合成（要同兵种 + 同等级）'
            : '合成失败：材料不匹配';
    game.toast(why);
    return r;
  }
  game.save();
  playSfx('merge');
  game.tutorialDone?.('merge');
  game.toast(`合成成功：${unitName(r.unit.troop, r.fromLevel)} → ${unitName(r.unit.troop, r.toLevel)} Lv${r.toLevel}`);
  return r;
}

// 拖动提示文案：目标是否可合成
export function dragHint(game, draggedUid, targetUid) {
  const dragged = game.state.units.find((u) => u.id === draggedUid);
  const target = game.state.units.find((u) => u.id === targetUid);
  if (!dragged || !target) return null;
  if (dragged.trialLeft > 0 || target.trialLeft > 0) return 'bad';
  return dragged.troop === target.troop && dragged.level === target.level ? 'ok' : 'bad';
}

// 兵种名（提示文案里用）
export function troopName(troopId) {
  return troopById(troopId)?.name || '';
}
