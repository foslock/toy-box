// Tilting a phone turns a zoomed-in card. The card seems to hold still while the phone tilts around it, as if you
// were looking at a real card from a new angle, so its foil catches the light. The angles come from the phone's
// orientation sensor, measured from how it was held when the card came up, and they ease back to the middle if the
// phone stays tilted, so a card never ends up stuck on its side.
import * as THREE from 'three';

const DEG = Math.PI / 180, OUT = new THREE.Vector3(0, 0, 1);
const euler = new THREE.Euler(), rel = new THREE.Quaternion(), n = new THREE.Vector3();

export class PhoneTilt {
  constructor() {
    const DOE = window.DeviceOrientationEvent;
    this.supported = !!DOE;
    // iPhones ask the player first (and only from a tap); everything else just sends readings
    this.state = DOE && typeof DOE.requestPermission === 'function' ? 'ask' : 'ok';
    this.now = new THREE.Quaternion(); this.base = null;
    this.on = false; this.fresh = false;
    this.x = 0; this.y = 0;   // how far to turn the card about the screen's horizontal and vertical axes, in radians
    this.movedAt = -1e9;      // when the phone was last being tilted on purpose (faster than a hand's tremble)
    this.onDenied = null;
    this.read = this.read.bind(this);
  }
  get live() { return this.on && this.fresh && this.state === 'ok'; }
  start() {
    if (!this.supported || this.state === 'no' || this.on) return;
    this.on = true; this.fresh = false; this.base = null; this.x = this.y = 0;
    addEventListener('deviceorientation', this.read);
  }
  stop() {
    if (!this.on) return;
    this.on = false; this.fresh = false;
    removeEventListener('deviceorientation', this.read);
  }
  // Ask for the sensor if the browser wants permission. Only works from a tap or click. Resolves true if allowed.
  ask(again = false) {
    if (again && this.state === 'no') this.state = 'ask';
    if (this.state !== 'ask') return Promise.resolve(this.state === 'ok');
    this.state = 'asking';
    return DeviceOrientationEvent.requestPermission().then(r => {
      this.state = r === 'granted' ? 'ok' : 'no';
      if (this.state === 'no') { this.stop(); this.onDenied?.(); }
      return this.state === 'ok';
    }, () => { this.state = 'ask'; return false; });   // not from a tap: try again on the next one
  }
  read(e) {
    if (e.beta == null || e.gamma == null) return;
    // the phone's orientation: turned about its z axis by alpha, then x by beta, then y by gamma
    euler.set(e.beta * DEG, e.gamma * DEG, (e.alpha ?? 0) * DEG, 'ZXY');
    this.now.setFromEuler(euler);
    if (!this.base) this.base = this.now.clone();
    this.fresh = true;
  }
  update(dt) {
    if (!this.live) return;
    this.base.slerp(this.now, 1 - Math.exp(-dt / 3));   // the middle drifts to however the phone is held now
    // where a card that stayed put (facing the phone as it was) faces now, in the phone's axes, then the screen's
    rel.copy(this.now).invert().multiply(this.base);
    n.copy(OUT).applyQuaternion(rel);
    const a = -(screen.orientation?.angle ?? window.orientation ?? 0) * DEG, c = Math.cos(a), s = Math.sin(a);
    const sx = n.x * c - n.y * s, sy = n.x * s + n.y * c;
    const x = Math.atan2(-sy, n.z), y = Math.asin(Math.max(-1, Math.min(1, sx)));
    if (Math.hypot(x - this.x, y - this.y) > .15 * Math.max(dt, .001)) this.movedAt = performance.now();
    this.x = x; this.y = y;
  }
}
