"""
SWARM FIGHTER v2 — dark angular stealth craft with cyan glow, procedural GLB.
+Y up, +Z forward (nose), +X right. Side view is the hero camera.
Hard-surface faceted style: chamfered edges, panel steps, flat shading.
All parts are seated against the computed hull cross-section (nothing floats).
"""
import numpy as np
import trimesh
from trimesh.creation import cylinder
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals

def mat(name, color, metallic, rough, emissive=None, alpha=None):
    m = PBRMaterial(name=name,
                    baseColorFactor=[*color, 1.0 if alpha is None else alpha],
                    metallicFactor=metallic, roughnessFactor=rough)
    if emissive is not None:
        m.emissiveFactor = list(emissive)
    if alpha is not None:
        m.alphaMode = "BLEND"
        m.doubleSided = True
    return m

M = {
    "hull":    mat("HullDark", (0.105, 0.125, 0.140), 0.75, 0.48),
    "panel":   mat("PanelDark", (0.150, 0.175, 0.195), 0.70, 0.42),
    "trim":    mat("TrimGray", (0.16, 0.19, 0.21), 0.80, 0.35),
    "cyan":    mat("CyanGlow", (0.20, 0.95, 1.0), 0.0, 0.3, emissive=(0.10, 0.85, 1.0)),
    "cyandim": mat("CyanDim", (0.10, 0.55, 0.62), 0.0, 0.4, emissive=(0.04, 0.40, 0.48)),
    "core":    mat("CoreWhite", (0.85, 1.0, 1.0), 0.0, 0.2, emissive=(0.80, 1.0, 1.0)),
    "flame_o": mat("FlameOuter", (0.20, 0.90, 1.0), 0.0, 0.5, emissive=(0.10, 0.75, 0.95), alpha=0.45),
    "flame_i": mat("FlameInner", (0.85, 1.0, 1.0), 0.0, 0.4, emissive=(0.80, 1.0, 1.0), alpha=0.85),
}
PARTS = {k: [] for k in M}
SUBDIV = {"hull": 2, "panel": 2, "trim": 1, "cyan": 1, "cyandim": 1,
          "core": 1, "flame_o": 1, "flame_i": 1}   # planar subdivision per group

def add(material, mesh, translate=None, rotate=None, scale=None):
    m = mesh.copy()
    if scale is not None:
        if np.isscalar(scale): scale = [scale] * 3
        m.apply_scale(scale)
    if rotate is not None:
        if isinstance(rotate, tuple):
            ang, axis = rotate
            m.apply_transform(trimesh.transformations.rotation_matrix(ang, axis))
        else:
            m.apply_transform(rotate)
    if translate is not None:
        m.apply_translation(translate)
    PARTS[material].append(m)
    return m

def rotx(a): return (a, [1, 0, 0])
def rotz(a): return (a, [0, 0, 1])

def loft(profiles, close_caps=True):
    profiles = [np.asarray(p, dtype=float) for p in profiles]
    N = len(profiles[0])
    verts = np.vstack(profiles)
    faces = []
    for k in range(len(profiles) - 1):
        a0, b0 = k * N, (k + 1) * N
        for i in range(N):
            j = (i + 1) % N
            faces.append([a0 + i, b0 + i, b0 + j])
            faces.append([a0 + i, b0 + j, a0 + j])
    if close_caps:
        c0 = len(verts)
        verts = np.vstack([verts, profiles[0].mean(axis=0), profiles[-1].mean(axis=0)])
        for i in range(N):
            j = (i + 1) % N
            faces.append([c0, j, i])
            base = (len(profiles) - 1) * N
            faces.append([c0 + 1, base + i, base + j])
    m = trimesh.Trimesh(vertices=verts, faces=np.array(faces), process=False)
    m.fix_normals()
    try:
        if m.volume < 0: m.invert()
    except Exception:
        pass
    return m

def ablade(stations, axis="x"):
    """Chamfered angular blade: 8-point beveled diamond cross-section.
    stations: (cx, cy, cz, chord, th)."""
    profs = []
    for cx, cy, cz, chord, th in stations:
        c2, t2 = chord / 2, th / 2
        shape = [(0, c2), (t2 * 0.7, c2 * 0.45), (t2, 0), (t2 * 0.7, -c2 * 0.5),
                 (0, -c2), (-t2 * 0.7, -c2 * 0.5), (-t2, 0), (-t2 * 0.7, c2 * 0.45)]
        pts = []
        for w, u in shape:
            if axis == "x":   # span x: thickness y, chord z
                pts.append([cx, cy + w, cz + u])
            else:             # span y: thickness x, chord z
                pts.append([cx + w, cy, cz + u])
        profs.append(np.array(pts))
    return loft(profs)

def strip(stations):
    """Thin glowing strip hugging a surface. stations: (x, y, z, height, thick)."""
    profs = []
    for x, y, z, h, t in stations:
        profs.append(np.array([[x, y + h / 2, z], [x + t / 2, y, z],
                               [x, y - h / 2, z], [x - t / 2, y, z]]))
    return loft(profs)

# ================================================================ HULL CROSS-SECTION MODEL
key_z   = [1.10, 0.78, 0.42, 0.05, -0.45, -0.92, -1.32]
key_top = [0.00, 0.14, 0.28, 0.38, 0.45, 0.43, 0.31]
key_bot = [-0.05, -0.15, -0.22, -0.26, -0.26, -0.245, -0.21]
key_w   = [0.02, 0.15, 0.27, 0.32, 0.30, 0.30, 0.28]

def topAt(z): return np.interp(z, key_z[::-1], key_top[::-1])
def botAt(z): return np.interp(z, key_z[::-1], key_bot[::-1])
def wAt(z):   return np.interp(z, key_z[::-1], key_w[::-1])
def yshAt(z):
    t, b = topAt(z), botAt(z)
    return b + (t - b) * 0.62
def yloAt(z):
    t, b = topAt(z), botAt(z)
    return b + (t - b) * 0.18

def y_upper(x, z):
    """y of the upper hull edge (top ridge -> shoulder) at |x|."""
    t, w = topAt(z), wAt(z)
    return t + (yshAt(z) - t) * min(abs(x) / max(0.75 * w, 1e-6), 1.0)

def y_lower(x, z):
    """y of the lower hull edge (keel -> lower corner) at |x|."""
    b, w = botAt(z), wAt(z)
    return b + (yloAt(z) - b) * min(abs(x) / max(w, 1e-6), 1.0)

def x_flank(y, z):
    """x of the flank face at height y (between lower corner and shoulder)."""
    w, ysh, ylo = wAt(z), yshAt(z), yloAt(z)
    fr = np.clip((ysh - y) / max(ysh - ylo, 1e-6), 0.0, 1.0)
    return 0.75 * w + 0.25 * w * fr

# ================================================================ HULL (chamfered + panel steps)
def hull_ring(z):
    t, b, w = topAt(z), botAt(z), wAt(z)
    # subtle paneling steps along the length
    pidx = int(np.floor((z + 1.2) / 0.34))
    w *= 1.0 + 0.013 * (1 if pidx % 2 == 0 else -1)
    ysh, ylo = yshAt(z), yloAt(z)
    T = np.array([0.0, t]); SH = np.array([0.75 * w, ysh])
    LO = np.array([w, ylo]); B = np.array([0.0, b])
    pr = [np.array([0.09 * w, t - 0.012]),
          SH + 0.18 * (T - SH), SH + 0.18 * (LO - SH),
          LO + 0.18 * (SH - LO), LO + 0.18 * (B - LO),
          np.array([0.24 * w, b + 0.012])]
    ring = [np.array([-p[0], p[1]]) for p in pr] + [p for p in pr[::-1]]
    return np.array([[p[0], p[1], z] for p in ring])

zs = np.linspace(key_z[-1], key_z[0], 48)        # rear -> nose
add("hull", loft([hull_ring(z) for z in zs]))

# ================================================================ TAIL FIN (rooted under the spine)
def edge_stripe(st):
    """Cyan stripe inset along a blade's leading edge, from the blade's own stations."""
    return [(cx, cy, cz + ch * 0.30, ch * 0.16, th * 1.15) for cx, cy, cz, ch, th in st]

tail_st = [(0, topAt(-0.45) - 0.07, -0.45, 0.85, 0.075),
           (0, 0.56, -0.70, 0.62, 0.062),
           (0, 0.72, -0.85, 0.50, 0.052),
           (0, 0.89, -1.00, 0.38, 0.040),
           (0, 1.05, -1.12, 0.26, 0.030)]
add("hull", ablade(tail_st, axis="y"))
add("cyan", ablade(edge_stripe(tail_st), axis="y"))

# ================================================================ UPPER FINS (rooted inside upper edge)
for s in (+1, -1):
    fin_st = [(s * 0.07, y_upper(0.07, 0.12) - 0.10, 0.12, 0.66, 0.090),
              (s * 0.30, 0.40, -0.02, 0.52, 0.072),
              (s * 0.55, 0.55, -0.20, 0.40, 0.060),
              (s * 0.72, 0.67, -0.35, 0.30, 0.046),
              (s * 0.85, 0.78, -0.48, 0.22, 0.035)]
    add("hull", ablade(fin_st))
    add("cyan", ablade(edge_stripe(fin_st)))

# ================================================================ LOWER WINGS (rooted inside lower edge)
for s in (+1, -1):
    wing_st = [(s * 0.10, y_lower(0.10, 0.05) + 0.06, 0.05, 0.88, 0.095),
               (s * 0.42, -0.245, -0.13, 0.72, 0.078),
               (s * 0.65, -0.35, -0.30, 0.55, 0.062),
               (s * 0.86, -0.46, -0.46, 0.40, 0.048),
               (s * 1.05, -0.58, -0.62, 0.28, 0.035)]
    add("hull", ablade(wing_st))
    add("cyan", ablade(edge_stripe(wing_st)))

# ================================================================ CHEST GLOW PANEL (diamond on nose slope)
slope = np.arctan2(topAt(0.35) - topAt(0.80), 0.45)
pz = 0.55
py = topAt(pz)

def diamond(w, L, t, drop):
    """Faceted diamond plate whose side tips bend down by `drop` to hug the ridge."""
    v = [[0, t, 0], [0, -t, 0], [w, -drop, 0], [-w, -drop, 0], [0, 0, L], [0, 0, -L]]
    f = [[0, 4, 2], [0, 2, 5], [0, 5, 3], [0, 3, 4],
         [1, 2, 4], [1, 5, 2], [1, 3, 5], [1, 4, 3]]
    return trimesh.Trimesh(vertices=v, faces=f, process=False)

drop_p = py - y_upper(0.105, pz) + 0.03
drop_c = py - y_upper(0.075, pz) + 0.03
add("panel", diamond(0.105, 0.34, 0.014, drop_p), rotate=rotx(slope),
    translate=[0, py - 0.006, pz])
add("cyan", diamond(0.075, 0.26, 0.022, drop_c), rotate=rotx(slope),
    translate=[0, py + 0.002, pz])

# ================================================================ FLANK CYAN STRIPES (hugging the flank face)
for s in (+1, -1):
    # upper stripe — half-buried in the flank face so it can never float
    st = []
    zs_u = [0.55, 0.40, 0.25, 0.08, -0.12, -0.35]
    hs_u = [0.020, 0.050, 0.055, 0.055, 0.050, 0.022]
    for z, h in zip(zs_u, hs_u):
        yfr = np.interp(z, [-0.35, 0.68], [0.64, 0.70])
        y = yloAt(z) + (yshAt(z) - yloAt(z)) * yfr
        st.append((s * (x_flank(y, z) + 0.002), y, z, h, 0.026))
    add("cyan", strip(st))
    # lower stripe — angled down toward the rear, half-buried
    st2 = []
    zs_l = [-0.05, -0.30, -0.55, -0.80]
    hs_l = [0.018, 0.045, 0.042, 0.018]
    for z, h in zip(zs_l, hs_l):
        yfr = np.interp(z, [-0.80, -0.05], [0.14, 0.42])
        y = yloAt(z) + (yshAt(z) - yloAt(z)) * yfr
        st2.append((s * (x_flank(y, z) + 0.002), y, z, h, 0.024))
    add("cyan", strip(st2))

# ================================================================ FLANK ARMOR PLATES (seated on flank)
for s in (+1, -1):
    # angular vents on the flank
    for zv in (0.12, -0.02):
        yv = yloAt(zv) + (yshAt(zv) - yloAt(zv)) * 0.30
        add("trim", trimesh.creation.box(extents=[0.016, 0.05, 0.11]),
            translate=[s * (x_flank(yv, zv) + 0.006), yv, zv])


# ================================================================ ENGINE BLOCK + HEX THRUSTERS
def hexprism(r, h):
    return cylinder(radius=r, height=h, sections=6)

nozzles = [(0.0, 0.08, -1.33, 0.150, 1.0),
           (0.16, -0.065, -1.31, 0.090, 0.72),
           (-0.16, -0.065, -1.31, 0.090, 0.72)]
for nx, ny, nz, r, k in nozzles:
    add("trim", hexprism(r * 1.18, 0.10), translate=[nx, ny, nz])
    add("cyandim", hexprism(r * 0.95, 0.05), translate=[nx, ny, nz - 0.045])
    add("cyan", hexprism(r * 0.72, 0.04), translate=[nx, ny, nz - 0.075])
    add("core", hexprism(r * 0.38, 0.03), translate=[nx, ny, nz - 0.095])
    # radial vanes inside the nozzle ring
    for a in np.linspace(0, 2 * np.pi, 6, endpoint=False):
        vane = trimesh.creation.box(extents=[r * 0.42, 0.014, 0.035])
        add("trim", vane, rotate=rotz(a),
            translate=[nx + np.cos(a) * r * 0.62, ny + np.sin(a) * r * 0.62, nz - 0.05])

def flame_cone(r, length):
    c = trimesh.creation.cone(radius=r, height=length, sections=6)
    c.apply_transform(trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0]))
    return c

for nx, ny, nz, r, k in nozzles:
    add("flame_o", flame_cone(r * 0.85, 0.55 * k), translate=[nx, ny, nz - 0.10])
    add("flame_i", flame_cone(r * 0.45, 0.90 * k), translate=[nx, ny, nz - 0.10])

# ================================================================ EXPORT (flat-shaded, planar-subdivided)
scene = trimesh.Scene()
total_faces = 0
for key, meshes in PARTS.items():
    if not meshes:
        continue
    merged = trimesh.util.concatenate(meshes)
    for _ in range(SUBDIV[key]):
        merged = merged.subdivide()     # planar split: more polys, same shape
    merged.unmerge_vertices()           # hard edges everywhere
    merged.visual = TextureVisuals(material=M[key])
    total_faces += len(merged.faces)
    scene.add_geometry(merged, node_name=key, geom_name=key)

out = "/home/claude/swarm_fighter.glb"
scene.export(out)
print(f"exported {out}")
print(f"total faces: {total_faces:,}")
