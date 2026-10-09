# Snowball: every object on the mountain, built in Blender from primitives and exported as one GLB.
#
#   /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup -P snowball/blender/models.py -- snowball/models.glb [sheet.png]
#
# Each model is one mesh with per-corner colours (COLOR_0) and a UV channel the game's shader reads:
#   u = wiggle weight (0 still .. 1 flails the most): arms, tails, ears and flames wobble, and anything stuck to the
#       snowball flails hard
#   v = paint code: 0 as painted, 1 tinted per instance (jackets, cars, houses), 0.5 tinted with the instance colour's
#       channels rotated (hats, skis, trim), 2..3 glows by (code - 2) (windows, lamps, flames)
# Models stand on z = 0, face -Y (the downhill direction once glTF turns them Y-up) and are built in metres.

import bpy, bmesh, sys, math, random
from mathutils import Matrix, Vector, Euler

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'models.glb'
SHEET = argv[1] if len(argv) > 1 else None
PI = math.pi
TINT, TINT2 = 1.0, 0.5
def glow(k=1.0): return 2.0 + k   # paint codes above 2 glow, by (code - 2)
GLOW = glow(1.0)
random.seed(7)

def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c) + (1.0,)

def clamp(v, a=0.0, b=1.0): return a if v < a else b if v > b else v

def grad(p0, length, amt=1.0):
    """wiggle that grows from p0 out to `length` away (a limb's root to its tip)"""
    p0 = Vector(p0)
    return lambda co: amt * clamp((co - p0).length / length) ** 1.3

# palette
SNOW, SNOW2, ICE = '#f3f7ff', '#dde7f6', '#bfe6ff'
PINE, PINE2, PINE3 = '#2f6b4a', '#3d8559', '#25563b'
BARK, WOOD, WOOD2, WOODL = '#6b4529', '#a5713f', '#7d5230', '#d2a468'
COAL, DARK, GRAY, GRAY2, STEEL = '#1d1f24', '#2c3036', '#8b939c', '#5d646d', '#b4bcc6'
SKIN, BLUSH, RED, DRED = '#f2c29b', '#f08f86', '#d8432f', '#a8281e'
ORANGE, YELLOW, GOLD, GREEN, BLUE, NAVY = '#f07f2a', '#f2b134', '#e8b23a', '#3a9a4a', '#2f6fbf', '#22345f'
WHITE, CREAM, GLASS, LAMP, PINK = '#ffffff', '#f4e6c8', '#9fd3f5', '#ffd27a', '#ef7aa0'
STONE, STONE2, SLATE = '#a39a8c', '#867d70', '#4f5866'


class Model:
    def __init__(self, name):
        self.name = name
        self.bm = bmesh.new()
        self.col = self.bm.loops.layers.float_color.new('Color')
        self.uv = self.bm.loops.layers.uv.new('UVMap')

    # -- primitives --------------------------------------------------------------------------------------------
    def add(self, kind, color, at=(0, 0, 0), size=(1, 1, 1), rot=(0, 0, 0), seg=12, rings=8, top=1.0, bevel=0.0,
            smooth=None, wig=0.0, code=0.0, sub=2, noise=0.0, wavy=0.0, half=False):
        bm = self.bm
        if not isinstance(size, (tuple, list)): size = (size, size, size)
        m = Matrix.Translation(at) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((size[0], size[1], size[2], 1.0))
        before = set(bm.faces)
        if kind == 'box':
            v = bmesh.ops.create_cube(bm, size=1.0, matrix=m)['verts']
            if bevel > 0:
                edges = list({e for x in v for e in x.link_edges})
                bmesh.ops.bevel(bm, geom=edges + v, offset=bevel, segments=2, profile=0.5, affect='EDGES', clamp_overlap=True)
            sm = False if smooth is None else smooth
        elif kind == 'cyl':
            v = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg, radius1=0.5, radius2=0.5 * top, depth=1.0, matrix=Matrix.Identity(4))['verts']
            if wavy:   # a dripping, scalloped bottom edge (snow on pine boughs)
                lo = [x for x in v if x.co.z < -0.49]
                for x in lo:
                    a = math.atan2(x.co.y, x.co.x)
                    x.co.x *= 1 + wavy * math.cos(a * seg / 2)
                    x.co.y *= 1 + wavy * math.cos(a * seg / 2)
                    x.co.z -= wavy * 0.6 * (0.5 + 0.5 * math.cos(a * seg / 2))
            bmesh.ops.transform(bm, matrix=m, verts=v)
            sm = True if smooth is None else smooth
        elif kind == 'ball':
            v = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=0.5, matrix=Matrix.Identity(4))['verts']
            if half:
                kill = [x for x in v if x.co.z < -1e-4]
                bmesh.ops.delete(bm, geom=kill, context='VERTS')
                v = [x for x in v if x.is_valid]
            bmesh.ops.transform(bm, matrix=m, verts=v)
            sm = True if smooth is None else smooth
        elif kind == 'ico':
            v = bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=0.5, matrix=Matrix.Identity(4))['verts']
            if noise:
                for x in v:
                    x.co *= 1 + random.uniform(-noise, noise)
            if half:
                for x in v:
                    if x.co.z < 0: x.co.z *= 0.15
            bmesh.ops.transform(bm, matrix=m, verts=v)
            sm = True if smooth is None else smooth
        elif kind == 'prism':   # a roof: ridge along y, gables facing +-y, eaves along x; spans -0.5..0.5 then scaled
            pts = [(-0.5, -0.5, 0), (0.5, -0.5, 0), (0, -0.5, 1), (-0.5, 0.5, 0), (0.5, 0.5, 0), (0, 0.5, 1)]
            v = [bm.verts.new(m @ Vector(p)) for p in pts]
            for f in ((0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)):
                bm.faces.new([v[i] for i in f])
            sm = False if smooth is None else smooth
        elif kind == 'torus':   # around z: size = (R, R, r) - major radius in x/y, tube radius as z
            R, r = 0.5, 0.5 * (size[2] / size[0]) if size[0] else 0.1
            m = Matrix.Translation(at) @ Euler(rot, 'XYZ').to_matrix().to_4x4() @ Matrix.Diagonal((size[0], size[1], size[0], 1.0))
            n1, n2 = seg, max(6, rings)
            grid = []
            for i in range(n1):
                a = 2 * PI * i / n1
                row = []
                for j in range(n2):
                    b = 2 * PI * j / n2
                    row.append(bm.verts.new(m @ Vector(((R + r * math.cos(b)) * math.cos(a), (R + r * math.cos(b)) * math.sin(a), r * math.sin(b)))))
                grid.append(row)
            for i in range(n1):
                for j in range(n2):
                    a, b, c, d = grid[i][j], grid[(i + 1) % n1][j], grid[(i + 1) % n1][(j + 1) % n2], grid[i][(j + 1) % n2]
                    bm.faces.new((a, b, c, d))
            v = [x for row in grid for x in row]
            sm = True if smooth is None else smooth
        else:
            raise ValueError(kind)
        new = [f for f in bm.faces if f not in before]
        bmesh.ops.recalc_face_normals(bm, faces=new)
        if kind == 'cyl' and sm:   # keep the caps flat-shaded so a smooth cylinder's ends aren't smudged
            for f in new:
                f.smooth = len(f.verts) <= 4
        else:
            for f in new: f.smooth = sm
        c = lin(color)
        for f in new:
            for l in f.loops:
                l[self.col] = c
                w = wig(l.vert.co) if callable(wig) else wig
                l[self.uv].uv = (w, 1.0 - code)
        return new

    # friendlier wrappers
    def box(self, color, at, size, **kw): return self.add('box', color, at, size, **kw)
    def ball(self, color, at, r, **kw):
        if not isinstance(r, (tuple, list)): r = (r, r, r)
        big = max(r)
        kw.setdefault('seg', 6 if big < 0.035 else 10 if big < 0.12 else 14)
        kw.setdefault('rings', 5 if big < 0.035 else 7 if big < 0.12 else 9)
        return self.add('ball', color, at, (2 * r[0], 2 * r[1], 2 * r[2]), **kw)
    def lump(self, color, at, r, sub=2, noise=0.08, **kw):
        if not isinstance(r, (tuple, list)): r = (r, r, r)
        return self.add('ico', color, at, (2 * r[0], 2 * r[1], 2 * r[2]), sub=sub, noise=noise, **kw)
    def cyl(self, color, p0, p1, r0, r1=None, **kw):
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        L = d.length
        q = d.normalized().to_track_quat('Z', 'Y').to_matrix() if L > 0 else Matrix.Identity(3)
        spin = kw.pop('rot', None)   # a turn about the cylinder's own axis first (squares a 4-sided cone)
        rot = (q @ Euler(spin).to_matrix()).to_euler() if spin else q.to_euler()
        top = (r0 if r1 is None else r1) / r0 if r0 > 0 else 1.0
        kw.setdefault('seg', 6 if r0 < 0.03 else 12)
        return self.add('cyl', color, tuple((p0 + p1) / 2), (2 * r0, 2 * r0, L), tuple(rot), top=top, **kw)
    def beam(self, color, p0, p1, w, t, **kw):   # a plank from p0 to p1, w wide (across x where it can be)
        p0, p1 = Vector(p0), Vector(p1)
        d = p1 - p0
        rot = d.normalized().to_track_quat('Z', 'Y').to_euler()
        return self.add('box', color, tuple((p0 + p1) / 2), (w, t, d.length), rot=tuple(rot), **kw)
    def cone(self, color, p0, p1, r0, **kw): return self.cyl(color, p0, p1, r0, 0.0, **kw)
    def ring(self, color, at, R, r, rot=(0, 0, 0), **kw):
        kw.setdefault('seg', 16)
        return self.add('torus', color, at, (2 * R, 2 * R, 2 * r), rot, **kw)
    def roof(self, color, at, w, d, h, rot=(0, 0, 0), **kw):
        return self.add('prism', color, at, (w, d, h), rot, **kw)
    def slab(self, at, size, rot=(0, 0, 0)):   # a pillowy cushion of snow
        return self.box(SNOW, at, size, rot=rot, bevel=min(size) * 0.45, smooth=True)

    def mark(self): return set(self.bm.verts)
    def move(self, since, matrix):
        bmesh.ops.transform(self.bm, matrix=matrix, verts=[v for v in self.bm.verts if v not in since])

    def finish(self):
        me = bpy.data.meshes.new(self.name)
        self.bm.to_mesh(me)
        self.bm.free()
        try: me.color_attributes.active_color = me.color_attributes['Color']
        except Exception: pass
        ob = bpy.data.objects.new(self.name, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


def T(x=0, y=0, z=0, yaw=0.0, s=1.0, pitch=0.0, roll=0.0):
    return Matrix.Translation((x, y, z)) @ Euler((pitch, roll, yaw), 'XYZ').to_matrix().to_4x4() @ Matrix.Scale(s, 4)


MODELS = {}
def model(name):
    def deco(fn):
        MODELS[name] = fn
        return fn
    return deco


# ===================================================================================================== people
def person(m, u=1.0, pose='ski', kid=False, skis=True, poles=True, hat='beanie', flail=0.7, coat=False, board=False):
    """A cartoon person, about 1.75*u tall, facing -y. Jacket and arms take the instance tint, hat and skis the second."""
    head = 0.19 if kid else 0.15
    hipz, shz = 0.86 * u, 1.33 * u
    crouch = pose in ('ski', 'tuck')
    if board:
        feet = ((-0.24 * u, 0), (0.24 * u, 0))
    else:
        feet = ((-0.11 * u, 0), (0.11 * u, 0))
    pants = NAVY if not coat else '#3b3f4a'
    for fx, fy in feet:
        m.box(DARK, (fx, fy - 0.04 * u, 0.07 * u), (0.12 * u, 0.27 * u, 0.14 * u), bevel=0.03 * u)
        knee = (fx * 1.05, fy - (0.12 if crouch else 0.01) * u, 0.47 * u)
        m.cyl(pants, (fx, fy, 0.1 * u), knee, 0.075 * u, 0.072 * u, seg=8, wig=grad((fx, fy, 0.1 * u), 1.2 * u, 0.25))
        m.cyl(pants, knee, (fx * 0.8, 0.02 * u, hipz), 0.078 * u, 0.09 * u, seg=8, wig=grad((fx, fy, 0.1 * u), 1.2 * u, 0.25))
    m.ball(pants, (0, 0.03 * u, hipz), (0.19 * u, 0.14 * u, 0.12 * u))
    lean = 0.22 if crouch else 0.0
    m.ball(WHITE, (0, 0.03 * u - lean * 0.3 * u, 1.12 * u), (0.22 * u, 0.17 * u, 0.3 * u), rot=(-lean, 0, 0), code=TINT)
    if coat:
        m.cyl(WHITE, (0, 0.03 * u, hipz + 0.05 * u), (0, 0.03 * u, 0.5 * u), 0.2 * u, 0.25 * u, seg=10, code=TINT)
    m.ring(WHITE, (0, -lean * 0.4 * u, 1.38 * u), 0.11 * u, 0.045 * u, code=TINT2)   # collar / scarf
    if coat:
        m.box(WHITE, (0.08 * u, -0.15 * u, 1.18 * u), (0.07 * u, 0.04 * u, 0.3 * u), rot=(0.1, 0, 0.1), code=TINT2)
    # arms
    for sx in (-1, 1):
        sh = Vector((sx * 0.23 * u, -lean * 0.45 * u, shz))
        if pose == 'ski':
            el, ha = Vector((sx * 0.34 * u, -0.2 * u, 1.12 * u)), Vector((sx * 0.32 * u, -0.38 * u, 1.0 * u))
        elif pose == 'tuck':
            el, ha = Vector((sx * 0.3 * u, -0.3 * u, 1.05 * u)), Vector((sx * 0.14 * u, -0.45 * u, 1.05 * u))
        elif pose == 'out':
            el, ha = Vector((sx * 0.5 * u, -0.02 * u, 1.36 * u)), Vector((sx * 0.76 * u, -0.04 * u, 1.42 * u))
        elif pose == 'up':
            el, ha = Vector((sx * 0.38 * u, -0.05 * u, 1.6 * u)), Vector((sx * 0.45 * u, -0.08 * u, 1.92 * u))
        else:   # down
            el, ha = Vector((sx * 0.3 * u, 0.0, 1.06 * u)), Vector((sx * 0.31 * u, -0.06 * u, 0.82 * u))
        g = grad(sh, 0.62 * u, flail)
        m.cyl(WHITE, sh, el, 0.065 * u, 0.058 * u, seg=8, code=TINT, wig=g)
        m.cyl(WHITE, el, ha, 0.058 * u, 0.052 * u, seg=8, code=TINT, wig=g)
        m.ball(WHITE, ha, 0.062 * u, seg=8, rings=6, code=TINT2, wig=g)
        if poles and skis:
            m.cyl(STEEL, ha + Vector((0, 0, 0.05 * u)), Vector((sx * 0.42 * u, 0.32 * u, 0.0)), 0.013 * u, seg=6, wig=g)
            m.ring(DARK, (sx * 0.415 * u, 0.3 * u, 0.1 * u), 0.05 * u, 0.008 * u, seg=8, rings=4)
    # head
    hz = 1.6 * u + (0.06 * u if kid else 0)
    hy = -lean * 0.5 * u
    hw = grad((0, hy, hz - 0.2 * u), 0.5 * u, 0.25)
    m.ball(SKIN, (0, hy, hz), head * u, wig=hw)
    m.ball(BLUSH, (0, hy - head * 0.98 * u, hz - 0.01 * u), 0.034 * u, seg=8, rings=6, wig=hw)
    for sx in (-1, 1):
        m.ball(COAL, (sx * head * 0.36 * u, hy - head * 0.86 * u, hz + head * 0.22 * u), 0.021 * u, seg=6, rings=5, wig=hw)
        m.ball('#f7a3a3', (sx * head * 0.55 * u, hy - head * 0.72 * u, hz - head * 0.18 * u), 0.03 * u, seg=6, rings=5, wig=hw)
    if hat == 'beanie':
        m.ball(WHITE, (0, hy + 0.01 * u, hz + head * 0.35 * u), (head * 1.04 * u, head * 1.04 * u, head * 0.95 * u), half=True, code=TINT2, wig=hw)
        m.ring(WHITE, (0, hy + 0.01 * u, hz + head * 0.38 * u), head * 0.98 * u, 0.03 * u, code=TINT2, wig=hw)
        m.ball(WHITE, (0, hy + 0.01 * u, hz + head * 1.38 * u), 0.055 * u, seg=8, rings=6, wig=grad((0, hy, hz), 0.35 * u, 0.6))
    elif hat == 'helmet':
        m.ball(WHITE, (0, hy + 0.01 * u, hz + head * 0.2 * u), (head * 1.12 * u, head * 1.14 * u, head * 1.05 * u), half=True, code=TINT2, wig=hw)
    elif hat == 'bobble':
        m.cone(WHITE, (0, hy, hz + head * 0.4 * u), (0.0, hy + 0.12 * u, hz + head * 2.2 * u), head * 1.0 * u, code=TINT2, wig=grad((0, hy, hz), 0.5 * u, 0.7))
        m.ball(WHITE, (0.0, hy + 0.12 * u, hz + head * 2.25 * u), 0.05 * u, seg=8, rings=6, wig=grad((0, hy, hz), 0.5 * u, 0.7))
    if hat in ('beanie', 'helmet') and skis:
        m.box('#f6a33c', (0, hy - head * 0.88 * u, hz + head * 0.5 * u), (head * 1.25 * u, 0.05 * u, head * 0.48 * u), bevel=0.015 * u, wig=hw)
        m.ring(DARK, (0, hy, hz + head * 0.5 * u), head * 1.0 * u, 0.012 * u, seg=14, rings=4, wig=hw)
    # skis
    if skis and not board:
        for sx in (-1, 1):
            yaw = (-sx * 0.22) if kid else 0.0   # a kid's pizza wedge
            mk = m.mark()
            m.box(WHITE, (0, -0.05 * u, 0.018 * u), (0.085 * u, 1.65 * u, 0.026 * u), bevel=0.01 * u, code=TINT2)
            m.box(WHITE, (0, -0.92 * u, 0.06 * u), (0.085 * u, 0.16 * u, 0.026 * u), rot=(-0.6, 0, 0), bevel=0.01 * u, code=TINT2)
            m.move(mk, T(sx * 0.11 * u, 0, 0, yaw))
    if board:
        m.box(WHITE, (0, 0, 0.02 * u), (1.5 * u, 0.3 * u, 0.03 * u), bevel=0.12 * u, code=TINT2)
        m.box(RED, (0, 0, 0.037 * u), (0.9 * u, 0.06 * u, 0.006 * u))
        for fx, _ in feet:
            m.box(COAL, (fx, 0, 0.06 * u), (0.16 * u, 0.24 * u, 0.06 * u), bevel=0.02 * u)


@model('skier')
def _(m): person(m, 1.0, 'ski', hat='beanie')

@model('racer')
def _(m): person(m, 1.0, 'tuck', hat='helmet', flail=0.8)

@model('kid')
def _(m): person(m, 0.62, 'out', kid=True, poles=False, hat='bobble', flail=0.9)

@model('boarder')
def _(m):
    mk = m.mark()
    person(m, 1.0, 'out', board=True, poles=False, hat='beanie')
    m.move(mk, T(yaw=PI / 2))

@model('walker')
def _(m): person(m, 1.0, 'down', skis=False, poles=False, hat='bobble', coat=True, flail=0.6)

@model('skater')
def _(m):
    person(m, 0.95, 'out', skis=False, poles=False, hat='beanie', flail=0.8)
    for sx in (-1, 1):
        m.box(STEEL, (sx * 0.105, -0.04, -0.03), (0.02, 0.3, 0.05))

@model('climber')
def _(m):
    person(m, 1.0, 'down', skis=False, poles=False, hat='helmet', flail=0.5)
    m.box(WHITE, (0, 0.27, 1.12), (0.42, 0.28, 0.6), bevel=0.08, code=TINT2, smooth=True)
    m.cyl(RED, (-0.24, 0.3, 1.5), (0.24, 0.3, 1.5), 0.09, seg=10)
    m.ring(ORANGE, (0.18, 0.05, 1.05), 0.14, 0.035, rot=(0, 0.4, 0), seg=12)
    m.cyl(STEEL, (0.32, -0.08, 0.82), (0.32, -0.12, 1.3), 0.02, seg=6)
    m.box(DARK, (0.32, -0.16, 1.3), (0.03, 0.22, 0.05))

@model('hottub')
def _(m):
    m.cyl(WOOD, (0, 0, 0), (0, 0, 0.95), 1.25, seg=20)
    for z in (0.2, 0.75):
        m.ring(DARK, (0, 0, z), 1.27, 0.04, seg=20)
    m.cyl('#58c7d8', (0, 0, 0.88), (0, 0, 0.92), 1.15, seg=20, code=glow(0.5))   # warm, faintly glowing water
    for i, a in enumerate((0.3, 2.4, 4.3)):
        mk = m.mark()
        m.ball(SKIN, (0, 0, 0.95), (0.28, 0.2, 0.18))
        m.ball(SKIN, (0, 0, 1.3), 0.16, wig=0.15)
        m.ball(WHITE, (0, 0.01, 1.36), (0.165, 0.165, 0.15), half=True, code=TINT2 if i != 1 else TINT, wig=0.15)
        m.ball(WHITE, (0, 0.01, 1.53), 0.05, seg=8, rings=6, wig=0.3)
        for sx in (-1, 1):
            m.ball(COAL, (sx * 0.055, -0.14, 1.34), 0.02, seg=6, rings=5)
        if i == 0:
            m.cyl(SKIN, (0.22, -0.05, 1.05), (0.33, -0.1, 1.5), 0.05, seg=8, wig=grad((0.22, 0, 1.05), 0.5, 0.6))
            m.cyl(RED, (0.33, -0.14, 1.52), (0.33, -0.14, 1.64), 0.05, seg=10)
        m.move(mk, T(math.cos(a) * 0.72, math.sin(a) * 0.72, 0, a + PI / 2 + PI))


# ===================================================================================================== small stuff
@model('pinecone')
def _(m):
    mk = m.mark()
    for i, (z, r) in enumerate([(0.0, 0.016), (0.014, 0.026), (0.03, 0.03), (0.046, 0.028), (0.062, 0.022), (0.076, 0.014)]):
        m.cyl('#8a5530' if i % 2 else '#a96a3c', (0, 0, z), (0, 0, z + 0.02), r, r * 0.55, seg=9, smooth=False)
    m.cyl('#5a3a22', (0, 0, -0.012), (0, 0, 0.002), 0.006, seg=5)
    m.move(mk, T(0, 0, 0.03, pitch=PI / 2))

@model('mitten')
def _(m):
    m.box(WHITE, (0, 0, 0.022), (0.1, 0.13, 0.04), bevel=0.018, code=TINT, smooth=True)
    m.box(WHITE, (0.06, -0.025, 0.022), (0.04, 0.06, 0.035), rot=(0, 0, -0.55), bevel=0.014, code=TINT, smooth=True)
    m.box(CREAM, (0, 0.078, 0.022), (0.11, 0.035, 0.048), bevel=0.012, smooth=True)
    for x in (-0.025, 0.0, 0.025):
        m.box(WHITE, (x, -0.01, 0.043), (0.012, 0.09, 0.004), code=TINT2)

@model('cocoa')
def _(m):
    m.cyl(RED, (0, 0, 0), (0, 0, 0.1), 0.045, seg=14)
    m.cyl(WHITE, (0, 0, 0.04), (0, 0, 0.058), 0.0455, seg=14)
    m.ring(RED, (0.05, 0, 0.05), 0.024, 0.008, rot=(PI / 2, 0, 0), seg=10)
    m.cyl('#6b3b22', (0, 0, 0.088), (0, 0, 0.096), 0.04, seg=14)
    for p in ((0.01, 0.0), (-0.015, 0.012), (0.0, -0.016)):
        m.box(WHITE, (p[0], p[1], 0.1), (0.018, 0.018, 0.016), bevel=0.004)

@model('beanie')
def _(m):
    m.ball(WHITE, (0, 0, 0.0), (0.1, 0.1, 0.12), half=True, code=TINT)
    for z in (0.03, 0.06):
        m.ring(WHITE, (0, 0, z), 0.096 - z * 0.25, 0.008, seg=16, rings=5, code=TINT2)
    m.ring(WHITE, (0, 0, 0.012), 0.1, 0.018, seg=16, rings=6, code=TINT2)
    m.ball(WHITE, (0, 0, 0.13), 0.04, seg=9, rings=7, wig=0.4)

@model('robin')
def _(m):
    m.ball('#7a6a5a', (0, 0.01, 0.06), (0.04, 0.055, 0.04))
    m.ball(ORANGE, (0, -0.025, 0.055), 0.032)
    m.ball('#6a5a4a', (0, -0.04, 0.1), 0.028)
    m.cone(YELLOW, (0, -0.063, 0.1), (0, -0.085, 0.097), 0.008, seg=6)
    for sx in (-1, 1):
        m.ball(COAL, (sx * 0.016, -0.06, 0.108), 0.005, seg=6, rings=4)
        m.cyl('#d08a40', (sx * 0.012, 0.0, 0.03), (sx * 0.012, 0.0, 0.0), 0.003, seg=4)
    m.box('#5a4a3a', (0, 0.07, 0.07), (0.04, 0.05, 0.008), rot=(-0.4, 0, 0), wig=0.6)

@model('carrot')
def _(m):
    m.cone(ORANGE, (0, 0.06, 0.022), (0, -0.12, 0.016), 0.022, seg=8, smooth=False)
    for a in (-0.4, 0, 0.4):
        m.cone(GREEN, (0, 0.06, 0.022), (math.sin(a) * 0.05, 0.11, 0.03 + math.cos(a) * 0.02), 0.008, seg=5, wig=0.5)

@model('goggles')
def _(m):
    m.ring(DARK, (0, 0.03, 0.03), 0.075, 0.009, rot=(0, 0, 0), seg=14, rings=4)
    m.box('#f6a33c', (0, -0.04, 0.03), (0.16, 0.025, 0.06), bevel=0.02, smooth=True)
    m.box(WHITE, (0, -0.032, 0.03), (0.17, 0.02, 0.07), bevel=0.02, smooth=True, code=TINT)

@model('candycane')
def _(m):
    for i in range(7):
        m.cyl(RED if i % 2 else WHITE, (0, 0, i * 0.045), (0, 0, (i + 1) * 0.045), 0.018, seg=8)
    pts = [(0, 0, 0.315)] + [(0.045 - 0.045 * math.cos(a), 0, 0.315 + 0.045 * math.sin(a)) for a in (0.6, 1.2, 1.8, 2.4, 3.1)]
    for i in range(len(pts) - 1):
        m.cyl(WHITE if i % 2 else RED, pts[i], pts[i + 1], 0.018, seg=8)

@model('thermos')
def _(m):
    m.cyl(WHITE, (0, 0, 0), (0, 0, 0.22), 0.045, seg=12, code=TINT)
    m.cyl(STEEL, (0, 0, 0.22), (0, 0, 0.28), 0.048, seg=12)
    m.cyl(WHITE, (0, 0, 0.08), (0, 0, 0.1), 0.046, seg=12, code=TINT2)

@model('boot')
def _(m):
    m.box(WHITE, (0, 0.02, 0.13), (0.12, 0.17, 0.22), bevel=0.04, code=TINT, smooth=True)
    m.box(WHITE, (0, -0.07, 0.06), (0.12, 0.2, 0.1), bevel=0.04, code=TINT, smooth=True)
    m.box(COAL, (0, -0.04, 0.012), (0.13, 0.3, 0.025), bevel=0.008)
    for z in (0.09, 0.15, 0.21):
        m.box(STEEL, (0.065, -0.02, z), (0.015, 0.06, 0.02))

@model('gift')
def _(m):
    m.box(WHITE, (0, 0, 0.11), (0.24, 0.24, 0.22), bevel=0.01, code=TINT)
    m.box(WHITE, (0, 0, 0.11), (0.05, 0.245, 0.225), code=TINT2)
    m.box(WHITE, (0, 0, 0.11), (0.245, 0.05, 0.225), code=TINT2)
    for sx in (-1, 1):
        m.ball(WHITE, (sx * 0.04, 0, 0.24), (0.045, 0.02, 0.035), rot=(0, sx * 0.4, 0), code=TINT2, wig=0.3)

@model('lantern')
def _(m):
    m.box(DARK, (0, 0, 0.015), (0.16, 0.16, 0.03))
    m.box(LAMP, (0, 0, 0.13), (0.12, 0.12, 0.2), code=GLOW)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(DARK, (sx * 0.07, sy * 0.07, 0.02), (sx * 0.07, sy * 0.07, 0.24), 0.008, seg=4)
    m.cone(DARK, (0, 0, 0.24), (0, 0, 0.31), 0.11, seg=4, rot=(0, 0, PI / 4))
    m.ring(DARK, (0, 0, 0.34), 0.03, 0.006, rot=(PI / 2, 0, 0), seg=10, rings=4)

@model('fish')
def _(m):
    mk = m.mark()
    m.ball('#8fb4c9', (0, 0, 0.0), (0.035, 0.13, 0.055))
    m.ball('#d8e6ee', (0, -0.01, -0.02), (0.03, 0.1, 0.03))
    m.cone('#6f94aa', (0, 0.1, 0), (0, 0.2, 0), 0.05, seg=4, rot=(0, 0, 0), wig=grad((0, 0.08, 0), 0.12, 1.0))
    m.box('#6f94aa', (0, 0.02, 0.055), (0.01, 0.07, 0.03), wig=0.2)
    for sx in (-1, 1):
        m.ball(COAL, (sx * 0.026, -0.09, 0.015), 0.009, seg=6, rings=4)
    m.move(mk, T(0, 0, 0.035, roll=PI / 2))

@model('squirrel')
def _(m):
    C, C2 = '#b0602e', '#e7c9a4'
    m.ball(C, (0, 0, 0.085), (0.05, 0.06, 0.08))
    m.ball(C2, (0, -0.035, 0.08), (0.035, 0.03, 0.055))
    m.ball(C, (0, -0.025, 0.18), 0.045)
    for sx in (-1, 1):
        m.cone(C, (sx * 0.025, -0.02, 0.215), (sx * 0.03, -0.015, 0.25), 0.012, seg=5)
        m.ball(COAL, (sx * 0.018, -0.063, 0.19), 0.008, seg=6, rings=4)
    m.ball('#3a2a1e', (0, -0.07, 0.175), 0.008, seg=6, rings=4)
    m.ball('#8a5a2a', (0, -0.07, 0.12), 0.02, seg=7, rings=5)   # an acorn, held tight
    g = grad((0, 0.05, 0.05), 0.25, 0.9)
    for p, r in (((0, 0.07, 0.07), 0.045), ((0, 0.11, 0.14), 0.05), ((0, 0.1, 0.21), 0.047), ((0, 0.06, 0.26), 0.038)):
        m.ball(C, p, r, wig=g)

@model('rabbit')
def _(m):
    C = '#ecebf2'
    m.ball(C, (0, 0.03, 0.11), (0.085, 0.12, 0.1))
    m.ball(C, (0, -0.08, 0.2), 0.07)
    for sx in (-1, 1):
        g = grad((sx * 0.025, -0.07, 0.24), 0.16, 0.8)
        m.cyl(C, (sx * 0.025, -0.07, 0.24), (sx * 0.045, -0.04, 0.39), 0.022, 0.014, seg=7, wig=g)
        m.cyl(PINK, (sx * 0.027, -0.083, 0.26), (sx * 0.045, -0.055, 0.37), 0.012, 0.007, seg=5, wig=g)
        m.ball(COAL, (sx * 0.035, -0.135, 0.215), 0.011, seg=6, rings=4)
        m.ball(C, (sx * 0.05, -0.06, 0.03), (0.03, 0.06, 0.025))
    m.ball(PINK, (0, -0.148, 0.195), 0.012, seg=6, rings=4)
    m.ball(WHITE, (0, 0.15, 0.13), 0.035, wig=0.4)

@model('sapling')
def _(m):
    m.cyl(BARK, (0, 0, 0), (0, 0, 0.12), 0.025, seg=6)
    for i, (z, r, h) in enumerate(((0.08, 0.2, 0.25), (0.22, 0.14, 0.22), (0.34, 0.08, 0.18))):
        m.cone(PINE2 if i % 2 else PINE, (0, 0, z), (0, 0, z + h), r, seg=7, smooth=False, wig=grad((0, 0, 0), 0.6, 0.3))
        m.cyl(SNOW, (0, 0, z + h * 0.5), (0, 0, z + h + 0.01), r * 0.56, 0.0, seg=7, smooth=False, wavy=0.12, wig=grad((0, 0, 0), 0.6, 0.3))

@model('gnome')
def _(m):
    m.cyl(BLUE, (0, 0, 0), (0, 0, 0.2), 0.12, 0.09, seg=12)
    m.ball(BLUE, (0, 0, 0.2), (0.1, 0.1, 0.06))
    m.cone(WHITE, (0, -0.06, 0.27), (0, -0.09, 0.08), 0.085, seg=10)
    m.ball(SKIN, (0, -0.015, 0.29), 0.075)
    m.ball('#f39a7a', (0, -0.095, 0.285), 0.03)
    m.cone(RED, (0, 0, 0.32), (0, 0.06, 0.55), 0.085, seg=10, wig=grad((0, 0, 0.32), 0.25, 0.4))
    m.ball('#8a5a2a', (0.1, -0.03, 0.12), 0.035)

@model('cone')
def _(m):
    m.box(ORANGE, (0, 0, 0.02), (0.38, 0.38, 0.04), bevel=0.02)
    m.cyl(ORANGE, (0, 0, 0.04), (0, 0, 0.55), 0.16, 0.03, seg=12)
    m.cyl(WHITE, (0, 0, 0.26), (0, 0, 0.36), 0.105, 0.085, seg=12)

@model('marker')
def _(m):
    for i in range(5):
        m.cyl(WHITE if i % 2 else DARK, (0, 0, i * 0.34 - 0.1), (0, 0, (i + 1) * 0.34 - 0.1), 0.025, seg=6, code=TINT if i % 2 else 0, wig=grad((0, 0, 0), 1.6, 0.2))
    m.box(WHITE, (0, 0, 1.45), (0.03, 0.22, 0.12), code=TINT, wig=0.25)

@model('skis')
def _(m):
    for sx, a in ((-1, 0.17), (1, -0.17)):
        mk = m.mark()
        m.box(WHITE, (0, 0, 0.7), (0.09, 0.03, 1.6), bevel=0.012, code=TINT)
        m.box(WHITE, (0, 0.04, 1.55), (0.09, 0.03, 0.14), rot=(0.55, 0, 0), bevel=0.012, code=TINT)
        m.box(DARK, (0, -0.02, 0.6), (0.1, 0.05, 0.16), bevel=0.01)
        m.move(mk, T(sx * 0.08, 0, -0.1, roll=a))
    for sx in (-1, 1):
        m.cyl(STEEL, (sx * 0.45, 0.1, -0.1), (sx * 0.33, 0.05, 1.25), 0.012, seg=6)
        m.ring(DARK, (sx * 0.44, 0.1, 0.05), 0.05, 0.008, seg=8, rings=4)
        m.ring(DARK, (sx * 0.33, 0.05, 1.26), 0.02, 0.01, seg=8, rings=4)

@model('snowboard')
def _(m):
    mk = m.mark()
    m.box(WHITE, (0, 0, 0.7), (0.3, 0.03, 1.55), bevel=0.13, code=TINT)
    m.box(WHITE, (0, -0.018, 0.7), (0.12, 0.01, 1.2), code=TINT2)
    for z in (0.45, 0.95):
        m.box(COAL, (0, 0.04, z), (0.24, 0.06, 0.15), bevel=0.02)
    m.move(mk, T(0, 0, -0.12, pitch=0.18))

@model('sled')
def _(m):
    for x in (-0.16, 0, 0.16):
        m.box(WOODL, (x, 0.1, 0.12), (0.12, 0.85, 0.025), bevel=0.008)
    for y in (-0.15, 0.25, 0.5):
        m.box(WOOD, (0, y, 0.1), (0.5, 0.06, 0.03))
    prev = (0, -0.32, 0.12)
    for i in range(1, 6):
        a = i / 5 * PI * 0.85
        p = (0, -0.32 - math.sin(a) * 0.14, 0.12 + (1 - math.cos(a)) * 0.14)
        m.box(WOODL, ((prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2, (prev[2] + p[2]) / 2), (0.46, 0.07, 0.025), rot=(a, 0, 0))
        prev = p
    for sx in (-1, 1):
        m.box(RED, (sx * 0.22, 0.1, 0.05), (0.03, 0.85, 0.1), bevel=0.012)
    m.ring(RED, (0, -0.42, 0.22), 0.1, 0.01, rot=(0.3, 0, 0), seg=10, rings=4)

@model('snowman_s')
def _(m):
    m.lump(SNOW, (0, 0, 0.26), 0.3, sub=3, noise=0.03)
    m.lump(SNOW, (0, 0, 0.66), 0.22, sub=3, noise=0.03)
    m.lump(SNOW, (0, 0, 0.98), 0.16, sub=3, noise=0.03)
    m.cone(ORANGE, (0, -0.14, 0.98), (0, -0.33, 0.95), 0.03, seg=8)
    for sx in (-1, 1):
        m.ball(COAL, (sx * 0.055, -0.14, 1.03), 0.02, seg=6, rings=5)
        g = grad((sx * 0.17, 0, 0.72), 0.4, 0.8)
        m.cyl(BARK, (sx * 0.17, 0, 0.72), (sx * 0.47, -0.02, 0.92), 0.016, seg=5, wig=g)
        m.cyl(BARK, (sx * 0.38, -0.01, 0.86), (sx * 0.44, -0.02, 1.0), 0.01, seg=4, wig=g)
    for a in (-0.5, -0.25, 0, 0.25, 0.5):
        m.ball(COAL, (math.sin(a) * 0.12, -0.14, 0.93 - math.cos(a) * 0.035 + 0.03), 0.013, seg=5, rings=4)
    for z in (0.62, 0.72):
        m.ball(COAL, (0, -0.215, z), 0.02, seg=6, rings=4)
    m.ring(WHITE, (0, 0, 0.84), 0.15, 0.04, code=TINT, seg=14)
    m.box(WHITE, (0.09, -0.12, 0.74), (0.06, 0.03, 0.2), rot=(0.2, 0, 0.3), code=TINT, wig=0.4)
    m.ball(WHITE, (0, 0, 1.05), (0.15, 0.15, 0.14), half=True, code=TINT2)
    m.ball(WHITE, (0, 0, 1.22), 0.04, seg=8, rings=6, code=TINT, wig=0.4)

@model('snowman')
def _(m):
    m.lump(SNOW, (0, 0, 0.55), 0.62, sub=3, noise=0.03)
    m.lump(SNOW, (0, 0, 1.38), 0.45, sub=3, noise=0.03)
    m.lump(SNOW, (0, 0, 2.0), 0.33, sub=3, noise=0.03)
    m.cone(ORANGE, (0, -0.3, 2.0), (0, -0.7, 1.95), 0.06, seg=8)
    for sx in (-1, 1):
        m.ball(COAL, (sx * 0.11, -0.28, 2.1), 0.04, seg=6, rings=5)
        g = grad((sx * 0.38, 0, 1.5), 0.8, 0.8)
        m.cyl(BARK, (sx * 0.38, 0, 1.5), (sx * 0.95, -0.05, 1.95), 0.03, seg=5, wig=g)
        m.cyl(BARK, (sx * 0.78, -0.03, 1.8), (sx * 0.9, -0.05, 2.05), 0.02, seg=4, wig=g)
    for z in (1.25, 1.45, 1.65):
        m.ball(COAL, (0, -0.44 + abs(z - 1.45) * 0.3, z), 0.045, seg=6, rings=4)
    for a in (-0.6, -0.3, 0, 0.3, 0.6):
        m.ball(COAL, (math.sin(a) * 0.22, -0.29, 1.88 - math.cos(a) * 0.05 + 0.05), 0.025, seg=5, rings=4)
    m.ring(WHITE, (0, 0, 1.73), 0.3, 0.08, code=TINT, seg=16)
    m.box(WHITE, (0.2, -0.24, 1.5), (0.13, 0.05, 0.42), rot=(0.25, 0, 0.3), code=TINT, wig=0.4)
    m.cyl(COAL, (0, 0, 2.24), (0, 0, 2.27), 0.36, seg=16)
    m.cyl(COAL, (0, 0, 2.25), (0, 0, 2.62), 0.22, seg=14)
    m.cyl(WHITE, (0, 0, 2.3), (0, 0, 2.36), 0.225, seg=14, code=TINT2)
    m.cyl(WOOD, (0.6, 0.15, 0.0), (0.75, 0.2, 1.9), 0.025, seg=6)
    m.cone('#c9a45a', (0.6, 0.15, 0.35), (0.58, 0.13, -0.05), 0.12, seg=8)

@model('fox')
def _(m):
    O = '#e8772e'
    m.ball(O, (0, 0.05, 0.32), (0.12, 0.26, 0.12))
    m.ball(WHITE, (0, -0.15, 0.3), (0.085, 0.1, 0.1))
    m.ball(O, (0, -0.27, 0.43), 0.1)
    m.cone(O, (0, -0.33, 0.41), (0, -0.48, 0.395), 0.045, seg=8)
    m.cone(WHITE, (0, -0.34, 0.395), (0, -0.47, 0.39), 0.03, seg=8)
    m.ball(COAL, (0, -0.48, 0.395), 0.016, seg=6, rings=4)
    for sx in (-1, 1):
        m.cone(O, (sx * 0.05, -0.25, 0.5), (sx * 0.075, -0.24, 0.62), 0.035, seg=6)
        m.cone(COAL, (sx * 0.068, -0.242, 0.585), (sx * 0.075, -0.24, 0.625), 0.014, seg=5)
        m.ball(COAL, (sx * 0.045, -0.35, 0.46), 0.014, seg=6, rings=4)
        for y in (-0.13, 0.2):
            m.cyl(DARK, (sx * 0.06, y, 0.28), (sx * 0.06, y - 0.02, 0.0), 0.024, seg=6, wig=grad((0, y, 0.3), 0.3, 0.4))
    g = grad((0, 0.28, 0.3), 0.45, 0.9)
    for p, r, c in (((0, 0.34, 0.33), 0.07, O), ((0, 0.46, 0.37), 0.08, O), ((0, 0.57, 0.41), 0.07, O), ((0, 0.66, 0.43), 0.05, WHITE)):
        m.ball(c, p, r, wig=g)

@model('dog')
def _(m):
    B = '#9a5a2e'
    m.ball(WHITE, (0, 0.05, 0.5), (0.2, 0.4, 0.2))
    m.ball(B, (0, 0.12, 0.58), (0.2, 0.3, 0.14))
    for sx in (-1, 1):
        for y in (-0.22, 0.3):
            m.cyl(WHITE, (sx * 0.11, y, 0.45), (sx * 0.11, y, 0.0), 0.06, seg=8, wig=grad((0, y, 0.45), 0.45, 0.4))
    m.ball(B, (0, -0.42, 0.75), 0.17)
    m.ball(WHITE, (0, -0.56, 0.7), (0.1, 0.09, 0.08))
    m.ball(COAL, (0, -0.65, 0.73), 0.03, seg=6, rings=4)
    m.box(PINK, (0, -0.6, 0.62), (0.05, 0.05, 0.08), rot=(0.4, 0, 0), wig=0.4)
    for sx in (-1, 1):
        m.ball('#6b3b1e', (sx * 0.16, -0.38, 0.72), (0.04, 0.07, 0.12), rot=(0, sx * 0.2, 0), wig=0.5)
        m.ball(COAL, (sx * 0.06, -0.55, 0.81), 0.022, seg=6, rings=4)
    m.cyl(WOOD, (-0.1, -0.42, 0.48), (0.1, -0.42, 0.48), 0.07, seg=10)
    m.ring(DARK, (0, -0.42, 0.56), 0.13, 0.015, rot=(0.5, 0, 0), seg=12, rings=4)
    m.cyl(B, (0, 0.42, 0.6), (0, 0.6, 0.75), 0.04, 0.025, seg=6, wig=grad((0, 0.42, 0.6), 0.3, 1.0))

@model('goat')
def _(m):
    C = '#f2efe6'
    m.box(C, (0, 0.05, 0.62), (0.32, 0.7, 0.36), bevel=0.13, smooth=True)
    for sx in (-1, 1):
        for y in (-0.2, 0.3):
            m.cyl(C, (sx * 0.1, y, 0.5), (sx * 0.1, y, 0.06), 0.045, seg=6, wig=grad((0, y, 0.5), 0.5, 0.3))
            m.cyl(COAL, (sx * 0.1, y, 0.06), (sx * 0.1, y, 0.0), 0.045, seg=6)
    m.cyl(C, (0, -0.25, 0.75), (0, -0.38, 1.0), 0.09, seg=8)
    m.box(C, (0, -0.47, 1.0), (0.16, 0.26, 0.15), rot=(0.4, 0, 0), bevel=0.06, smooth=True)
    m.cone(C, (0, -0.55, 0.9), (0, -0.56, 0.72), 0.05, seg=6, wig=0.3)
    for sx in (-1, 1):
        m.cyl(GRAY2, (sx * 0.05, -0.4, 1.08), (sx * 0.07, -0.32, 1.25), 0.025, 0.02, seg=6)
        m.cyl(GRAY2, (sx * 0.07, -0.32, 1.25), (sx * 0.08, -0.2, 1.28), 0.02, 0.008, seg=6)
        m.ball(COAL, (sx * 0.075, -0.52, 1.05), 0.016, seg=6, rings=4)
        m.ball(C, (sx * 0.11, -0.4, 1.06), (0.06, 0.02, 0.025), rot=(0, 0, sx * 0.3), wig=0.3)

@model('crate')
def _(m):
    m.box(WOODL, (0, 0, 0.3), (0.6, 0.6, 0.6), bevel=0.02)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.box(WOOD, (sx * 0.29, sy * 0.29, 0.3), (0.06, 0.06, 0.62))
    for sy in (-1, 1):
        m.box(WOOD, (0, sy * 0.305, 0.3), (0.06, 0.02, 0.78), rot=(0, 0.785, 0))
    m.slab((0, 0, 0.62), (0.56, 0.56, 0.07))

@model('barrel')
def _(m):
    m.cyl(WOOD, (0, 0, 0), (0, 0, 0.42), 0.3, 0.35, seg=14)
    m.cyl(WOOD, (0, 0, 0.42), (0, 0, 0.84), 0.35, 0.3, seg=14)
    for z, r in ((0.08, 0.31), (0.3, 0.345), (0.54, 0.345), (0.76, 0.31)):
        m.ring(DARK, (0, 0, z), r, 0.018, seg=16, rings=4)
    m.slab((0, 0, 0.86), (0.5, 0.5, 0.08))

@model('bench')
def _(m):
    for y in (-0.15, 0.0, 0.15):
        m.box(WOODL, (0, y, 0.45), (1.6, 0.12, 0.04), bevel=0.01)
    for z in (0.7, 0.85):
        m.box(WOODL, (0, 0.25, z), (1.6, 0.04, 0.11), rot=(0.15, 0, 0), bevel=0.01)
    for sx in (-1, 1):
        m.box(DARK, (sx * 0.65, -0.12, 0.22), (0.05, 0.05, 0.45))
        m.box(DARK, (sx * 0.65, 0.2, 0.45), (0.05, 0.05, 0.9), rot=(0.12, 0, 0))
        m.box(DARK, (sx * 0.65, 0.03, 0.44), (0.05, 0.42, 0.04))
    m.slab((0, 0, 0.5), (1.45, 0.36, 0.08))

@model('mailbox')
def _(m):
    m.box(WOOD2, (0, 0, 0.5), (0.1, 0.1, 1.0))
    m.box(WHITE, (0, 0, 1.08), (0.24, 0.45, 0.16), code=TINT)
    m.cyl(WHITE, (0, -0.225, 1.16), (0, 0.225, 1.16), 0.12, seg=12, code=TINT)
    m.box(RED, (0.14, 0.05, 1.22), (0.015, 0.05, 0.18), wig=0.2)
    m.box(RED, (0.14, 0.02, 1.3), (0.015, 0.1, 0.06), wig=0.2)
    m.slab((0, 0, 1.3), (0.22, 0.44, 0.08))

@model('signpost')
def _(m):
    m.cyl(WOOD2, (0, 0, -0.1), (0, 0, 2.1), 0.06, seg=8)
    for z, a, c in ((1.85, 0.2, YELLOW), (1.55, PI - 0.3, '#3a7ad0'), (1.25, 0.6, RED)):
        mk = m.mark()
        m.box(c, (0.42, 0, 0), (0.62, 0.05, 0.2))
        m.add('prism', c, (0.73, 0, -0.1), (0.2, 0.05, 0.2), rot=(0, 0, 0))
        m.move(mk, T(0, 0, z, a))
        mk = m.mark()
        m.box(DARK, (0.38, -0.028, 0), (0.4, 0.004, 0.04))
        m.move(mk, T(0, 0, z, a))
    m.slab((0, 0, 2.12), (0.18, 0.18, 0.08))

@model('deckchair')
def _(m):
    for sx in (-1, 1):
        x = sx * 0.28
        m.beam(WOODL, (x, 0.42, 0), (x, 0.2, 0.98), 0.045, 0.045)
        m.beam(WOODL, (x, -0.42, 0), (x, 0.14, 0.52), 0.045, 0.045)
        m.beam(WOODL, (x, -0.4, 0.5), (x, 0.24, 0.56), 0.05, 0.03)
    m.beam(WOODL, (-0.3, 0.38, 0.12), (0.3, 0.38, 0.12), 0.04, 0.04)
    m.beam(WOODL, (-0.3, -0.36, 0.08), (0.3, -0.36, 0.08), 0.04, 0.04)
    m.beam(WHITE, (0, 0.22, 0.95), (0, -0.32, 0.3), 0.5, 0.02, code=TINT)
    for x in (-0.13, 0.13):
        m.beam(WHITE, (x, 0.22, 0.95), (0, -0.32, 0.3), 0.08, 0.03, code=TINT2) if False else m.beam(WHITE, (x, 0.22, 0.95), (x, -0.32, 0.3), 0.08, 0.03, code=TINT2)

@model('trashcan')
def _(m):
    m.cyl('#3b6b4f', (0, 0, 0), (0, 0, 0.85), 0.27, 0.3, seg=14)
    for z in (0.2, 0.6):
        m.ring('#2c533c', (0, 0, z), 0.29, 0.02, seg=16, rings=4)
    m.cyl('#2c533c', (0, 0, 0.85), (0, 0, 0.92), 0.32, 0.28, seg=14)
    m.slab((0, 0, 0.95), (0.45, 0.45, 0.08))

@model('pistepole')
def _(m):
    m.cyl(WHITE, (0, 0, -0.2), (0, 0, 1.4), 0.04, seg=8, code=TINT)
    m.cyl(DARK, (0, 0, 1.15), (0, 0, 1.4), 0.042, seg=8)
    m.box(WHITE, (0, 0, 1.25), (0.02, 0.35, 0.35), code=TINT, rot=(0.785, 0, 0), wig=0.2)

@model('fence')
def _(m):
    for x in (-1.5, 1.5):
        m.cyl(WOOD2, (x, 0, -0.2), (x, 0, 1.25), 0.05, seg=6)
    m.box(ORANGE, (0, 0, 0.6), (3.0, 0.03, 1.0), wig=grad((0, 0, 0), 1.5, 0.15))
    for z in (0.3, 0.6, 0.9):
        m.box('#d76a1e', (0, -0.018, z), (3.0, 0.01, 0.04), wig=grad((0, 0, 0), 1.5, 0.15))
    for x in (-1, -0.5, 0, 0.5, 1):
        m.box('#d76a1e', (x, -0.018, 0.6), (0.04, 0.01, 1.0), wig=grad((0, 0, 0), 1.5, 0.15))
    m.slab((0, 0, 1.12), (3.0, 0.12, 0.06))


# ===================================================================================================== animals
def deer_body(m, rudolph=False):
    C, C2 = '#a0703f', '#e7cfa8'
    m.ball(C, (0, 0.0, 0.88), (0.2, 0.48, 0.22))
    m.ball(C2, (0, 0.05, 0.78), (0.17, 0.38, 0.12))
    for sx in (-1, 1):
        for y in (-0.32, 0.32):
            g = grad((0, y, 0.8), 0.8, 0.35)
            m.cyl(C, (sx * 0.1, y, 0.82), (sx * 0.1, y + 0.03, 0.4), 0.05, 0.035, seg=6, wig=g)
            m.cyl(C, (sx * 0.1, y + 0.03, 0.4), (sx * 0.1, y, 0.03), 0.032, 0.03, seg=6, wig=g)
            m.cyl(COAL, (sx * 0.1, y, 0.04), (sx * 0.1, y, 0.0), 0.034, seg=6)
    m.cyl(C, (0, -0.35, 0.95), (0, -0.5, 1.32), 0.1, 0.075, seg=8)
    m.ball(C, (0, -0.6, 1.36), (0.095, 0.17, 0.1), rot=(0.35, 0, 0))
    m.ball(DRED if rudolph else COAL, (0, -0.76, 1.3), 0.035 if not rudolph else 0.055, seg=8, rings=6, code=GLOW if rudolph else 0)
    m.ball(WHITE, (0, 0.47, 0.98), (0.06, 0.05, 0.08), wig=0.4)
    for sx in (-1, 1):
        m.ball(COAL, (sx * 0.065, -0.66, 1.42), 0.018, seg=6, rings=4)
        m.ball(C, (sx * 0.11, -0.52, 1.47), (0.03, 0.05, 0.09), rot=(0, sx * 0.9, 0), wig=0.3)
        # antlers
        base = Vector((sx * 0.05, -0.55, 1.46))
        tip = base + Vector((sx * 0.12, 0.05, 0.3))
        m.cyl(CREAM, base, tip, 0.022, 0.016, seg=5)
        m.cyl(CREAM, tip, tip + Vector((sx * 0.1, 0.08, 0.15)), 0.016, 0.01, seg=5)
        m.cyl(CREAM, tip, tip + Vector((0.0, -0.08, 0.18)), 0.014, 0.008, seg=5)
        mid = base + Vector((sx * 0.06, 0.02, 0.15))
        m.cyl(CREAM, mid, mid + Vector((sx * 0.02, -0.1, 0.1)), 0.013, 0.007, seg=5)

@model('deer')
def _(m): deer_body(m)

@model('reindeer')
def _(m):
    deer_body(m, rudolph=True)
    m.ring(DRED, (0, -0.4, 1.08), 0.11, 0.03, rot=(0.6, 0, 0), seg=12, rings=5)
    for sx in (-1, 1):
        m.ball(GOLD, (sx * 0.08, -0.47, 1.0), 0.03, seg=8, rings=6)

@model('moose')
def _(m):
    C, L = '#4a3020', '#8a7a68'
    m.ball(C, (0, 0.05, 1.5), (0.42, 0.85, 0.5))
    m.ball(C, (0, -0.45, 1.85), (0.38, 0.4, 0.38))
    for sx in (-1, 1):
        for y in (-0.5, 0.55):
            g = grad((0, y, 1.3), 1.3, 0.3)
            m.cyl(C, (sx * 0.22, y, 1.3), (sx * 0.2, y, 0.7), 0.11, 0.07, seg=7, wig=g)
            m.cyl(L, (sx * 0.2, y, 0.7), (sx * 0.2, y, 0.03), 0.06, 0.05, seg=7, wig=g)
            m.cyl(COAL, (sx * 0.2, y, 0.05), (sx * 0.2, y, 0.0), 0.06, seg=7)
    m.cyl(C, (0, -0.65, 1.8), (0, -0.85, 1.9), 0.22, seg=8)
    m.ball(C, (0, -1.1, 1.78), (0.18, 0.42, 0.2), rot=(0.45, 0, 0))
    m.ball('#5a3a28', (0, -1.42, 1.62), (0.17, 0.15, 0.15))
    for sx in (-1, 1):
        m.ball(COAL, (sx * 0.07, -1.55, 1.62), 0.03, seg=6, rings=4)
    m.cone(C, (0, -1.05, 1.62), (0, -1.08, 1.25), 0.07, seg=6, wig=0.5)
    for sx in (-1, 1):   # big, startled googly eyes
        m.ball(WHITE, (sx * 0.13, -1.12, 1.98), 0.085)
        m.ball(COAL, (sx * 0.15, -1.2, 1.99), 0.04, seg=8, rings=6, wig=0.15)
        m.ball(C, (sx * 0.2, -0.9, 2.02), (0.05, 0.08, 0.14), rot=(0, sx * 1.0, 0), wig=0.3)
        mk = m.mark()
        m.cyl('#d8c39a', (0, 0, 0), (0.25, 0, 0.12), 0.05, seg=6)
        m.ball('#d8c39a', (0.48, 0.0, 0.25), (0.32, 0.22, 0.05), rot=(0, -0.35, 0))
        for i in range(5):
            a = -0.6 + i * 0.4
            p = Vector((0.48 + math.cos(a + 0.6) * 0.3, math.sin(a + 0.6) * 0.18, 0.25 + math.cos(a) * 0.1 + 0.08))
            m.cone('#d8c39a', p, p + Vector((0.08, 0.0, 0.14)), 0.035, seg=5)
        m.move(mk, T(sx * 0.12, -0.92, 2.1, yaw=0 if sx > 0 else PI) if sx > 0 else T(sx * 0.12, -0.92, 2.1) @ Matrix.Diagonal((-1, 1, 1, 1)))
    m.cyl(C, (0, 0.85, 1.6), (0, 0.95, 1.45), 0.07, 0.04, seg=6, wig=0.5)

@model('bear')
def _(m):
    C, C2 = '#6b4226', '#a77b52'
    m.ball(C, (0, 0.1, 0.78), (0.5, 0.8, 0.52))
    for sx in (-1, 1):
        for y in (-0.42, 0.55):
            m.cyl(C, (sx * 0.3, y, 0.6), (sx * 0.3, y, 0.05), 0.16, 0.15, seg=8, wig=grad((0, y, 0.6), 0.6, 0.3))
            m.ball(C2, (sx * 0.3, y - 0.1, 0.06), (0.14, 0.12, 0.06))
    m.ball(C, (0, -0.72, 1.0), 0.33)
    m.ball(C2, (0, -1.0, 0.92), (0.15, 0.14, 0.12))
    m.ball(COAL, (0, -1.12, 0.97), 0.05, seg=8, rings=6)
    for sx in (-1, 1):
        m.ball(C, (sx * 0.22, -0.62, 1.28), 0.1)
        m.ball(C2, (sx * 0.22, -0.68, 1.28), 0.05, seg=8, rings=6)
        m.ball(COAL, (sx * 0.12, -0.98, 1.1), 0.035, seg=6, rings=4)
    m.box(PINK, (0, -1.08, 0.83), (0.07, 0.06, 0.1), rot=(0.4, 0, 0), wig=0.4)

@model('yeti')
def _(m):
    F, Fa, Sk = '#eef3ff', '#cfdcf2', '#7fa6d9'
    m.lump(F, (0, 0.05, 1.35), (0.62, 0.5, 0.8), sub=2, noise=0.12, smooth=False)
    m.lump(Fa, (0, -0.15, 1.2), (0.42, 0.35, 0.5), sub=2, noise=0.1, smooth=False)
    m.lump(F, (0, 0.0, 2.2), (0.38, 0.36, 0.36), sub=2, noise=0.12, smooth=False, wig=0.15)
    m.ball(Sk, (0, -0.24, 2.15), (0.24, 0.13, 0.22), wig=0.15)
    for sx in (-1, 1):
        m.ball(WHITE, (sx * 0.09, -0.33, 2.24), 0.065, wig=0.15)
        m.ball(COAL, (sx * 0.09, -0.39, 2.25), 0.03, seg=8, rings=6, wig=0.15)
        m.cone('#c9c2b0', (sx * 0.22, -0.05, 2.45), (sx * 0.35, 0.0, 2.68), 0.06, seg=6, wig=0.15)
        g = grad((sx * 0.55, 0, 1.9), 1.4, 1.0)
        m.lump(F, (sx * 0.72, -0.05, 2.3), (0.2, 0.2, 0.5), rot=(0, sx * 0.35, 0), sub=2, noise=0.1, smooth=False, wig=g)
        m.ball(Sk, (sx * 0.86, -0.08, 2.78), (0.14, 0.12, 0.16), wig=g)
        m.lump(F, (sx * 0.3, 0.0, 0.42), (0.22, 0.22, 0.42), sub=2, noise=0.1, smooth=False, wig=grad((0, 0, 0.8), 0.9, 0.3))
        m.ball(Sk, (sx * 0.3, -0.12, 0.07), (0.2, 0.32, 0.08))
    m.box('#2a3550', (0, -0.36, 2.06), (0.24, 0.05, 0.1), bevel=0.03)
    for sx in (-1, 1):
        m.cone(WHITE, (sx * 0.07, -0.39, 2.1), (sx * 0.07, -0.39, 2.03), 0.025, seg=5)

@model('mammoth')
def _(m):   # in a block of ice: only the front of it got out
    m.box(ICE, (0, 0.6, 1.4), (3.0, 2.6, 2.8), bevel=0.25, code=glow(0.3))
    B = '#6b4430'
    m.lump(B, (0, -0.65, 1.95), (0.72, 0.55, 0.62), sub=2, noise=0.1, smooth=False)
    for sx in (-1, 1):
        m.lump(B, (sx * 0.62, -0.5, 1.95), (0.18, 0.28, 0.4), sub=1, noise=0.1, wig=0.3)
        m.ball(WHITE, (sx * 0.25, -1.08, 2.1), 0.08)
        m.ball(COAL, (sx * 0.25, -1.14, 2.11), 0.04, seg=8, rings=6)
        pts = [Vector((sx * 0.28, -1.0, 1.55)), Vector((sx * 0.45, -1.4, 1.35)), Vector((sx * 0.5, -1.75, 1.55)), Vector((sx * 0.38, -1.85, 1.85))]
        for i in range(3):
            m.cyl(CREAM, pts[i], pts[i + 1], 0.09 - i * 0.025, 0.065 - i * 0.022, seg=8)
    tr = [Vector((0, -1.05, 1.7)), Vector((0, -1.2, 1.25)), Vector((0, -1.25, 0.85)), Vector((0, -1.45, 0.65))]
    for i in range(3):
        m.cyl(B, tr[i], tr[i + 1], 0.16 - i * 0.03, 0.13 - i * 0.03, seg=8, wig=grad(tr[0], 1.0, 0.9))
    m.slab((0, 0.6, 2.85), (2.9, 2.5, 0.2))


# ===================================================================================================== trees & rocks
def pine(m, h=8.0, tiers=5, seg=9, colors=(PINE, PINE2, PINE3), sway=0.12):
    s = h / 8.0
    m.cyl(BARK, (0, 0, -0.2), (0, 0, 1.6 * s), 0.28 * s, 0.22 * s, seg=7)
    g = grad((0, 0, 0), h, sway)
    for i in range(tiers):
        f = i / max(1, tiers - 1)
        z0 = (1.0 + i * (5.6 / tiers) * 1.05) * s
        r = (2.3 - 1.7 * f) * s
        hh = (2.6 - 0.7 * f) * s
        rot = (0, 0, i * 0.7)
        m.add('cyl', colors[i % 3], (0, 0, z0 + hh / 2), (2 * r, 2 * r, hh), rot, seg=seg, top=0.0, smooth=False, wig=g)
        m.add('cyl', SNOW, (0, 0, z0 + hh * 0.72 + 0.03 * s), (2 * r * 0.5, 2 * r * 0.5, hh * 0.56), rot, seg=seg, top=0.0, smooth=False, wavy=0.13, wig=g)

@model('pine')
def _(m): pine(m, 8.0, 5)

@model('pine_s')
def _(m): pine(m, 3.2, 3, seg=8, colors=(PINE2, PINE, PINE3), sway=0.18)

@model('pine_tall')
def _(m): pine(m, 14.0, 7, seg=10, colors=(PINE3, PINE, PINE2), sway=0.08)

@model('xmastree')
def _(m):
    pine(m, 10.0, 6, seg=10, sway=0.05)
    random.seed(3)
    cols = (RED, GOLD, '#4aa3ff', PINK, WHITE)
    for i in range(46):
        t = i / 46
        a = t * 2 * PI * 6.3
        z = 1.5 + t * 7.4
        r = (2.5 - 2.0 * t) * 1.02
        m.ball(cols[i % 5], (math.cos(a) * r, math.sin(a) * r, z - 0.1), 0.13 if i % 3 else 0.2, seg=8, rings=6, code=GLOW if i % 2 else 0)
    mk = m.mark()
    for k in range(5):
        a = k * 2 * PI / 5
        m.cone(GOLD, (0, 0, 0), (0, math.cos(a) * 0.55, math.sin(a) * 0.55), 0.2, seg=4, code=GLOW)
    m.move(mk, T(0, 0, 10.4, pitch=0) @ Euler((0, 0, 0)).to_matrix().to_4x4() @ Matrix.Rotation(PI / 2, 4, 'Y') @ Matrix.Rotation(PI / 2, 4, 'Z'))

@model('birch')
def _(m):
    W = '#efece4'
    m.cyl(W, (0, 0, -0.2), (0, 0, 6.0), 0.17, 0.07, seg=8)
    random.seed(11)
    for i in range(14):
        z = random.uniform(0.3, 5.0)
        a = random.uniform(0, 2 * PI)
        r = 0.17 - z * 0.017
        m.box(COAL, (math.cos(a) * r, math.sin(a) * r, z), (0.08, 0.08, 0.035), rot=(0, 0, a))
    for i, (z, a, L) in enumerate(((2.4, 0.3, 1.5), (3.0, 2.5, 1.7), (3.6, 4.4, 1.4), (4.2, 1.4, 1.3), (4.8, 3.6, 1.0), (5.3, 5.5, 0.8))):
        p0 = Vector((0, 0, z))
        p1 = p0 + Vector((math.cos(a) * L, math.sin(a) * L, L * 0.9))
        m.cyl('#5a4a40', p0, p1, 0.05, 0.015, seg=5, wig=grad((0, 0, 0), 6.5, 0.1))
        p2 = p0 + (p1 - p0) * 0.6
        m.cyl('#5a4a40', p2, p2 + Vector((math.cos(a + 0.8) * 0.5, math.sin(a + 0.8) * 0.5, 0.5)), 0.022, 0.008, seg=4, wig=grad((0, 0, 0), 6.5, 0.1))
        m.lump(SNOW, p0 + (p1 - p0) * 0.45 + Vector((0, 0, 0.06)), (0.18, 0.18, 0.07), sub=1, noise=0.15)
    m.lump(SNOW, (0, 0, 6.02), (0.1, 0.1, 0.08), sub=1)

@model('boulder')
def _(m):
    random.seed(5)
    m.lump('#8f97a1', (0, 0, 0.75), (1.1, 0.95, 0.9), sub=2, noise=0.16, smooth=False)
    m.lump('#7d8590', (0.7, 0.4, 0.4), (0.55, 0.5, 0.45), sub=1, noise=0.15, smooth=False)
    m.lump(SNOW, (0, -0.05, 1.42), (0.85, 0.72, 0.3), sub=2, noise=0.1, half=True)

@model('crystal')
def _(m):
    random.seed(9)
    for i in range(6):
        a = i * 1.1
        lean = 0.15 + 0.35 * (i % 3) / 2
        h = 1.4 + 0.9 * ((i * 7) % 5) / 4
        mk = m.mark()
        m.cyl(ICE, (0, 0, 0), (0, 0, h * 0.8), 0.18, 0.2, seg=6, smooth=False, code=glow(0.6))
        m.cone(ICE, (0, 0, h * 0.8), (0, 0, h), 0.2, seg=6, smooth=False, code=glow(0.6))
        m.move(mk, T(math.cos(a) * 0.25 * (i > 0), math.sin(a) * 0.25 * (i > 0), -0.1, yaw=a, pitch=lean if i else 0))


# ===================================================================================================== little buildings & kit
@model('igloo')
def _(m):
    m.ball(SNOW, (0, 0, 0), 1.6, seg=18, rings=12, half=True)
    for z in (0.35, 0.75, 1.1, 1.38):
        r = math.sqrt(max(0.01, 1.6 ** 2 - z * z))
        m.ring(SNOW2, (0, 0, z), r, 0.03, seg=22, rings=4)
    m.cyl(SNOW, (0, -1.3, 0.0), (0, -2.1, 0.0), 0.75, seg=14)
    m.cyl(SNOW2, (0, -2.08, 0.0), (0, -2.12, 0.0), 0.5, seg=14)
    m.cyl('#2a3550', (0, -2.11, 0.0), (0, -2.13, 0.0), 0.42, seg=14)

@model('tent')
def _(m):
    m.roof(WHITE, (0, 0, 0), 2.3, 2.6, 1.65, code=TINT)
    m.roof(WHITE, (0, -1.31, 0), 0.9, 0.02, 1.1, code=TINT2)
    m.cyl(DARK, (0, -1.35, 0), (0, -1.35, 1.85), 0.03, seg=5)
    m.slab((0, 0.1, 1.6), (0.35, 2.2, 0.12))

@model('campfire')
def _(m):
    random.seed(2)
    for i in range(9):
        a = i / 9 * 2 * PI
        m.lump('#8f97a1', (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.08), 0.12, sub=1, noise=0.2, smooth=False)
    for a in (0.3, 1.9, 3.5, 5.0):
        m.cyl(BARK, (math.cos(a) * 0.35, math.sin(a) * 0.35, 0.05), (math.cos(a) * 0.05, math.sin(a) * 0.05, 0.25), 0.06, seg=6)
    for i, (x, y, h, c) in enumerate(((0, 0, 0.75, ORANGE), (0.1, 0.06, 0.5, YELLOW), (-0.1, -0.04, 0.55, '#ff5a2a'), (0.0, -0.1, 0.4, YELLOW))):
        m.cone(c, (x, y, 0.1), (x, y, 0.1 + h), 0.16 - i * 0.02, seg=7, code=GLOW, wig=grad((x, y, 0.1), h, 1.0))

@model('logpile')
def _(m):
    k = 0
    for row, n in enumerate((4, 3, 2, 1)):
        for i in range(n):
            x = (i - (n - 1) / 2) * 0.46
            z = 0.22 + row * 0.39
            m.cyl(BARK, (x, -1.2, z), (x, 1.2, z), 0.22, seg=9)
            for y in (-1.21, 1.21):
                m.cyl(WOODL, (x, y - 0.01, z), (x, y + 0.01, z), 0.19, seg=9)
            k += 1
    m.slab((0, 0, 1.62), (0.6, 2.2, 0.16))
    m.slab((0, 0, 1.25), (1.4, 2.2, 0.1))

@model('outhouse')
def _(m):
    m.box(WOOD, (0, 0, 1.1), (1.2, 1.2, 2.2), bevel=0.03)
    for x in (-0.3, 0, 0.3):
        m.box(WOOD2, (x, -0.605, 1.1), (0.02, 0.01, 2.2))
    m.box(WOOD2, (0, -0.62, 1.0), (0.85, 0.04, 1.9))
    m.cyl(LAMP, (0.0, -0.645, 1.62), (0.0, -0.655, 1.62), 0.13, seg=14, code=glow(0.6))
    m.cyl(WOOD2, (0.06, -0.66, 1.65), (0.06, -0.67, 1.65), 0.12, seg=14)
    m.box(WOOD2, (0, 0, 2.27), (1.5, 1.5, 0.12), rot=(-0.18, 0, 0))
    m.slab((0, 0.0, 2.38), (1.42, 1.4, 0.18), rot=(-0.18, 0, 0))

@model('phonebox')
def _(m):
    m.box(RED, (0, 0, 1.25), (1.0, 1.0, 2.5), bevel=0.04)
    for sx in (-1, 1):
        m.box(GLASS, (0, -0.505, 0.6 + 0.6 * (sx > 0)), (0.7, 0.02, 0.5), code=glow(0.25))
        m.box(GLASS, (0.505, 0, 0.6 + 0.6 * (sx > 0)), (0.02, 0.7, 0.5), code=glow(0.25))
    m.box(WHITE, (0, -0.51, 2.3), (0.7, 0.03, 0.14), code=glow(0.5))
    m.box(DRED, (0, 0, 2.6), (1.1, 1.1, 0.18), bevel=0.04)
    m.cyl(DRED, (0, -0.5, 2.7), (0, 0.5, 2.7), 0.4, seg=14)
    m.slab((0, 0, 2.95), (0.9, 0.9, 0.14))

@model('icehut')
def _(m):
    m.box(WOOD2, (0, 0, 0.06), (2.1, 2.7, 0.12))
    m.box(WHITE, (0, 0, 1.1), (2.0, 2.6, 2.0), bevel=0.05, code=TINT)
    m.box(WOOD2, (0.4, -1.31, 0.95), (0.7, 0.04, 1.6))
    m.box(LAMP, (-0.5, -1.31, 1.4), (0.45, 0.04, 0.4), code=GLOW)
    m.box(WHITE, (0, 0, 2.2), (2.4, 3.0, 0.15), rot=(0.15, 0, 0), code=TINT2)
    m.slab((0, 0, 2.33), (2.3, 2.9, 0.2), rot=(0.15, 0, 0))
    m.cyl(STEEL, (0.6, 0.6, 2.0), (0.6, 0.6, 3.0), 0.09, seg=8)

@model('stall')
def _(m):
    m.box(WOOD, (0, 0.2, 0.55), (3.0, 1.2, 1.1), bevel=0.04)
    m.box(WOODL, (0, -0.1, 1.12), (3.2, 0.7, 0.08))
    m.box(WOOD2, (0, 0.8, 1.6), (3.0, 0.1, 2.0))
    for sx in (-1, 1):
        m.box(WOOD2, (sx * 1.45, -0.35, 1.6), (0.12, 0.12, 2.0))
    m.roof(WHITE, (0, 0.2, 2.6), 3.6, 2.2, 0.9, rot=(0, 0, PI / 2), code=TINT)
    m.roof(SNOW, (0, 0.2, 2.75), 3.5, 2.0, 0.9, rot=(0, 0, PI / 2))
    for i in range(8):
        m.box(WHITE if i % 2 else RED, (-1.4 + i * 0.4, -0.65, 2.45), (0.4, 0.05, 0.35), code=TINT2 if i % 2 == 0 else 0, rot=(-0.3, 0, 0))
    for i in range(10):
        m.ball((LAMP, RED, '#7fd0ff', '#9ff09a')[i % 4], (-1.5 + i * 0.333, -0.72, 2.25 - 0.08 * math.sin(i / 9 * PI)), 0.06, seg=6, rings=4, code=GLOW)
    random.seed(4)
    for i in range(7):
        c = (RED, GOLD, '#7a4fb0', GREEN, '#e57b3c')[i % 5]
        m.box(c, (-1.3 + i * 0.43, -0.15, 1.25), (0.22, 0.22, 0.18 + 0.1 * (i % 2)), bevel=0.02)

@model('lamppost')
def _(m):
    m.cyl(DARK, (0, 0, 0), (0, 0, 0.3), 0.18, 0.12, seg=10)
    m.cyl(DARK, (0, 0, 0.3), (0, 0, 3.3), 0.07, 0.05, seg=8)
    m.ring(DARK, (0.25, 0, 3.3), 0.25, 0.035, rot=(PI / 2, 0, 0), seg=12, rings=4)
    m.box(LAMP, (0.5, 0, 3.0), (0.26, 0.26, 0.34), code=GLOW)
    m.cone(DARK, (0.5, 0, 3.17), (0.5, 0, 3.4), 0.24, seg=4)
    m.slab((0.5, 0, 3.4), (0.22, 0.22, 0.08))
    m.ring(GREEN, (0, 0, 2.6), 0.16, 0.06, seg=12, rings=5)
    m.ball(RED, (0, -0.18, 2.6), 0.07, seg=8, rings=6)

@model('picnic')
def _(m):
    m.box(WOODL, (0, 0, 0.75), (1.8, 0.8, 0.06))
    for sy in (-1, 1):
        m.box(WOODL, (0, sy * 0.65, 0.45), (1.8, 0.28, 0.05))
        for sx in (-1, 1):
            m.box(WOOD, (sx * 0.7, sy * 0.25, 0.37), (0.06, 0.06, 0.85), rot=(sy * 0.55, 0, 0))
    m.slab((0, 0, 0.8), (1.7, 0.72, 0.08))
    for sy in (-1, 1):
        m.slab((0, sy * 0.65, 0.49), (1.7, 0.24, 0.06))

@model('snowcannon')
def _(m):
    for a in (0, 2.1, 4.2):
        m.cyl(STEEL, (0, 0, 1.4), (math.cos(a) * 0.9, math.sin(a) * 0.9, 0), 0.05, seg=6)
    m.cyl(YELLOW, (0, 0.5, 1.6), (0, -0.7, 2.2), 0.55, 0.5, seg=16)
    m.cyl(DARK, (0, -0.72, 2.21), (0, -0.74, 2.22), 0.45, seg=16)
    m.ring(STEEL, (0, -0.73, 2.21), 0.46, 0.04, rot=(1.1, 0, 0), seg=16, rings=4)
    m.box(GRAY2, (0, 0.65, 1.55), (0.6, 0.4, 0.5), bevel=0.05)

@model('skirack')
def _(m):
    m.box(WOOD, (0, 0, 0.9), (3.0, 0.1, 0.1))
    for sx in (-1, 1):
        m.box(WOOD2, (sx * 1.45, 0, 0.5), (0.1, 0.4, 1.0))
    cols = (RED, '#3a7ad0', YELLOW, GREEN, PINK, ORANGE)
    for i in range(6):
        x = -1.2 + i * 0.48
        for d in (-0.05, 0.05):
            m.box(cols[i], (x + d, -0.12, 0.85), (0.08, 0.03, 1.7), rot=(0.12, 0, d))
    m.slab((0, 0, 0.98), (2.9, 0.16, 0.06))


# ===================================================================================================== vehicles
def wheels(m, xs, ys, r=0.35, w=0.25):
    for x in xs:
        for y in ys:
            m.cyl(COAL, (x - w / 2, y, r), (x + w / 2, y, r), r, seg=12)
            m.cyl(STEEL, (x + (w / 2 + 0.005) * (1 if x > 0 else -1), y, r), (x + (w / 2 + 0.02) * (1 if x > 0 else -1), y, r), r * 0.5, seg=10)

@model('car')
def _(m):
    m.box(WHITE, (0, 0, 0.72), (1.8, 4.1, 0.75), bevel=0.28, code=TINT, smooth=True)
    m.box(WHITE, (0, 0.25, 1.32), (1.6, 2.2, 0.62), bevel=0.25, code=TINT, smooth=True)
    for sx in (-1, 1):
        m.box(GLASS, (sx * 0.79, 0.25, 1.36), (0.04, 1.85, 0.42), bevel=0.02, code=glow(0.15))
        m.box(LAMP, (sx * 0.62, -2.04, 0.82), (0.32, 0.04, 0.18), bevel=0.03, code=GLOW)
        m.box(RED, (sx * 0.62, 2.04, 0.82), (0.3, 0.04, 0.15), bevel=0.03, code=glow(0.6))
    m.box(GLASS, (0, -0.85, 1.32), (1.4, 0.04, 0.45), rot=(-0.5, 0, 0), code=glow(0.15))
    m.box(GLASS, (0, 1.36, 1.32), (1.4, 0.04, 0.42), rot=(0.5, 0, 0), code=glow(0.15))
    m.box(DARK, (0, -2.05, 0.5), (1.7, 0.08, 0.15), bevel=0.04)
    m.box(DARK, (0, 2.05, 0.5), (1.7, 0.08, 0.15), bevel=0.04)
    wheels(m, (-0.82, 0.82), (-1.3, 1.3), 0.36)
    m.slab((0, 0.25, 1.68), (1.45, 1.95, 0.18))
    m.slab((0, -1.45, 1.12), (1.5, 0.9, 0.08), rot=(-0.12, 0, 0))

@model('bus')
def _(m):
    m.box(WHITE, (0, 0, 1.75), (2.5, 11.0, 2.9), bevel=0.35, code=TINT, smooth=True)
    for sx in (-1, 1):
        m.box(GLASS, (sx * 1.255, 0.4, 2.25), (0.04, 9.0, 0.85), code=glow(0.25))
        for y in range(-4, 6):
            m.box(WHITE, (sx * 1.27, y - 0.1, 2.25), (0.03, 0.1, 0.9), code=TINT2)
        m.box(LAMP, (sx * 0.85, -5.51, 1.0), (0.4, 0.04, 0.25), bevel=0.05, code=GLOW)
    m.box(GLASS, (0, -5.505, 2.3), (2.2, 0.04, 1.1), code=glow(0.25))
    m.box(WHITE, (0, 0, 1.05), (2.52, 11.02, 0.25), code=TINT2)
    m.box(COAL, (0, -5.51, 3.0), (1.6, 0.05, 0.3), code=glow(0.4))
    wheels(m, (-1.1, 1.1), (-3.6, 3.4), 0.55, 0.35)
    m.slab((0, 0, 3.25), (2.2, 10.4, 0.25))
    for i, c in enumerate((RED, '#3a7ad0', YELLOW, GREEN)):   # skis on the roof rack
        m.box(c, (-0.7 + i * 0.45, 1.5, 3.45), (0.1, 3.6, 0.05))

@model('snowcat')
def _(m):
    m.box(RED, (0, 0.3, 1.55), (2.6, 3.6, 1.1), bevel=0.2, smooth=True)
    m.box(RED, (0, -0.6, 2.6), (2.3, 1.9, 1.2), bevel=0.2, smooth=True)
    for sx in (-1, 1):
        m.box(GLASS, (sx * 1.16, -0.6, 2.7), (0.04, 1.5, 0.75), code=glow(0.2))
    m.box(GLASS, (0, -1.56, 2.7), (2.0, 0.04, 0.8), code=glow(0.2))
    for sx in (-1, 1):
        m.box(COAL, (sx * 1.6, 0.2, 0.62), (1.0, 5.2, 1.2), bevel=0.45, smooth=True)
        for y in (-1.8, -0.6, 0.6, 1.8):
            m.cyl(STEEL, (sx * 2.11, y, 0.6), (sx * 2.13, y, 0.6), 0.36, seg=12)
    m.box(YELLOW, (0, -3.3, 0.8), (5.0, 0.35, 1.3), rot=(0.25, 0, 0), bevel=0.06)
    for sx in (-1, 1):
        m.box(YELLOW, (sx * 1.0, -2.6, 1.0), (0.15, 1.4, 0.15), rot=(-0.3, 0, 0))
    m.cyl(DARK, (-1.6, 3.2, 0.7), (1.6, 3.2, 0.7), 0.45, seg=12)
    m.box(ORANGE, (0, -0.5, 3.3), (1.2, 0.3, 0.18), code=GLOW, bevel=0.05)
    m.slab((0, -0.5, 3.25), (2.0, 1.6, 0.14))

@model('snowmobile')
def _(m):
    m.box(WHITE, (0, -0.2, 0.6), (0.85, 1.6, 0.55), bevel=0.2, code=TINT, smooth=True)
    m.box(WHITE, (0, -0.85, 0.8), (0.7, 0.6, 0.4), rot=(-0.4, 0, 0), bevel=0.15, code=TINT, smooth=True)
    m.box(COAL, (0, 0.6, 0.8), (0.55, 1.1, 0.2), bevel=0.08, smooth=True)
    m.box(GLASS, (0, -0.95, 1.15), (0.65, 0.05, 0.35), rot=(-0.5, 0, 0), code=glow(0.2))
    m.cyl(DARK, (-0.35, -0.65, 1.1), (0.35, -0.65, 1.1), 0.025, seg=6)
    m.box(COAL, (0, 0.65, 0.28), (0.55, 1.6, 0.4), bevel=0.15, smooth=True)
    for sx in (-1, 1):
        m.box(DARK, (sx * 0.42, -1.1, 0.04), (0.12, 1.1, 0.04))
        m.box(DARK, (sx * 0.42, -1.7, 0.12), (0.12, 0.25, 0.04), rot=(-0.6, 0, 0))
        m.box(DARK, (sx * 0.42, -1.0, 0.25), (0.05, 0.05, 0.45))
    m.box(LAMP, (0, -1.18, 0.75), (0.3, 0.05, 0.12), code=GLOW)

@model('firetruck')
def _(m):
    m.box(RED, (0, -2.6, 1.6), (2.4, 2.2, 2.2), bevel=0.25, smooth=True)
    m.box(RED, (0, 1.0, 1.4), (2.4, 5.2, 1.8), bevel=0.2, smooth=True)
    m.box(GLASS, (0, -3.71, 2.0), (2.0, 0.04, 0.8), code=glow(0.2))
    for sx in (-1, 1):
        m.box(GLASS, (sx * 1.21, -2.7, 2.0), (0.04, 1.2, 0.7), code=glow(0.2))
        m.box(LAMP, (sx * 0.8, -3.72, 0.95), (0.3, 0.04, 0.2), code=GLOW)
        m.box(STEEL, (sx * 1.21, 1.0, 1.4), (0.04, 5.0, 0.1))
        m.box(STEEL, (sx * 0.5, 0.6, 2.55), (0.08, 6.4, 0.08))
    for i in range(14):
        m.box(STEEL, (0, -2.5 + i * 0.45, 2.55), (1.0, 0.05, 0.05))
    m.box('#4aa3ff', (-0.5, -2.6, 2.78), (0.4, 0.3, 0.16), code=GLOW, bevel=0.04)
    m.box(RED, (0.5, -2.6, 2.78), (0.4, 0.3, 0.16), code=GLOW, bevel=0.04)
    wheels(m, (-1.05, 1.05), (-2.6, 1.0, 2.6), 0.5, 0.35)
    m.slab((0, -2.6, 2.75), (2.0, 1.8, 0.14))

@model('gondola')
def _(m):
    m.box(WHITE, (0, 0, 1.25), (2.0, 2.0, 2.3), bevel=0.45, code=TINT, smooth=True)
    for sx in (-1, 1):
        m.box(GLASS, (sx * 0.99, 0, 1.6), (0.06, 1.5, 0.75), code=glow(0.2))
        m.box(GLASS, (0, sx * 0.99, 1.6), (1.5, 0.06, 0.75), code=glow(0.2))
    m.box(WHITE, (0, 0, 0.6), (2.04, 2.04, 0.2), code=TINT2)
    m.cyl(STEEL, (0, 0, 2.4), (0, 0, 3.6), 0.07, seg=8)
    m.cyl(STEEL, (0, 0, 3.6), (0, -0.5, 4.1), 0.07, seg=8)
    m.box(DARK, (0, -0.6, 4.1), (0.3, 0.5, 0.3), bevel=0.05)
    m.slab((0, 0, 2.42), (1.5, 1.5, 0.16))

@model('pylon')
def _(m):
    m.box(GRAY, (0, 0, 0.3), (1.6, 1.6, 0.6))
    m.cyl(STEEL, (0, 0, 0.6), (0, 0, 11.0), 0.45, 0.3, seg=10)
    m.box(STEEL, (0, 0, 11.2), (6.0, 0.45, 0.5))
    for sx in (-1, 1):
        for y in (-0.5, 0.5):
            m.cyl(DARK, (sx * 2.7, y - 0.12, 10.8), (sx * 2.7, y + 0.12, 10.8), 0.3, seg=10)
    for z in range(1, 11):
        m.box(DARK, (0, -0.35 - 0.0 * z, z), (0.4, 0.04, 0.04))
    m.slab((0, 0, 11.5), (5.8, 0.4, 0.14))

@model('watertower')
def _(m):
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(STEEL, (sx * 2.2, sy * 2.2, 0), (sx * 1.6, sy * 1.6, 10.0), 0.15, seg=6)
    for z in (3.5, 7.0):
        m.ring(STEEL, (0, 0, z), 2.1 - z * 0.06, 0.07, rot=(0, 0, PI / 4), seg=4, rings=4)
    m.cyl(WHITE, (0, 0, 10.0), (0, 0, 14.0), 2.8, seg=18, code=TINT)
    for z in (11.0, 13.0):
        m.ring(WHITE, (0, 0, z), 2.82, 0.06, seg=20, rings=4, code=TINT2)
    m.cone(WHITE, (0, 0, 14.0), (0, 0, 15.6), 3.0, seg=18, code=TINT2)
    m.cone(SNOW, (0, 0, 14.6), (0, 0, 15.75), 2.0, seg=18, wavy=0.08)

@model('train')
def _(m):
    m.cyl(COAL, (0, -5.0, 2.2), (0, 2.0, 2.2), 1.15, seg=16)
    for y in (-3.5, -1.5, 0.5):
        m.ring(GOLD, (0, y, 2.2), 1.17, 0.06, rot=(PI / 2, 0, 0), seg=18, rings=4)
    m.cyl(DRED, (0, -5.05, 2.2), (0, -5.15, 2.2), 1.0, seg=16)
    m.box(DRED, (0, 3.5, 2.7), (2.6, 3.0, 3.0), bevel=0.15)
    m.box(COAL, (0, 3.5, 4.3), (3.0, 3.4, 0.25), bevel=0.08)
    for sx in (-1, 1):
        m.box(LAMP, (sx * 1.31, 3.2, 3.2), (0.04, 1.0, 0.8), code=GLOW)
    m.cyl(COAL, (0, -3.8, 3.2), (0, -3.8, 4.6), 0.35, 0.6, seg=12)
    m.ball(GOLD, (0, -1.2, 3.4), (0.45, 0.45, 0.35))
    m.box(RED, (0, -5.6, 0.9), (2.6, 1.2, 1.2), rot=(0.6, 0, 0))
    m.cyl(LAMP, (0, -5.18, 3.0), (0, -5.3, 3.0), 0.3, seg=12, code=GLOW)
    m.box(COAL, (0, -1.0, 0.95), (2.4, 9.0, 0.5))
    for y in (-3.6, -1.4, 0.8, 3.2):
        for sx in (-1, 1):
            m.cyl(RED, (sx * 1.2, y, 0.95), (sx * 1.4, y, 0.95), 0.85 if y > -3 else 0.6, seg=14)
    m.box(STEEL, (1.45, -0.3, 0.95), (0.06, 5.0, 0.12))
    m.slab((0, 3.5, 4.5), (2.8, 3.2, 0.2))
    m.slab((0, -2.0, 3.3), (1.4, 5.0, 0.14))

@model('carriage')
def _(m):
    m.box('#2f6b4a', (0, 0, 2.2), (2.6, 11.0, 2.6), bevel=0.15)
    m.cyl('#2f6b4a', (0, -5.5, 3.4), (0, 5.5, 3.4), 1.4, seg=18)
    for sx in (-1, 1):
        for i in range(7):
            m.box(LAMP, (sx * 1.31, -4.3 + i * 1.43, 2.6), (0.04, 0.95, 0.85), code=GLOW)
        m.box(GOLD, (sx * 1.31, 0, 1.6), (0.04, 10.6, 0.1))
    m.box(COAL, (0, 0, 0.95), (2.4, 10.0, 0.4))
    for y in (-3.8, -2.8, 2.8, 3.8):
        for sx in (-1, 1):
            m.cyl(RED, (sx * 1.15, y, 0.6), (sx * 1.3, y, 0.6), 0.5, seg=12)
    m.slab((0, 0, 4.7), (1.6, 10.6, 0.25))

@model('sleigh')
def _(m):
    m.box(RED, (0, 0.2, 0.9), (1.6, 2.4, 0.9), bevel=0.25, smooth=True)
    m.box(RED, (0, 1.1, 1.5), (1.6, 0.6, 1.1), bevel=0.25, smooth=True)
    m.box(DRED, (0, 0.3, 1.32), (1.3, 1.3, 0.1))
    for sx in (-1, 1):
        m.box(GOLD, (sx * 0.85, 0.2, 0.92), (0.04, 2.3, 0.18), code=glow(0.3))
        m.box(GOLD, (sx * 0.65, 0.1, 0.08), (0.08, 3.0, 0.08))
        prev = (sx * 0.65, -1.4, 0.08)
        for i in range(1, 6):
            a = i / 5 * PI * 1.2
            p = (sx * 0.65, -1.4 - math.sin(a) * 0.35, 0.08 + (1 - math.cos(a)) * 0.35)
            m.cyl(GOLD, prev, p, 0.05, seg=6)
            prev = p
        m.box(GOLD, (sx * 0.65, -0.2, 0.4), (0.06, 0.06, 0.65))
        m.box(GOLD, (sx * 0.65, 0.7, 0.4), (0.06, 0.06, 0.65))
    m.lump('#9a6a3c', (0, 0.6, 1.9), (0.6, 0.55, 0.65), sub=2, noise=0.08)
    m.ring(GOLD, (0, 0.6, 2.4), 0.15, 0.04, seg=10, rings=4)
    for i, (x, y, c) in enumerate(((-0.4, -0.4, GREEN), (0.35, -0.5, '#4aa3ff'), (0.0, -0.1, GOLD))):
        m.box(c, (x, y, 1.6), (0.4, 0.4, 0.4), rot=(0, 0, i * 0.5), bevel=0.02)
        m.box(RED, (x, y, 1.6), (0.41, 0.08, 0.41), rot=(0, 0, i * 0.5))


# ===================================================================================================== buildings
def windows(m, x0, x1, y, z, n, w=0.7, h=0.9, axis='x', glow=GLOW, shutters=None):
    for i in range(n):
        t = (i + 0.5) / n
        c = x0 + (x1 - x0) * t
        if axis == 'x':
            m.box(LAMP, (c, y, z), (w, 0.08, h), code=glow)
            m.box(WHITE, (c, y, z), (0.07, 0.1, h), code=0)
            m.box(WHITE, (c, y - 0.01 * (1 if y < 0 else -1), z - h / 2 - 0.05), (w + 0.2, 0.18, 0.1))
            if shutters:
                for sx in (-1, 1):
                    m.box(shutters, (c + sx * (w / 2 + 0.17), y, z), (0.28, 0.1, h + 0.05))
        else:
            m.box(LAMP, (y, c, z), (0.08, w, h), code=glow)
            m.box(WHITE, (y, c, z), (0.1, 0.07, h))
            m.box(WHITE, (y, c, z - h / 2 - 0.05), (0.18, w + 0.2, 0.1))
            if shutters:
                for sx in (-1, 1):
                    m.box(shutters, (y, c + sx * (w / 2 + 0.17), z), (0.1, 0.28, h + 0.05))

def snowroof(m, at, w, d, h, color, rot=(0, 0, 0), thick=0.35):
    """a gable roof under a fat duvet of snow; ridge along y, then rotated"""
    m.roof(color, at, w, d, h, rot=rot)
    x, y, z = at
    m.roof(SNOW, (x, y, z + thick), w * 0.97, d * 1.0, h * 0.98, rot=rot)

def icicles(m, x0, x1, y, z, n, L=0.5):
    for i in range(n):
        x = x0 + (x1 - x0) * (i + 0.5) / n
        l = L * (0.5 + 0.5 * ((i * 37) % 7) / 6)
        m.cone(ICE, (x, y, z), (x, y, z - l), 0.06, seg=5, smooth=False)

@model('cabin')
def _(m):
    m.box('#8a5a33', (0, 0, 1.4), (6.0, 5.0, 2.8))
    for z in range(6):
        for sy in (-1, 1):
            m.cyl('#7a4a28', (-3.05, sy * 2.52, 0.25 + z * 0.47), (3.05, sy * 2.52, 0.25 + z * 0.47), 0.2, seg=6)
    windows(m, -2.6, -0.8, -2.62, 1.5, 1, 1.0, 1.0, shutters=GREEN)
    windows(m, 0.8, 2.6, -2.62, 1.5, 1, 1.0, 1.0, shutters=GREEN)
    m.box(WOOD2, (0, -2.65, 1.05), (1.0, 0.1, 2.1))
    snowroof(m, (0, 0, 2.75), 6.8, 6.4, 2.2, WOOD2, rot=(0, 0, PI / 2))
    m.box(STONE, (2.0, 1.0, 4.2), (0.7, 0.7, 2.6))
    m.slab((2.0, 1.0, 5.55), (0.75, 0.75, 0.2))
    icicles(m, -3.0, 3.0, -3.25, 2.6, 9, 0.6)

@model('chalet')
def _(m):
    m.box(STONE2, (0, 0, 0.45), (8.4, 7.4, 0.9))
    m.box('#f1e7d6', (0, 0, 2.2), (8.0, 7.0, 2.6))
    m.box(WOOD, (0, 0, 4.6), (8.0, 7.0, 2.2))
    for z in (3.8, 4.3, 4.8, 5.3):
        m.box(WOOD2, (0, -3.52, z), (8.0, 0.04, 0.05))
    windows(m, -3.6, 3.6, -3.55, 2.3, 3, 0.9, 1.1, shutters=RED)
    windows(m, -3.6, 3.6, -3.55, 4.6, 3, 0.8, 1.0, shutters=RED)
    windows(m, -3.0, 3.0, 3.55, 2.3, 2, 0.9, 1.1, shutters=RED)
    m.box(WOOD2, (0, -3.55, 1.55), (1.1, 0.1, 2.1))
    m.box(WOOD, (0, -4.1, 3.5), (8.4, 1.3, 0.18))
    for i in range(17):
        m.box(WOODL, (-4.0 + i * 0.5, -4.7, 3.95), (0.18, 0.06, 0.75))
    m.box(WOOD, (0, -4.72, 4.35), (8.4, 0.1, 0.12))
    snowroof(m, (0, 0, 5.65), 10.6, 9.4, 3.2, '#6b3f22', thick=0.45)
    m.box(STONE, (2.5, 1.5, 7.6), (0.8, 0.8, 2.4))
    m.slab((2.5, 1.5, 8.85), (0.9, 0.9, 0.25))
    icicles(m, -5.0, 5.0, -4.65, 5.6, 14, 0.7)

@model('house')
def _(m):
    m.box(WHITE, (0, 0, 4.0), (7.0, 7.0, 8.0), code=TINT)
    m.box(WHITE, (0, 0, 0.3), (7.2, 7.2, 0.6), code=TINT2)
    for z in (1.8, 4.3, 6.6):
        windows(m, -3.2, 3.2, -3.53, z, 3, 0.9, 1.3, shutters=None)
        windows(m, -3.2, 3.2, 3.53, z, 3, 0.9, 1.3)
        windows(m, -3.0, 3.0, 3.53, z, 2, 0.9, 1.3, axis='y')
        windows(m, -3.0, 3.0, -3.53, z, 2, 0.9, 1.3, axis='y')
    m.box(WOOD2, (0, -3.55, 1.2), (1.2, 0.12, 2.3))
    snowroof(m, (0, 0, 7.95), 7.8, 7.8, 4.2, '#7a3b2e', rot=(0, 0, PI / 2), thick=0.4)
    m.box(STONE, (-2.0, 1.2, 11.0), (0.8, 0.8, 2.4))
    m.slab((-2.0, 1.2, 12.25), (0.9, 0.9, 0.22))
    icicles(m, -3.8, 3.8, -3.9, 7.9, 10, 0.8)

@model('shop')
def _(m):
    m.box(WHITE, (0, 0, 3.5), (8.0, 7.0, 7.0), code=TINT)
    m.box(LAMP, (0, -3.53, 1.6), (5.2, 0.1, 2.2), code=GLOW)
    for x in (-1.3, 1.3):
        m.box(WHITE, (x, -3.56, 1.6), (0.12, 0.1, 2.2))
    m.box(WOOD2, (3.1, -3.55, 1.2), (1.1, 0.12, 2.3))
    for i in range(9):
        m.box(WHITE if i % 2 else RED, (-3.6 + i * 0.9, -4.1, 3.35), (0.9, 1.4, 0.06), rot=(-0.45, 0, 0), code=TINT2 if i % 2 == 0 else 0)
    m.box(DARK, (0, -3.6, 4.4), (5.0, 0.15, 0.9))
    m.box(GOLD, (0, -3.69, 4.4), (4.2, 0.04, 0.35), code=glow(0.5))
    windows(m, -3.2, 3.2, -3.53, 5.6, 3, 0.9, 1.1)
    snowroof(m, (0, 0, 6.95), 8.8, 7.8, 3.0, '#4f5866', rot=(0, 0, PI / 2), thick=0.4)
    icicles(m, -4.2, 4.2, -3.9, 6.9, 12, 0.6)

@model('church')
def _(m):
    m.box('#f4efe6', (0, 2.0, 4.0), (8.0, 14.0, 8.0))
    for sx in (-1, 1):
        for i in range(4):
            m.box(LAMP, (sx * 4.03, -2.5 + i * 3.4, 4.2), (0.08, 1.0, 3.0), code=GLOW)
            m.cyl(LAMP, (sx * 4.0, -2.5 + i * 3.4, 5.7), (sx * 4.07, -2.5 + i * 3.4, 5.7), 0.5, seg=10, code=GLOW)
    snowroof(m, (0, 2.0, 7.95), 9.0, 14.4, 5.0, SLATE, thick=0.45)
    m.box('#f4efe6', (0, -6.5, 7.0), (5.0, 5.0, 14.0))
    m.box(WOOD2, (0, -9.03, 1.6), (2.0, 0.12, 3.2))
    m.cyl(WOOD2, (0, -9.03, 3.2), (0, -9.09, 3.2), 1.0, seg=12)
    for (x, y, rz) in ((0, -9.02, 0), (2.52, -6.5, 1), (-2.52, -6.5, 1)):
        if rz:
            m.cyl(WHITE, (x, y, 11.0), (x + 0.06 * (1 if x > 0 else -1), y, 11.0), 1.3, seg=20)
            m.box(DARK, (x + 0.08 * (1 if x > 0 else -1), y, 11.3), (0.04, 0.12, 0.8))
        else:
            m.cyl(WHITE, (x, y, 11.0), (x, y - 0.06, 11.0), 1.3, seg=20)
            m.box(DARK, (0.3, y - 0.08, 11.0), (0.7, 0.04, 0.12))
            m.box(DARK, (0, y - 0.08, 11.3), (0.12, 0.04, 0.7))
    m.box(LAMP, (0, -9.02, 8.0), (1.0, 0.1, 1.6), code=GLOW)
    m.cone(SLATE, (0, -6.5, 14.0), (0, -6.5, 22.0), 3.3, seg=8, smooth=False)
    m.cone(SNOW, (0, -6.5, 15.4), (0, -6.5, 17.3), 2.85, seg=8, smooth=False, wavy=0.1)
    m.cyl(GOLD, (0, -6.5, 22.0), (0, -6.5, 23.4), 0.08, seg=6)
    m.box(GOLD, (0, -6.5, 23.0), (0.8, 0.1, 0.1))

@model('clocktower')
def _(m):
    m.box(STONE, (0, 0, 9.0), (6.0, 6.0, 18.0))
    for z in (4.0, 8.0, 12.0):
        m.box(STONE2, (0, 0, z), (6.2, 6.2, 0.4))
    for a in range(4):
        mk = m.mark()
        m.cyl(WHITE, (0, -3.0, 14.5), (0, -3.12, 14.5), 2.2, seg=24, code=glow(0.4))
        m.ring(GOLD, (0, -3.12, 14.5), 2.2, 0.12, rot=(PI / 2, 0, 0), seg=24, rings=4)
        m.box(DARK, (0, -3.17, 15.2), (0.18, 0.05, 1.5))
        m.box(DARK, (0.5, -3.17, 14.5), (1.1, 0.05, 0.16))
        m.box(LAMP, (0, -3.04, 7.0), (1.0, 0.1, 1.8), code=GLOW)
        m.move(mk, T(yaw=a * PI / 2))
    m.box(STONE2, (0, 0, 18.3), (7.0, 7.0, 0.6))
    m.cone('#4fa08a', (0, 0, 18.6), (0, 0, 25.0), 4.6, seg=4, rot=(0, 0, PI / 4), smooth=False)
    m.cone(SNOW, (0, 0, 20.4), (0, 0, 25.15), 3.45, seg=4, rot=(0, 0, PI / 4), smooth=False, wavy=0.06)
    m.cyl(GOLD, (0, 0, 25.0), (0, 0, 26.5), 0.1, seg=6)
    m.ball(GOLD, (0, 0, 26.6), 0.3)
    m.box(WOOD2, (0, -3.03, 1.6), (1.6, 0.12, 3.2))

@model('lodge')
def _(m):
    m.box(STONE2, (0, 0, 1.6), (26.0, 14.0, 3.2))
    m.box(WOOD, (0, 0, 5.4), (26.0, 14.0, 4.4))
    windows(m, -12.0, 12.0, -7.03, 1.8, 8, 1.4, 1.6, glow=GLOW)
    windows(m, -12.0, 12.0, -7.03, 5.4, 7, 1.5, 1.8, glow=GLOW)
    windows(m, -12.0, 12.0, 7.03, 5.4, 7, 1.5, 1.8, glow=GLOW)
    snowroof(m, (0, 0, 7.55), 28.0, 17.0, 6.5, '#5a3520', rot=(0, 0, PI / 2), thick=0.6)
    m.roof(LAMP, (0, -7.2, 7.6), 9.0, 0.3, 5.0, code=GLOW)          # the big A-frame window over the door
    m.roof(WOOD2, (0, -7.4, 7.6), 10.0, 0.4, 5.6)
    m.roof(LAMP, (0, -7.62, 7.9), 8.4, 0.1, 4.6, code=GLOW)
    m.box(WOOD, (0, -9.0, 3.4), (20.0, 4.0, 0.3))
    for i in range(41):
        m.box(WOODL, (-10.0 + i * 0.5, -10.95, 3.95), (0.14, 0.08, 0.9))
    m.box(WOOD, (0, -10.97, 4.45), (20.2, 0.16, 0.16))
    for x in (-9.5, -3.5, 3.5, 9.5):
        m.box(WOOD2, (x, -10.8, 1.7), (0.4, 0.4, 3.4))
    for x in (-8.0, 8.0):
        m.box(STONE, (x, 3.0, 12.0), (1.4, 1.4, 5.0))
        m.slab((x, 3.0, 14.6), (1.5, 1.5, 0.3))
    m.box(RED, (0, -11.1, 5.6), (8.0, 0.3, 1.4))
    m.box(CREAM, (0, -11.27, 5.6), (7.0, 0.04, 0.6), code=glow(0.4))
    icicles(m, -13.5, 13.5, -8.4, 7.4, 26, 1.2)

@model('hotel')
def _(m):
    m.box(WHITE, (0, 0, 12.0), (24.0, 16.0, 24.0), code=TINT)
    m.box(STONE2, (0, 0, 1.6), (24.4, 16.4, 3.2))
    for f in range(6):
        z = 5.0 + f * 3.4
        windows(m, -11.0, 11.0, -8.03, z, 8, 1.2, 1.8)
        windows(m, -11.0, 11.0, 8.03, z, 8, 1.2, 1.8)
        windows(m, -7.0, 7.0, 12.03, z, 4, 1.2, 1.8, axis='y')
        windows(m, -7.0, 7.0, -12.03, z, 4, 1.2, 1.8, axis='y')
        if f % 2 == 1:
            m.box(WHITE, (0, -8.5, z - 1.1), (22.0, 1.0, 0.2), code=TINT2)
    m.box(LAMP, (0, -8.25, 1.8), (6.0, 0.3, 2.4), code=GLOW)
    m.box(RED, (0, -9.6, 3.5), (8.0, 3.0, 0.3), rot=(0.12, 0, 0))
    m.add('cyl', SLATE, (0, 0, 26.0), (34.0 * 1.0, 22.6, 4.0), (0, 0, PI / 4), seg=4, top=0.72, smooth=False)
    m.box(SNOW, (0, 0, 28.0), (16.6, 8.6, 0.8), bevel=0.35, smooth=True)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(WHITE, (sx * 11.5, sy * 7.5, 0), (sx * 11.5, sy * 7.5, 27.0), 2.3, seg=12, code=TINT)
            m.cone(SLATE, (sx * 11.5, sy * 7.5, 27.0), (sx * 11.5, sy * 7.5, 33.0), 2.8, seg=12, smooth=False)
            m.cone(SNOW, (sx * 11.5, sy * 7.5, 28.6), (sx * 11.5, sy * 7.5, 33.1), 2.15, seg=12, smooth=False, wavy=0.08)
    for x in (-5.0, 0.0, 5.0):
        m.cyl(STEEL, (x, -4.0, 28.0), (x, -4.0, 32.5), 0.08, seg=5)
        m.box((RED, WHITE, '#3a7ad0')[int(x / 5 + 1)], (x + 0.9, -4.0, 31.9), (1.7, 0.06, 1.0), wig=grad((x, -4, 32), 1.8, 0.7))

@model('castle')
def _(m):
    S, S2 = '#b9b2a6', '#9c958a'
    for sx in (-1, 1):   # curtain walls
        m.box(S, (sx * 20.0, 0, 6.0), (3.0, 40.0, 12.0))
        m.box(S, (0, sx * 20.0, 6.0), (40.0, 3.0, 12.0))
        for i in range(10):
            m.box(S2, (sx * 20.0, -18 + i * 4.0, 12.6), (3.2, 1.8, 1.4))
            m.box(S2, (-18 + i * 4.0, sx * 20.0, 12.6), (1.8, 3.2, 1.4))
    m.box('#3a2a20', (0, -21.55, 4.0), (6.0, 0.2, 8.0))
    m.cyl('#3a2a20', (0, -21.55, 8.0), (0, -21.75, 8.0), 3.0, seg=16)
    for sx in (-1, 1):
        for sy in (-1, 1):
            m.cyl(S, (sx * 20, sy * 20, 0), (sx * 20, sy * 20, 20.0), 4.5, seg=14)
            m.cone(WHITE, (sx * 20, sy * 20, 20.0), (sx * 20, sy * 20, 30.0), 5.4, seg=14, code=TINT, smooth=False)
            m.cone(SNOW, (sx * 20, sy * 20, 23.0), (sx * 20, sy * 20, 30.15), 3.9, seg=14, smooth=False, wavy=0.08)
            for i in range(3):
                m.box(LAMP, (sx * 20 + sx * 0.2, sy * 20 - sy * 4.45, 6.0 + i * 5), (0.9, 0.2, 1.6), code=GLOW)
    m.box(S, (0, 4.0, 14.0), (18.0, 18.0, 28.0))
    for f in range(4):
        windows(m, -7.5, 7.5, -5.03, 6.0 + f * 5.5, 4, 1.2, 2.2)
    for i in range(8):
        m.box(S2, (-7.9 + i * 2.25, -5.0, 28.6), (1.2, 1.4, 1.4))
    snowroof(m, (0, 4.0, 28.0), 19.0, 19.0, 8.0, WHITE, thick=0.6)
    m.cyl(S, (6.0, -1.0, 0), (6.0, -1.0, 40.0), 3.2, seg=12)
    m.cone(WHITE, (6.0, -1.0, 40.0), (6.0, -1.0, 50.0), 4.0, seg=12, code=TINT, smooth=False)
    m.cone(SNOW, (6.0, -1.0, 42.5), (6.0, -1.0, 50.15), 3.05, seg=12, smooth=False, wavy=0.08)
    m.cyl(STEEL, (6.0, -1.0, 50.0), (6.0, -1.0, 54.0), 0.12, seg=5)
    m.box(WHITE, (7.2, -1.0, 53.3), (2.4, 0.08, 1.4), code=TINT2, wig=grad((6, -1, 53), 2.5, 0.8))

@model('ferris')
def _(m):
    R = 11.0
    for sy in (-1.2, 1.2):
        m.ring(WHITE, (0, sy, 13.0), R, 0.25, rot=(PI / 2, 0, 0), seg=40, rings=5, code=TINT2)
        for i in range(12):
            a = i / 12 * 2 * PI
            m.cyl(STEEL, (0, sy, 13.0), (math.cos(a) * R, sy, 13.0 + math.sin(a) * R), 0.12, seg=5)
    m.cyl(DARK, (0, -1.6, 13.0), (0, 1.6, 13.0), 0.7, seg=12)
    for sy in (-1, 1):
        for sx in (-1, 1):
            m.cyl(WHITE, (sx * 6.0, sy * 3.0, 0), (0, sy * 1.6, 13.0), 0.35, seg=8, code=TINT2)
    for i in range(12):
        a = i / 12 * 2 * PI
        x, z = math.cos(a) * R, 13.0 + math.sin(a) * R
        m.box(WHITE if i % 2 else RED, (x, 0, z - 1.4), (1.8, 1.8, 1.6), bevel=0.3, code=TINT if i % 2 else 0)
        m.cyl(STEEL, (x, 0, z), (x, 0, z - 0.6), 0.08, seg=4)
        m.ball(LAMP, (x, 0, z), 0.3, seg=8, rings=6, code=GLOW)

@model('banner')
def _(m):
    for sx in (-1, 1):
        m.cyl(WHITE, (sx * 6.0, 0, 0), (sx * 6.0, 0, 6.0), 0.25, seg=10, code=TINT2)
        m.ball(WHITE, (sx * 6.0, 0, 6.1), 0.35, code=TINT2)
    for i in range(12):
        x = -5.5 + i
        m.box(WHITE if i % 2 else COAL, (x, 0, 5.2), (1.0, 0.08, 1.4), code=TINT if i % 2 else 0, wig=0.25 * math.sin((i + 0.5) / 12 * PI))
    for i in range(12):
        m.box(COAL if i % 2 else WHITE, (-5.5 + i, -0.01, 4.85), (1.0, 0.08, 0.35), code=0 if i % 2 else TINT, wig=0.25 * math.sin((i + 0.5) / 12 * PI))


# ===================================================================================================== build + export
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o)
built = []
for name, fn in MODELS.items():
    md = Model(name)
    fn(md)
    built.append(md.finish())
print('built', len(built), 'models')

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_materials='NONE', export_vertex_color='ACTIVE',
                          export_yup=True, export_normals=True, export_texcoords=True,
                          export_meshopt_compression_enable=True)
# Each model's size in the game's axes (x across, y up, z along), for the physics and the item catalogue:
# [width, height, depth, lowest point]
import os
lines = []
for ob in built:
    vs = [v.co for v in ob.data.vertices]
    lo = [min(c[k] for c in vs) for k in range(3)]
    hi = [max(c[k] for c in vs) for k in range(3)]
    lines.append(f"  {ob.name}: [{hi[0] - lo[0]:.3f}, {hi[2] - lo[2]:.3f}, {hi[1] - lo[1]:.3f}, {lo[2]:.3f}],")
with open(os.path.join(os.path.dirname(OUT), 'dims.js'), 'w') as f:
    f.write('// Written by blender/models.py beside models.glb: each model\'s [width, height, depth, lowest point] in metres.\n')
    f.write('export const DIMS = {\n' + '\n'.join(lines) + '\n};\n')
for ob in built:
    me = ob.data
    print(f'{ob.name:12s} {len(me.polygons):6d} faces  {ob.dimensions.x:6.2f} x {ob.dimensions.y:6.2f} x {ob.dimensions.z:6.2f}')

# Contact sheet: every model scaled into a cell and seen from a little above, rendered by the workbench engine
# in vertex colours.
if SHEET:
    cols = 10
    rows = (len(built) + cols - 1) // cols
    for i, ob in enumerate(built):
        vs = [v.co for v in ob.data.vertices]
        ext = [max(c[k] for c in vs) - min(c[k] for c in vs) for k in range(3)]
        s = 1.7 / max(ext)
        ob.scale = (s, s, s)
        ob.rotation_mode = 'ZYX'
        ob.rotation_euler = (0.38, 0, -0.65)
        ob.location = ((i % cols) * 2.2, 0, -(i // cols) * 2.5 - ext[2] * s * 0.45)
        cu = bpy.data.curves.new(ob.name + '_t', 'FONT')
        cu.body = ob.name
        cu.size = 0.22
        t = bpy.data.objects.new(ob.name + '_t', cu)
        t.location = ((i % cols) * 2.2 - 0.9, -3, -(i // cols) * 2.5 - 1.15)
        t.rotation_euler = (PI / 2, 0, 0)
        bpy.context.scene.collection.objects.link(t)
    cam = bpy.data.cameras.new('cam')
    cam.type = 'ORTHO'
    cam.ortho_scale = cols * 2.2 + 0.2
    co = bpy.data.objects.new('cam', cam)
    co.location = ((cols - 1) * 2.2 / 2, -40, -(rows - 1) * 2.5 / 2)
    co.rotation_euler = (PI / 2, 0, 0)
    bpy.context.scene.collection.objects.link(co)
    sc = bpy.context.scene
    sc.camera = co
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'
    sc.display.shading.color_type = 'VERTEX'
    sc.render.resolution_x = 2200
    sc.render.resolution_y = int(2200 * rows * 2.5 / (cols * 2.2 + 0.2))
    sc.render.filepath = SHEET
    sc.world = bpy.data.worlds.new('w')
    sc.world.color = (0.75, 0.8, 0.88)
    bpy.ops.render.render(write_still=True)
