// Off the page's thread: settle whether panels the quick check gave up on have
// any line at all. A whole-room panel can take a second or two to prove empty.
import { ROOMS } from './levels.js';
import { hedgeSet, findLine } from './logic.js';

onmessage = ({ data: { id, room, paths, panels } }) => {
  const rm = ROOMS[room], H = hedgeSet(rm, paths);
  postMessage({ id, dead: panels.filter((i) => findLine(rm, rm.panels[i], H, 3e6) === null) });
};
