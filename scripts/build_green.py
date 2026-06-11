"""
GREEN FIGHTER v2 — sleek-organic arcade starship, procedural high-poly GLB.
+Y up, +Z forward (nose), +X right. Same scale as the DIVER. Side camera is hero.
Every part is seated against the computed hull surface (no floating geometry).
"""
import numpy as np
import trimesh
from trimesh.creation import icosphere, cylinder, torus
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals
from PIL import Image

DETAIL = 1.0
def seg(n): return max(12, int(n * DETAIL))

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
    "green":   mat("HullGreen", (0.27, 0.50, 0.16), 0.45, 0.38),
    "dgreen":  mat("HullDarkGreen", (0.14, 0.27, 0.10), 0.45, 0.42),
    "lgreen":  mat("HullLightGreen", (0.40, 0.63, 0.21), 0.42, 0.34),
    "metal":   mat("BrushedMetal", (0.55, 0.58, 0.60), 0.92, 0.30),
    "dark":    mat("DarkMetal", (0.09, 0.10, 0.11), 0.85, 0.50),
    "glass":   mat("Canopy", (0.10, 0.30, 0.32), 0.05, 0.10, alpha=0.80),
    "teal":    mat("TealGlow", (0.10, 0.92, 0.82), 0.0, 0.3, emissive=(0.05, 0.85, 0.72)),
    "flame_o": mat("FlameOuter", (0.25, 0.85, 0.95), 0.0, 0.5, emissive=(0.15, 0.70, 0.90), alpha=0.50),
    "flame_i": mat("FlameInner", (0.80, 1.0, 1.0), 0.0, 0.4, emissive=(0.75, 0.95, 1.0), alpha=0.85),
}
PARTS = {k: [] for k in M}

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

def tube(points, radii, n=24, sx=1.0, sy=1.0, stations=None):
    pts = np.asarray(points, float)
    radii = np.asarray(radii, float)
    if stations:
        t0 = np.linspace(0, 1, len(pts))
        t1 = np.linspace(0, 1, stations)
        pts = np.column_stack([np.interp(t1, t0, pts[:, k]) for k in range(3)])
        radii = np.interp(t1, t0, radii)
    tans = np.gradient(pts, axis=0)
    tans /= np.maximum(np.linalg.norm(tans, axis=1, keepdims=True), 1e-9)
    profiles = []
    theta = np.linspace(0, 2 * np.pi, seg(n), endpoint=False)
    for p, t, r in zip(pts, tans, radii):
        up = np.array([0, 1, 0]) if abs(t[1]) < 0.95 else np.array([1, 0, 0])
        nv = np.cross(up, t); nv /= np.linalg.norm(nv)
        bv = np.cross(t, nv)
        ring = (p[None, :]
                + np.outer(np.cos(theta) * r * sx, nv)
                + np.outer(np.sin(theta) * r * sy, bv))
        profiles.append(ring)
    return loft(profiles)

def blade(stations, axis="x"):
    shape = [(1.0, 0.0), (0.55, 0.8), (-0.3, 1.0), (-1.0, 0.55),
             (-1.0, -0.55), (-0.3, -1.0), (0.55, -0.8)]
    profs = []
    for cx, cy, cz, chord, th in stations:
        pts = []
        for u, w in shape:
            if axis == "x":
                pts.append([cx, cy + w * th / 2, cz + u * chord / 2])
            else:
                pts.append([cx + w * th / 2, cy, cz + u * chord / 2])
        profs.append(np.array(pts))
    return loft(profs).subdivide().subdivide()

# ================================================================ FUSELAGE (organic dart)
key_z  = [-1.50, -1.10, -0.55, 0.05, 0.65, 1.20, 1.70, 2.05]
key_rx = [0.18,  0.32,  0.45,  0.50, 0.44, 0.31, 0.16, 0.03]
key_ry = [0.14,  0.25,  0.35,  0.39, 0.34, 0.23, 0.11, 0.02]
key_yc = [0.01,  0.02,  0.03,  0.04, 0.04, 0.03, 0.01, 0.0]
ZS = np.linspace(key_z[0], key_z[-1], 64)
RX = np.interp(ZS, key_z, key_rx)
RY = np.interp(ZS, key_z, key_ry)
YC = np.interp(ZS, key_z, key_yc)
NEXP = np.interp(ZS, [key_z[0], 0.0, key_z[-1]], [2.0, 2.35, 2.0])  # organic roundness

def frx(z): return np.interp(z, key_z, key_rx)
def fry(z): return np.interp(z, key_z, key_ry)
def fyc(z): return np.interp(z, key_z, key_yc)
def y_top(z): return fyc(z) + fry(z)
def y_bot(z): return fyc(z) - fry(z)

theta = np.linspace(0, 2 * np.pi, seg(72), endpoint=False)
def ring(rx, ry, yc, z, n):
    cx = np.sign(np.cos(theta)) * np.abs(np.cos(theta)) ** (2.0 / n) * rx
    cy = yc + np.sign(np.sin(theta)) * np.abs(np.sin(theta)) ** (2.0 / n) * ry
    return np.column_stack([cx, cy, np.full_like(theta, z)])

fuse = loft([ring(RX[i], RY[i], YC[i], ZS[i], NEXP[i]) for i in range(len(ZS))]).subdivide()
add("green", fuse)

# surface point at angle a (0=right side, pi/2=top), slightly proud
def surf(z, a, lift=1.0):
    n = np.interp(z, [key_z[0], 0.0, key_z[-1]], [2.0, 2.35, 2.0])
    x = np.sign(np.cos(a)) * np.abs(np.cos(a)) ** (2.0 / n) * frx(z) * lift
    y = fyc(z) + np.sign(np.sin(a)) * np.abs(np.sin(a)) ** (2.0 / n) * fry(z) * lift
    return [x, y, z]

# polished metal nose tip, continuing the hull taper exactly
add("metal", tube([[0, fyc(2.02), 2.02], [0, 0.0, 2.18], [0, 0.0, 2.32]],
                  [frx(2.02), 0.04, 0.004], n=32, stations=14))

# ================================================================ DORSAL RIDGE (organic spine hump)
dz = np.linspace(-1.05, 1.45, 44)
dw = np.interp(dz, [-1.05, 0.15, 1.45], [0.10, 0.18, 0.03])
dh = np.interp(dz, [-1.05, 0.15, 1.45], [0.05, 0.10, 0.015])
ridge_profiles = []
for i in range(len(dz)):
    base = y_top(dz[i]) - 0.04          # sunk into hull
    cx = np.cos(theta) * dw[i]
    cy = base + (np.sin(theta) * 0.5 + 0.5) * (dh[i] + 0.04)
    ridge_profiles.append(np.column_stack([cx, cy, np.full_like(theta, dz[i])]))
add("lgreen", loft(ridge_profiles))
def ridge_top(z):
    return (y_top(z) - 0.04) + np.interp(z, [-1.05, 0.15, 1.45], [0.05, 0.10, 0.015]) + 0.04

# ================================================================ CANOPY (pitched to follow the fuselage silhouette)
cz = 0.72
# local slope of the dorsal silhouette at the canopy position
slope = (ridge_top(cz + 0.30) - ridge_top(cz - 0.30)) / 0.60
pitch = np.arctan2(-slope, 1.0)        # nose-down pitch matching the surface

canopy = icosphere(5, 1.0)
cvv = canopy.vertices
cvv[:, 2] *= 2.1                       # elongate fore-aft
cvv[:, 1] *= 0.60                      # low profile
cvv[:, 0] *= 0.80
cvv[cvv[:, 1] < 0, 1] *= 0.45          # gently reduced underside (stays buried)
cvv *= 0.155
canopy.vertices = cvv
canopy.apply_transform(trimesh.transformations.rotation_matrix(pitch, [1, 0, 0]))
canopy.apply_translation([0, ridge_top(cz) - 0.045, cz])
PARTS["glass"].append(canopy)

# ================================================================ MAIN WINGS (organic curved sweep, rooted inside hull)
for s in (+1, -1):
    rootx = frx(-0.05) * 0.70           # well inside the hull
    add("green", blade([(s * rootx, fyc(-0.05), -0.05, 1.35, 0.20),
                        (s * 0.95, -0.05, -0.42, 0.92, 0.12),
                        (s * 1.50, -0.13, -0.78, 0.55, 0.07),
                        (s * 1.82, -0.18, -1.02, 0.26, 0.035)]))
    # rounded organic wingtip
    add("lgreen", icosphere(4, 1.0), scale=[0.045, 0.030, 0.16],
        translate=[s * 1.84, -0.18, -1.04])
    # teal leading-edge accent following the curve
    lead = [[s * 0.44, fyc(0.55) + 0.02, 0.58], [s * 1.00, -0.02, 0.02],
            [s * 1.50, -0.10, -0.50], [s * 1.80, -0.165, -0.90]]
    add("teal", tube(lead, [0.013, 0.012, 0.010, 0.007], n=12, stations=20))
    # darker under-strake blended below the wing root
    add("dgreen", blade([(s * rootx, fyc(-0.1) - 0.07, -0.10, 0.75, 0.07),
                        (s * 0.95, -0.13, -0.45, 0.50, 0.045)]))

# ================================================================ CANARDS (rooted inside hull)
for s in (+1, -1):
    rootx = frx(0.95) * 0.65
    add("lgreen", blade([(s * rootx, fyc(0.95) + 0.03, 0.95, 0.46, 0.08),
                        (s * 0.58, 0.02, 0.66, 0.26, 0.045),
                        (s * 0.74, 0.0, 0.52, 0.13, 0.025)]))

# ================================================================ TAIL FINS (rooted below surface)
for s in (+1, -1):
    rz = -0.90
    ry0 = y_top(rz) - 0.08              # root buried in hull
    add("green", blade([(s * 0.07, ry0, rz, 0.58, 0.08),
                        (s * 0.26, ry0 + 0.34, rz - 0.26, 0.34, 0.05),
                        (s * 0.42, ry0 + 0.62, rz - 0.46, 0.15, 0.025)], axis="y"))
    edge = [[s * 0.08, ry0 + 0.10, rz + 0.16], [s * 0.27, ry0 + 0.38, rz - 0.16],
            [s * 0.41, ry0 + 0.60, rz - 0.40]]
    add("teal", tube(edge, [0.009, 0.008, 0.006], n=10, stations=12))
# ventral fin (rooted above belly surface)
vz = -0.85
vy0 = y_bot(vz) + 0.06
add("dgreen", blade([(0, vy0, vz, 0.48, 0.07),
                    (0, vy0 - 0.26, vz - 0.20, 0.28, 0.045),
                    (0, vy0 - 0.42, vz - 0.36, 0.13, 0.022)], axis="y"))

# ================================================================ ENGINES (blended nacelles + organic fairings)
for s in (+1, -1):
    nx = frx(-1.05) * 0.80
    nz, ny = -1.10, fyc(-1.05) - 0.02
    # organic fairing blending nacelle into hull
    add("green", icosphere(4, 1.0), scale=[0.15, 0.13, 0.42],
        translate=[s * nx, ny + 0.04, nz + 0.28])
    add("dgreen", cylinder(radius=0.145, height=0.50, sections=seg(48)),
        translate=[s * nx, ny, nz])
    add("metal", torus(0.14, 0.028, seg(48), seg(16)), translate=[s * nx, ny, nz - 0.25])
    add("dark", cylinder(radius=0.11, height=0.06, sections=seg(40)),
        translate=[s * nx, ny, nz - 0.26])
    add("teal", torus(0.09, 0.016, seg(40), seg(12)), translate=[s * nx, ny, nz - 0.27])

def flame_cone(r, length):
    c = trimesh.creation.cone(radius=r, height=length, sections=seg(40))
    c.apply_transform(trimesh.transformations.rotation_matrix(np.pi, [1, 0, 0]))
    return c

for s in (+1, -1):
    nx = frx(-1.05) * 0.80
    nz, ny = -1.10, fyc(-1.05) - 0.02
    add("flame_o", flame_cone(0.10, 0.48), translate=[s * nx, ny, nz - 0.29])
    add("flame_i", flame_cone(0.060, 0.78), translate=[s * nx, ny, nz - 0.29])

# ================================================================ ORGANIC DETAILS
# gill slits (three per flank near the engines) — angled dark ellipsoids on the surface
for s in (+1, -1):
    for gz in (-0.30, -0.48, -0.66):
        p = surf(gz, 0.35 if s > 0 else np.pi - 0.35, lift=0.99)
        g = icosphere(3, 1.0)
        add("dark", g, scale=[0.018, 0.065, 0.13],
            rotate=(s * -0.35, [0, 0, 1]), translate=p)
        rim = icosphere(3, 1.0)
        add("dgreen", rim, scale=[0.014, 0.085, 0.16],
            rotate=(s * -0.35, [0, 0, 1]), translate=[p[0] * 0.985, p[1], p[2]])

# teal flank seam lines hugging the hull surface
for s in (+1, -1):
    a = 0.45 if s > 0 else np.pi - 0.45
    pts = [surf(z, a, lift=1.005) for z in np.linspace(1.55, -1.10, 22)]
    add("teal", tube(pts, np.interp(np.linspace(0, 1, 22), [0, 0.4, 1], [0.008, 0.013, 0.009]),
                     n=12))
    a2 = -0.40 if s > 0 else np.pi + 0.40
    pts2 = [surf(z, a2, lift=1.005) for z in np.linspace(1.25, -0.95, 18)]
    add("teal", tube(pts2, np.interp(np.linspace(0, 1, 18), [0, 0.5, 1], [0.007, 0.011, 0.008]),
                     n=12))
# dorsal teal line along the ridge top
rzs = np.linspace(1.30, -0.95, 20)
add("teal", tube([[0, ridge_top(z) + 0.004, z] for z in rzs],
                 np.interp(np.linspace(0, 1, 20), [0, 0.4, 1], [0.008, 0.012, 0.008]), n=12))

# ================================================================ ORGANIC HULL TEXTURE (subtle cells + faint veins)
def make_textures(N=2048, K=150, seed=23):
    rng = np.random.default_rng(seed)
    G = 512
    px = rng.uniform(0, G, K); py = rng.uniform(0, G, K)
    gx, gy = np.meshgrid(np.arange(G), np.arange(G))
    d1 = np.full((G, G), 1e9); d2 = np.full((G, G), 1e9)
    cid = np.zeros((G, G), int)
    for i in range(K):
        for ox in (-G, 0, G):
            d = (gx - (px[i] + ox)) ** 2 + (gy - py[i]) ** 2
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            cid = np.where(closer, i, cid)
            d1 = np.where(closer, d, d1)
    edge = np.exp(-((np.sqrt(d2) - np.sqrt(d1)) / 2.4) ** 2)
    shade = rng.uniform(0.93, 1.06, K)[cid]
    up = lambda a: np.asarray(Image.fromarray(
        (np.clip(a, 0, 1) * 255).astype(np.uint8)).resize((N, N), Image.BICUBIC), float) / 255
    edge_hi = up(edge)
    shade_hi = up((shade - 0.9) / 0.2) * 0.2 + 0.9
    green = np.array([69, 128, 41], float)
    base = green[None, None, :] * shade_hi[..., None]
    base *= (1 - 0.22 * edge_hi)[..., None]
    base_img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    gate = up((rng.uniform(0, 1, (12, 12)) > 0.55).astype(float))
    veins = np.clip(edge_hi * 1.2 - 0.6, 0, 1) * np.clip(gate * 1.6 - 0.6, 0, 1)
    teal = np.array([14, 200, 170], float)
    emis_img = Image.fromarray(np.clip(teal[None, None, :] * (veins * 0.5)[..., None],
                                       0, 255).astype(np.uint8))
    rough = np.clip(0.40 - 0.08 * edge_hi, 0.05, 1)
    mr = np.zeros((N, N, 3), np.uint8)
    mr[..., 1] = (rough * 255).astype(np.uint8)
    mr[..., 2] = int(0.45 * 255)
    return base_img, emis_img, Image.fromarray(mr)

def spherical_uv(mesh):
    d = mesh.vertices / np.maximum(np.linalg.norm(mesh.vertices, axis=1, keepdims=True), 1e-9)
    u = 0.5 + np.arctan2(d[:, 0], d[:, 2]) / (2 * np.pi)
    v = 1.0 - np.arccos(np.clip(d[:, 1], -1, 1)) / np.pi
    return np.column_stack([u, v])

def fix_uv_seam(mesh, uv):
    f = mesh.faces.copy()
    u = uv[:, 0]
    seam = (u[f].max(axis=1) - u[f].min(axis=1)) > 0.5
    verts, uvs = mesh.vertices, uv
    new_v, new_uv = [], []
    nv = len(verts)
    for fi in np.where(seam)[0]:
        for k in range(3):
            vi = f[fi, k]
            uu, vv = uvs[vi]
            if uu < 0.5: uu += 1.0
            new_v.append(verts[vi]); new_uv.append([uu, vv])
            f[fi, k] = nv; nv += 1
    if new_v:
        verts = np.vstack([verts, new_v])
        uvs = np.vstack([uvs, new_uv])
    m = trimesh.Trimesh(vertices=verts, faces=f, process=False)
    m.fix_normals()
    return m, uvs

# ================================================================ EXPORT
scene = trimesh.Scene()
base_img, emis_img, mr_img = make_textures()
total_faces = 0
for key, meshes in PARTS.items():
    if not meshes:
        continue
    merged = trimesh.util.concatenate(meshes)
    if key == "green":
        uv = spherical_uv(merged)
        merged, uv = fix_uv_seam(merged, uv)
        tex_mat = PBRMaterial(name="HullGreenOrganic",
                              baseColorTexture=base_img,
                              metallicRoughnessTexture=mr_img,
                              emissiveTexture=emis_img,
                              emissiveFactor=[1.0, 1.0, 1.0],
                              baseColorFactor=[1.0, 1.0, 1.0, 1.0],
                              metallicFactor=1.0, roughnessFactor=1.0)
        merged.visual = TextureVisuals(uv=uv, material=tex_mat)
    else:
        merged.visual = TextureVisuals(material=M[key])
    total_faces += len(merged.faces)
    scene.add_geometry(merged, node_name=key, geom_name=key)

out = "/home/claude/green_fighter.glb"
scene.export(out)
print(f"exported {out}")
print(f"total faces: {total_faces:,}")