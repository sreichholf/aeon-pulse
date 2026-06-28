"""
DIVER — enemy fighter, procedural high-poly GLB build.
Coordinate system: +Y up, +Z forward (nose), +X right.
"""
import numpy as np
import trimesh
from trimesh.creation import icosphere, cylinder, torus, cone
from trimesh.visual.material import PBRMaterial
from trimesh.visual import TextureVisuals

DETAIL = 1.0  # scale factor for tessellation

def seg(n):  # cylinder/torus segment count
    return max(12, int(n * DETAIL))

# ---------------------------------------------------------------- materials
def mat(name, color, metallic, rough, emissive=None, alpha=None):
    m = PBRMaterial(
        name=name,
        baseColorFactor=[color[0], color[1], color[2], 1.0 if alpha is None else alpha],
        metallicFactor=metallic,
        roughnessFactor=rough,
    )
    if emissive is not None:
        m.emissiveFactor = list(emissive)
    if alpha is not None:
        m.alphaMode = "BLEND"
        m.doubleSided = True
    return m

M = {
    "yellow":   mat("YellowPaint", (0.91, 0.69, 0.13), 0.15, 0.45),
    "yellow_d": mat("YellowPaintDark", (0.78, 0.55, 0.09), 0.15, 0.55),
    "gun":      mat("Gunmetal", (0.30, 0.31, 0.33), 0.95, 0.40),
    "dark":     mat("DarkMetal", (0.10, 0.10, 0.11), 0.85, 0.55),
    "glass":    mat("CanopyGlass", (0.16, 0.38, 0.36), 0.05, 0.08, alpha=0.88),
    "orange":   mat("ThrusterGlow", (1.0, 0.55, 0.10), 0.0, 0.4, emissive=(1.0, 0.40, 0.04)),
    "red":      mat("RedLight", (0.85, 0.08, 0.05), 0.0, 0.3, emissive=(0.9, 0.05, 0.02)),
    "green":    mat("GreenLight", (0.30, 0.75, 0.45), 0.0, 0.2, emissive=(0.10, 0.45, 0.18)),
    "amber":    mat("AmberLens", (1.0, 0.70, 0.15), 0.0, 0.25, emissive=(0.9, 0.5, 0.06)),
}

PARTS = {k: [] for k in M}  # material -> list of meshes

def add(material, mesh, translate=None, rotate=None, scale=None):
    """rotate: (angle_rad, axis) or 4x4; applied scale->rotate->translate."""
    m = mesh.copy()
    if scale is not None:
        if np.isscalar(scale):
            scale = [scale] * 3
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
def roty(a): return (a, [0, 1, 0])
def rotz(a): return (a, [0, 0, 1])

# cylinders in trimesh are along +Z by default — convenient (forward axis).
def cyl(r, h, n=64, cap=True):
    return cylinder(radius=r, height=h, sections=seg(n))

def loft(profiles, close_caps=True):
    """Loft ring profiles (each (N,3)) into a watertight-ish mesh."""
    profiles = [np.asarray(p, dtype=float) for p in profiles]
    N = len(profiles[0])
    verts = np.vstack(profiles)
    faces = []
    for k in range(len(profiles) - 1):
        a0 = k * N
        b0 = (k + 1) * N
        for i in range(N):
            j = (i + 1) % N
            faces.append([a0 + i, b0 + i, b0 + j])
            faces.append([a0 + i, b0 + j, a0 + j])
    if close_caps:
        c0 = len(verts)
        verts = np.vstack([verts, profiles[0].mean(axis=0), profiles[-1].mean(axis=0)])
        for i in range(N):
            j = (i + 1) % N
            faces.append([c0, j, i])                       # start cap
            base = (len(profiles) - 1) * N
            faces.append([c0 + 1, base + i, base + j])     # end cap
    m = trimesh.Trimesh(vertices=verts, faces=np.array(faces), process=False)
    m.fix_normals()
    return m

# ================================================================ HULL
# Rounded teardrop: ellipsoid deformed — fatter at front-top, tapering rear.
hull = icosphere(subdivisions=5, radius=1.0)
v = hull.vertices.copy()
v[:, 0] *= 0.88                                   # width
v[:, 1] *= 1.00                                   # height
v[:, 2] *= 1.18                                   # length
t = (v[:, 2] / 1.18 + 1) / 2                      # 0 rear -> 1 front
squeeze = 0.72 + 0.28 * np.clip(t * 1.6, 0, 1)    # pinch the tail
v[:, 0] *= squeeze
v[:, 1] *= squeeze * (1 + 0.08 * np.clip(t - 0.4, 0, 1))   # raised fore-top
v[:, 1] += 0.10 * (1 - t) * -0.3                  # tail drops slightly
flat = v[:, 1] < -0.55
v[flat, 1] = -0.55 - (np.abs(v[flat, 1]) - 0.55) * 0.55    # flatter belly
hull.vertices = v
add("yellow", hull)

# Dorsal spine plate (subtle ridge running back from canopy)
spine = icosphere(4, 1.0)
add("yellow_d", spine, scale=[0.30, 0.18, 0.85], translate=[0, 0.82, -0.18])

# ================================================================ CANOPY
dome_dir = np.array([0.0, 0.42, 0.91])
dome_dir /= np.linalg.norm(dome_dir)
dome_pos = dome_dir * 1.00 + np.array([0, 0.22, 0.10])

# yellow housing collar
align = trimesh.geometry.align_vectors([0, 0, 1], dome_dir)
add("yellow", cyl(0.50, 0.28, 96), rotate=align, translate=dome_pos - dome_dir * 0.16)
# gunmetal ring frame
add("gun", torus(major_radius=0.46, minor_radius=0.055,
                 major_sections=seg(96), minor_sections=seg(24)),
    rotate=align, translate=dome_pos - dome_dir * 0.02)
# rivets around the ring
for a in np.linspace(0, 2 * np.pi, 14, endpoint=False):
    p_local = np.array([np.cos(a) * 0.46, np.sin(a) * 0.46, 0.05])
    R = align[:3, :3]
    add("dark", icosphere(2, 0.028), translate=dome_pos + R @ p_local)
# glass dome
dome = icosphere(5, 0.44)
dv = dome.vertices
keep_scale = np.where(dv[:, 2] < 0, 0.25, 1.0)    # flatten the back half
dv[:, 2] *= keep_scale
dome.vertices = dv
add("glass", dome, rotate=align, translate=dome_pos + dome_dir * 0.02)
# pilot silhouette hint (dark sphere inside)
add("dark", icosphere(3, 0.20), translate=dome_pos - dome_dir * 0.05)

# ================================================================ WINGS
def wing(side):  # side = +1 right, -1 left
    s = side
    def profile(cx, cy, cz, chord, th):
        """flattened-hex airfoil ring in YZ plane at x=cx (8 pts)."""
        pts = []
        for u, w in [(1.0, 0.0), (0.55, 0.8), (-0.3, 1.0), (-1.0, 0.55),
                     (-1.0, -0.55), (-0.3, -1.0), (0.55, -0.8)]:
            pts.append([cx, cy + w * th / 2, cz + u * chord / 2])
        return np.array(pts)
    p_root = profile(s * 0.50, 0.06, 0.10, 1.55, 0.36)
    p_mid  = profile(s * 1.15, -0.06, -0.12, 1.15, 0.26)
    p_tip  = profile(s * 1.70, -0.20, -0.30, 0.78, 0.16)
    w = loft([p_root, p_mid, p_tip])
    w = w.subdivide().subdivide()
    add("yellow", w)
    # rounded tip pod
    add("yellow_d", icosphere(4, 1), scale=[0.085, 0.10, 0.42],
        translate=[s * 1.70, -0.20, -0.30])
    # leading-edge dark trim
    add("gun", cyl(0.035, 1.30, 32),
        rotate=trimesh.geometry.align_vectors(
            [0, 0, 1], [s * 1.20, -0.26, -0.42]),
        translate=[s * 1.10, -0.07, -0.10])

wing(+1)
wing(-1)

# ================================================================ FRONT WEAPONS
# Twin intakes / cannon pods — long enough to protrude well clear of the hull
for s in (+1, -1):
    px, py = s * 0.40, -0.50
    add("yellow", cyl(0.30, 0.80, 96), translate=[px, py, 0.92])
    add("yellow_d", torus(0.30, 0.035, seg(96), seg(20)), translate=[px, py, 1.10])  # collar band
    add("gun", torus(0.27, 0.05, seg(96), seg(24)), translate=[px, py, 1.32])
    add("dark", cyl(0.24, 0.06, 96), translate=[px, py, 1.30])
    add("dark", icosphere(3, 0.10), translate=[px, py, 1.33])   # hub
    for a in np.linspace(0, 2 * np.pi, 8, endpoint=False):      # fan blades
        blade = trimesh.creation.box(extents=[0.20, 0.035, 0.03])
        add("gun", blade, rotate=rotz(a),
            translate=[px + np.cos(a) * 0.12, py + np.sin(a) * 0.12, 1.31])

# Central chin gun — slim enough to clear the intake pods on both sides
add("gun", cyl(0.095, 0.55, 64), translate=[0, -0.40, 1.05])
add("dark", cyl(0.060, 0.50, 48), translate=[0, -0.40, 1.20])
add("dark", cyl(0.040, 0.30, 48), translate=[0, -0.40, 1.42])
add("gun", torus(0.085, 0.020, seg(64), seg(16)), translate=[0, -0.40, 1.30])

# ================================================================ REAR
# Big central exhaust turbine
add("gun", cyl(0.46, 0.40, 128), translate=[0, 0.02, -1.05])
add("dark", cyl(0.40, 0.10, 128), translate=[0, 0.02, -1.24])
add("orange", icosphere(3, 0.10), translate=[0, 0.02, -1.26])   # glowing hub
add("amber", cyl(0.075, 0.05, 48), translate=[0, 0.02, -1.27])
for a in np.linspace(0, 2 * np.pi, 14, endpoint=False):         # turbine vanes
    blade = trimesh.creation.box(extents=[0.26, 0.045, 0.05])
    add("gun", blade, rotate=rotz(a + 0.2),
        translate=[np.cos(a) * 0.22, 0.02 + np.sin(a) * 0.22, -1.24])
add("gun", torus(0.46, 0.045, seg(128), seg(24)), translate=[0, 0.02, -1.25])

# Twin orange thrusters (lower)
for s in (+1, -1):
    px, py = s * 0.52, -0.38
    add("gun", cyl(0.225, 0.30, 96), translate=[px, py, -0.98])
    add("gun", torus(0.21, 0.04, seg(96), seg(20)), translate=[px, py, -1.13])
    lens = icosphere(4, 0.185)
    lens.vertices[:, 2] *= 0.55
    add("orange", lens, translate=[px, py, -1.13])
    # mounting strut to hull
    add("dark", cyl(0.06, 0.30, 24),
        rotate=trimesh.geometry.align_vectors([0, 0, 1], [s * 0.4, 0.3, 0.85]),
        translate=[px - s * 0.08, py + 0.08, -0.85])

# Small red marker lights (upper rear)
for s in (+1, -1):
    add("gun", cyl(0.085, 0.10, 48),
        rotate=rotx(0.3), translate=[s * 0.45, 0.38, -1.02])
    add("red", icosphere(3, 0.075), translate=[s * 0.45, 0.40, -1.06])

# Rear grille vents
for i in range(4):
    vent = trimesh.creation.box(extents=[0.30, 0.035, 0.06])
    add("dark", vent, translate=[0, 0.46 - i * 0.075, -1.02])

# ================================================================ TOP GEAR
# Main snorkel mast with elbow (matches side view)
mast_base = np.array([0.0, 0.0, 0.30])
top_y = 1.62
hull_y = 0.88
add("yellow", cyl(0.055, top_y - hull_y, 32), rotate=rotx(np.pi / 2),
    translate=[0, (top_y + hull_y) / 2, 0.30])
add("gun", cyl(0.075, 0.10, 32), rotate=rotx(np.pi / 2),
    translate=[0, hull_y + 0.16, 0.30])                          # collar
add("yellow_d", cyl(0.068, 0.07, 32), rotate=rotx(np.pi / 2),
    translate=[0, top_y - 0.20, 0.30])                           # band
add("yellow", icosphere(3, 0.07), translate=[0, top_y, 0.30])    # elbow joint
add("yellow", cyl(0.052, 0.22, 32), translate=[0, top_y, 0.43])  # forward arm
add("dark", cyl(0.058, 0.04, 32), translate=[0, top_y, 0.55])    # opening rim

# Green light stalk
add("gun", cyl(0.030, 0.42, 24), rotate=rotx(np.pi / 2),
    translate=[0.30, 1.05, 0.42])
add("gun", torus(0.075, 0.020, seg(48), seg(12)),
    rotate=rotx(np.pi / 2), translate=[0.30, 1.26, 0.42])
add("green", icosphere(4, 0.075), translate=[0.30, 1.26, 0.42])

# Hull rivets along panel line (decorative)
for a in np.linspace(-0.9, 0.9, 9):
    p = np.array([np.sin(a) * 0.86, 0.30, 0.0])
    n = p / np.linalg.norm(p)
    pos = n * np.array([0.86, 0, 0]).dot([1, 0, 0])
    add("dark", icosphere(2, 0.022),
        translate=[np.sin(a) * 0.84, 0.32, np.cos(a) * 0.0 + 0.55])

# ================================================================ WEAR TEXTURES
from PIL import Image, ImageDraw, ImageFilter

def make_wear_textures(N=2048, seed=7):
    """Procedural scratches/chips/grime. Returns (baseColor, baseColor_dark, metallicRoughness)."""
    rng = np.random.default_rng(seed)

    # soft mottling (faded paint / dirt)
    small = rng.uniform(-1, 1, (26, 26))
    mot = np.array(Image.fromarray(((small + 1) * 127.5).astype(np.uint8))
                   .resize((N, N), Image.BICUBIC), float) / 127.5 - 1
    mottle = 1.0 - 0.10 * np.clip(mot, 0, 1) - 0.04 * np.clip(-mot, 0, 1)

    metal = Image.new("L", (N, N), 0)   # bare-metal scratch mask
    grime = Image.new("L", (N, N), 0)   # dark scuff mask
    md, gd = ImageDraw.Draw(metal), ImageDraw.Draw(grime)

    def tline(d, x1, y1, x2, y2, w, fill):
        for off in (-N, 0, N):  # horizontally tileable (UV seam safe)
            d.line([(x1 + off, y1), (x2 + off, y2)], fill=fill, width=w)

    def rand_x():
        # bias wear toward the nose (u≈0.5 in the spherical mapping)
        if rng.random() < 0.5:
            return (rng.normal(0.5, 0.13) % 1.0) * N
        return rng.random() * N

    # long thin scratches
    for _ in range(420):
        x, y = rand_x(), rng.random() * N
        L, a = rng.uniform(8, 90), rng.uniform(0, 2 * np.pi)
        x2, y2 = x + np.cos(a) * L, y + np.sin(a) * L
        if rng.random() < 0.62:
            tline(md, x, y, x2, y2, 1 if rng.random() < 0.7 else 2,
                  int(rng.uniform(120, 255)))
        else:
            tline(gd, x, y, x2, y2, int(rng.integers(1, 3)),
                  int(rng.uniform(90, 200)))

    # scuff clusters (many short parallel scratches)
    for _ in range(14):
        cx, cy, ca = rand_x(), rng.random() * N, rng.uniform(0, np.pi)
        for _ in range(int(rng.integers(12, 28))):
            x, y = cx + rng.normal(0, 28), cy + rng.normal(0, 16)
            L, a = rng.uniform(6, 26), ca + rng.normal(0, 0.12)
            tline(md, x, y, x + np.cos(a) * L, y + np.sin(a) * L, 1,
                  int(rng.uniform(80, 200)))

    # paint chips
    for _ in range(70):
        x, y, r = rand_x(), rng.random() * N, rng.uniform(1.5, 5)
        for off in (-N, 0, N):
            md.ellipse([x + off - r, y - r, x + off + r, y + r],
                       fill=int(rng.uniform(150, 255)))

    metal = np.array(metal.filter(ImageFilter.GaussianBlur(0.6)), float) / 255
    grime = np.array(grime.filter(ImageFilter.GaussianBlur(0.8)), float) / 255

    yellow = np.array([232, 176, 33], float)
    steel = np.array([196, 200, 206], float)
    base = yellow[None, None, :] * mottle[..., None]
    base = base * (1 - 0.38 * grime[..., None])
    base = base * (1 - metal[..., None]) + steel[None, None, :] * metal[..., None]
    base_img = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8))
    base_dark = Image.fromarray(np.clip(base * 0.84, 0, 255).astype(np.uint8))

    rough = np.clip(0.45 + 0.10 * grime - 0.17 * metal + 0.05 * mot, 0.05, 1)
    metl = np.clip(0.15 + 0.80 * metal, 0, 1)
    mr = np.zeros((N, N, 3), np.uint8)
    mr[..., 1] = (rough * 255).astype(np.uint8)   # G = roughness
    mr[..., 2] = (metl * 255).astype(np.uint8)    # B = metallic
    return base_img, base_dark, Image.fromarray(mr)

def spherical_uv(mesh):
    d = mesh.vertices / np.maximum(np.linalg.norm(mesh.vertices, axis=1, keepdims=True), 1e-9)
    u = 0.5 + np.arctan2(d[:, 0], d[:, 2]) / (2 * np.pi)
    v = 1.0 - np.arccos(np.clip(d[:, 1], -1, 1)) / np.pi
    return np.column_stack([u, v])

def fix_uv_seam(mesh, uv):
    """Duplicate vertices of triangles spanning the u-wrap so the texture doesn't smear."""
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
            if uu < 0.5:
                uu += 1.0
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
base_img, base_dark_img, mr_img = make_wear_textures()
TEXTURED = {"yellow": base_img, "yellow_d": base_dark_img}

total_faces = 0
for key, meshes in PARTS.items():
    if not meshes:
        continue
    merged = trimesh.util.concatenate(meshes)
    if key in TEXTURED:
        uv = spherical_uv(merged)
        merged, uv = fix_uv_seam(merged, uv)
        tex_mat = PBRMaterial(
            name=M[key].name + "Worn",
            baseColorTexture=TEXTURED[key],
            metallicRoughnessTexture=mr_img,
            baseColorFactor=[1.0, 1.0, 1.0, 1.0],
            metallicFactor=1.0,
            roughnessFactor=1.0,
        )
        merged.visual = TextureVisuals(uv=uv, material=tex_mat)
    else:
        merged.visual = TextureVisuals(material=M[key])
    total_faces += len(merged.faces)
    scene.add_geometry(merged, node_name=key, geom_name=key)

out = "/home/claude/diver_fighter.glb"
scene.export(out)
print(f"exported {out}")
print(f"total faces: {total_faces:,}")
print(f"total verts: {sum(len(m.vertices) for ms in PARTS.values() for m in ms):,}")
