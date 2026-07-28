"""
Sheet DXF export: place multiple projected bodies onto a single stock sheet DXF.

Assembles one DXF per sheet by:
  1. For each placement, project the body face to 2D edges (normalized to origin).
  2. Apply optional 90° CW rotation: (u, v) → (v, -u).
  3. Translate all points by (x_mm, y_mm) from the optimizer placement.
  4. Write all edges to named layers; add SHEET_BOUNDARY and LABELS.

Layer conventions (VCarve-friendly):
  SHEET_BOUNDARY  — stock rectangle (color 7, white)
  PROFILE         — outer profiles (color 7, white)
  HOLES           — inner cutouts / pockets (color 1, red)
  DEPTH_X.XXXmm  — depth features (color 5, blue)
  LABELS          — part name text (color 8, gray)
"""
from __future__ import annotations

import math
from typing import Any, Dict, List

import ezdxf
from ezdxf.math import Vec2

from projection import collapse_closed_line_loops, project_body_orthographic
from vcarve_layers import map_layer_name, normalize_layer_style


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _rotate_pt(u: float, v: float) -> tuple[float, float]:
    """90° CW rotation: (u, v) → (v, -u)."""
    return v, -u


def _translate_edge(edge: Dict[str, Any], x_off: float, y_off: float, rot: bool) -> Dict[str, Any]:
    """Return a copy of *edge* after optional rotation then translation."""

    def xfm(pt: list[float]) -> list[float]:
        u, v = pt[0], pt[1]
        if rot:
            u, v = _rotate_pt(u, v)
        return [u + x_off, v + y_off]

    e = dict(edge)

    if e["type"] == "line":
        e = {**e, "start": xfm(e["start"]), "end": xfm(e["end"])}

    elif e["type"] == "arc":
        cx, cy = e["center"]
        if rot:
            cx, cy = _rotate_pt(cx, cy)
            # 90° CW rotation shifts angles by −90°
            e = {
                **e,
                "center": [cx + x_off, cy + y_off],
                "start_angle": e["start_angle"] - 90,
                "end_angle": e["end_angle"] - 90,
                "start": xfm(e["start"]),
                "end": xfm(e["end"]),
            }
        else:
            e = {
                **e,
                "center": [cx + x_off, cy + y_off],
                "start": xfm(e["start"]),
                "end": xfm(e["end"]),
            }

    elif e["type"] == "polyline":
        e = {**e, "points": [xfm(p) for p in e["points"]]}

    return e


# ---------------------------------------------------------------------------
# Bounding box of a set of edges (after transform)
# ---------------------------------------------------------------------------

def _orient_face_portrait(edges: List[Dict]) -> List[Dict]:
    """
    Ensure the face's U extent ≤ V extent ("portrait" orientation) so that U
    maps to the cut's shorter dimension (w) and V to its longer dimension (l),
    matching the optimizer's convention (pw=w along x, ph=l along y).

    If the face comes in landscape (face_u > face_v) — which happens when OCC's
    plane XAxis is aligned with the part's longer global dimension — apply a 90°
    CCW rotation: (u, v) → (−v + old_max_v, u).  This swaps the axes while
    keeping all coordinates in the first quadrant (≥ 0).
    """
    _, _, max_u, max_v = _edge_bbox(edges)
    if max_u <= max_v + 1e-3:
        return edges  # already portrait or square — nothing to do

    # 90° CCW: (u, v) → (−v + max_v, u)
    def xfm(pt: list[float]) -> list[float]:
        return [-pt[1] + max_v, pt[0]]

    result: List[Dict] = []
    for e in edges:
        ne = dict(e)
        if ne["type"] == "line":
            ne = {**ne, "start": xfm(ne["start"]), "end": xfm(ne["end"])}
        elif ne["type"] == "arc":
            cx, cy = ne["center"]
            ne = {
                **ne,
                "center": [-cy + max_v, cx],
                "start": xfm(ne["start"]),
                "end": xfm(ne["end"]),
                "start_angle": ne["start_angle"] + 90,
                "end_angle": ne["end_angle"] + 90,
            }
        elif ne["type"] == "polyline":
            ne = {**ne, "points": [xfm(p) for p in ne["points"]]}
        result.append(ne)
    return result


def _edge_bbox(edges: List[Dict]) -> tuple[float, float, float, float]:
    """Return (min_u, min_v, max_u, max_v) for a list of transformed edges."""
    all_u: list[float] = []
    all_v: list[float] = []

    def add(pt: list[float]) -> None:
        all_u.append(pt[0])
        all_v.append(pt[1])

    for e in edges:
        if e["type"] == "line":
            add(e["start"])
            add(e["end"])
        elif e["type"] == "arc":
            cx, cy = e["center"]
            r = e["radius"]
            if e.get("is_full_circle"):
                all_u.extend([cx - r, cx + r])
                all_v.extend([cy - r, cy + r])
            else:
                # Always include endpoints
                add(e["start"])
                add(e["end"])
                # Also include any cardinal extreme (0°/90°/180°/270°) swept by the arc
                a0 = e["start_angle"] % 360
                a1 = e["end_angle"] % 360
                for angle, du, dv in [(0, r, 0), (90, 0, r), (180, -r, 0), (270, 0, -r)]:
                    if _angle_in_arc(angle, a0, a1):
                        all_u.append(cx + du)
                        all_v.append(cy + dv)
        elif e["type"] == "polyline":
            for p in e["points"]:
                add(p)

    if not all_u:
        return 0.0, 0.0, 0.0, 0.0
    return min(all_u), min(all_v), max(all_u), max(all_v)


def _angle_in_arc(angle: float, start: float, end: float) -> bool:
    """Return True if *angle* is swept by the CCW arc from *start* to *end* (all in degrees)."""
    angle = angle % 360
    start = start % 360
    end = end % 360
    if start <= end:
        return start <= angle <= end
    # Arc wraps around 0°
    return angle >= start or angle <= end


def _shift_edges(edges: List[Dict], u_off: float, v_off: float) -> List[Dict]:
    """Translate projected edges without rotating them."""
    return [_translate_edge(edge, u_off, v_off, False) for edge in edges]


def _normalize_edges(edges: List[Dict]) -> List[Dict]:
    """Return edges translated so their geometric bounding box starts at (0, 0)."""
    if not edges:
        return []
    min_u, min_v, _, _ = _edge_bbox(edges)
    if abs(min_u) <= 1e-6 and abs(min_v) <= 1e-6:
        return edges
    return _shift_edges(edges, -min_u, -min_v)


def _prepare_placement_edges(
    body: dict,
    face_index: int,
    x_mm: float,
    y_mm: float,
    rot: bool,
) -> List[Dict]:
    """
    Run the shared projection/orientation/placement pipeline for sheet outputs.

    Both DXF export and browser preview consume this exact geometry so they
    cannot drift into subtly different normalization or rotation behavior.
    """
    try:
        edge_data = project_body_orthographic(
            body["shape"],
            face_index,
            reference_mode="selected",
        )
    except Exception:
        return []

    normalized = _normalize_edges(edge_data.get("edges", []))
    if not normalized:
        return []

    normalized = _normalize_edges(_orient_face_portrait(normalized))
    normalized = collapse_closed_line_loops(normalized)

    if rot:
        _, _, face_w_mm, _ = _edge_bbox(normalized)
        y_mm += face_w_mm

    return [_translate_edge(edge, x_mm, y_mm, rot) for edge in normalized]


# ---------------------------------------------------------------------------
# Face resolution helper
# ---------------------------------------------------------------------------

def _top_face_index(cq_shape) -> int:
    """
    Return the index of the largest planar face on the shape.

    For a rectangular board this is always the wide face (l × w), which is the
    correct CNC cutting surface.  Stored face indices from the frontend are
    unreliable — the user may have accidentally clicked an end face in the 3D
    viewer, storing a 127×19 mm face instead of the 1752×127 mm top face.
    """
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.GeomAbs import GeomAbs_Plane

    best_idx = 0
    best_area = -1.0
    for idx, face in enumerate(cq_shape.Faces()):
        adaptor = BRepAdaptor_Surface(face.wrapped)
        if adaptor.GetType() != GeomAbs_Plane:
            continue
        area = face.Area()
        if area > best_area:
            best_area = area
            best_idx = idx
    return best_idx


# ---------------------------------------------------------------------------
# ezdxf helpers
# ---------------------------------------------------------------------------

_LAYER_COLOR = {
    "SHEET_BOUNDARY": 7,
    "PROFILE": 7,
    "HOLES": 1,
    "LABELS": 8,
}

def _ensure_layer(doc: ezdxf.document.Drawing, layer_name: str) -> None:
    """Add layer to the document if it does not exist yet."""
    if layer_name not in doc.layers:
        if layer_name == "INTERIOR_OPENINGS":
            color = 1
        elif layer_name.startswith(("DEPTH_", "POCKET_")):
            color = 5
        else:
            color = _LAYER_COLOR.get(layer_name, 7)
        doc.layers.add(layer_name, color=color)


def _write_edge(msp, edge: Dict[str, Any], doc, *, layer_style: str = "default") -> None:
    original_layer = edge.get("layer", "PROFILE")
    layer = map_layer_name(original_layer, layer_style=layer_style)
    _ensure_layer(doc, layer)
    color = _LAYER_COLOR.get(original_layer, 5 if original_layer.startswith("DEPTH_") else 7)
    attribs = {"layer": layer, "color": color}

    if edge["type"] == "line":
        msp.add_line(start=Vec2(edge["start"]), end=Vec2(edge["end"]), dxfattribs=attribs)

    elif edge["type"] == "arc":
        center = Vec2(edge["center"])
        r = edge["radius"]
        if edge.get("is_full_circle"):
            msp.add_circle(center=center, radius=r, dxfattribs=attribs)
        else:
            msp.add_arc(
                center=center,
                radius=r,
                start_angle=edge["start_angle"],
                end_angle=edge["end_angle"],
                dxfattribs=attribs,
            )

    elif edge["type"] == "polyline":
        pts = [Vec2(p) for p in edge["points"]]
        if len(pts) >= 2:
            is_closed = (
                abs(pts[0].x - pts[-1].x) < 1e-6 and
                abs(pts[0].y - pts[-1].y) < 1e-6
            )
            if is_closed:
                pts[-1] = pts[0]
            msp.add_lwpolyline(pts, format="xy", close=is_closed, dxfattribs=attribs)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def build_sheet_dxf(
    sheet_width_mm: float,
    sheet_length_mm: float,
    sheet_name: str,
    placements: list[dict],
    rect_placements: list[dict] | None = None,
    *,
    bodies_by_session: dict[str, list[dict]] | None = None,
    session_bodies: list[dict] | None = None,
    layer_style: str = "default",
) -> ezdxf.document.Drawing:
    """
    Build a single-sheet DXF by projecting and placing each body.

    Parameters
    ----------
    sheet_width_mm    : stock sheet width in mm
    sheet_length_mm   : stock sheet length in mm
    sheet_name        : human-readable name for the LABELS layer text
    placements        : list of dicts for STEP-sourced cuts, keys:
        body_index    : int
        face_index    : int
        body_name     : str
        x_mm          : float  — placement offset X (mm)
        y_mm          : float  — placement offset Y (mm)
        rot           : bool   — rotate 90° CW before translating
        session_id    : str    — (optional) which STEP session this body belongs to
    rect_placements   : list of dicts for dimension-only cuts (drawn as rectangles), keys:
        body_name     : str
        x_mm          : float
        y_mm          : float
        w_mm          : float  — width along X
        h_mm          : float  — height along Y
    bodies_by_session : {session_id: bodies_list} — preferred multi-session source
    session_bodies    : flat body list — legacy single-session fallback
    """
    # Build a unified lookup: bodies_by_session takes priority
    layer_style = normalize_layer_style(layer_style)
    if bodies_by_session is None:
        bodies_by_session = {"": session_bodies or []}
    doc = ezdxf.new("R2010")
    doc.header["$INSUNITS"] = 4    # mm
    doc.header["$MEASUREMENT"] = 1  # metric
    msp = doc.modelspace()

    # Add stock boundary
    sheet_boundary_layer = map_layer_name("SHEET_BOUNDARY", layer_style=layer_style)
    labels_layer = map_layer_name("LABELS", layer_style=layer_style)

    _ensure_layer(doc, sheet_boundary_layer)
    msp.add_lwpolyline(
        [(0, 0), (sheet_width_mm, 0), (sheet_width_mm, sheet_length_mm), (0, sheet_length_mm)],
        format="xy",
        close=True,
        dxfattribs={"layer": sheet_boundary_layer, "color": 7},
    )

    _ensure_layer(doc, labels_layer)

    for placement in placements:
        body_index = placement["body_index"]
        face_index = placement["face_index"]
        body_name = placement.get("body_name", f"Body_{body_index}")
        x_mm = float(placement["x_mm"])
        y_mm = float(placement["y_mm"])
        rot = bool(placement.get("rot", False))

        # Find body from the correct session
        sid = placement.get("session_id", "")
        session_bodies_list = bodies_by_session.get(sid, [])
        body = next((b for b in session_bodies_list if b["index"] == body_index), None)
        if body is None:
            continue

        placed = _prepare_placement_edges(body, face_index, x_mm, y_mm, rot)
        if not placed:
            continue

        # Write edges
        for e in placed:
            _write_edge(msp, e, doc, layer_style=layer_style)

        # Label: centered in the placed bounding box
        bu, bv, bu2, bv2 = _edge_bbox(placed)
        cx = (bu + bu2) / 2
        cy = (bv + bv2) / 2
        height = max(2.0, min((bu2 - bu) * 0.1, (bv2 - bv) * 0.1, 10.0))
        _ensure_layer(doc, labels_layer)
        t = msp.add_text(
            body_name,
            dxfattribs={"layer": labels_layer, "color": 8, "height": height},
        )
        t.set_placement((cx, cy), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)

    # ── Dimension-only cuts: draw as simple rectangles ─────────────────
    profile_layer = map_layer_name("PROFILE", layer_style=layer_style)
    _ensure_layer(doc, profile_layer)
    _ensure_layer(doc, labels_layer)
    for rp in (rect_placements or []):
        x0 = float(rp["x_mm"])
        y0 = float(rp["y_mm"])
        w = float(rp["w_mm"])
        h = float(rp["h_mm"])
        name = rp.get("body_name", "")
        msp.add_lwpolyline(
            [(x0, y0), (x0 + w, y0), (x0 + w, y0 + h), (x0, y0 + h)],
            format="xy",
            close=True,
            dxfattribs={"layer": profile_layer, "color": 7},
        )
        if name:
            text_h = max(2.0, min(w * 0.1, h * 0.1, 10.0))
            t = msp.add_text(
                name,
                dxfattribs={"layer": labels_layer, "color": 8, "height": text_h},
            )
            t.set_placement((x0 + w / 2, y0 + h / 2), align=ezdxf.enums.TextEntityAlignment.MIDDLE_CENTER)

    return doc


def build_sheet_preview(
    sheet_width_mm: float,
    sheet_length_mm: float,
    placements: list[dict],
    rect_placements: list[dict] | None = None,
    *,
    bodies_by_session: dict[str, list[dict]] | None = None,
    session_bodies: list[dict] | None = None,
    layer_style: str = "default",
) -> dict:
    """
    Return JSON-serialisable edge data for an in-browser SVG preview of the
    full sheet layout.  Same geometry pipeline as build_sheet_dxf, but returns
    a dict instead of an ezdxf document.

    Returns { sheet_width_mm, sheet_length_mm, edges: [...] }
    """
    layer_style = normalize_layer_style(layer_style)
    if bodies_by_session is None:
        bodies_by_session = {"": session_bodies or []}

    all_edges: list[dict] = []

    # Sheet boundary as a polyline
    all_edges.append({
        "type": "polyline",
        "points": [
            [0, 0], [sheet_width_mm, 0],
            [sheet_width_mm, sheet_length_mm], [0, sheet_length_mm], [0, 0],
        ],
        "layer": map_layer_name("SHEET_BOUNDARY", layer_style=layer_style),
    })

    for placement in placements:
        body_index = placement["body_index"]
        face_index = placement["face_index"]
        x_mm = float(placement["x_mm"])
        y_mm = float(placement["y_mm"])
        rot = bool(placement.get("rot", False))

        sid = placement.get("session_id", "")
        session_bodies_list = bodies_by_session.get(sid, [])
        body = next((b for b in session_bodies_list if b["index"] == body_index), None)
        if body is None:
            continue

        placed = _prepare_placement_edges(body, face_index, x_mm, y_mm, rot)
        if not placed:
            continue
        all_edges.extend(
            [{**edge, "layer": map_layer_name(edge.get("layer"), layer_style=layer_style)} for edge in placed]
        )

    # Dimension-only cuts: simple rectangles
    for rp in (rect_placements or []):
        x0 = float(rp["x_mm"])
        y0 = float(rp["y_mm"])
        w = float(rp["w_mm"])
        h = float(rp["h_mm"])
        all_edges.append({
            "type": "polyline",
            "points": [[x0, y0], [x0 + w, y0], [x0 + w, y0 + h], [x0, y0 + h], [x0, y0]],
            "layer": map_layer_name("PROFILE", layer_style=layer_style),
        })

    return {
        "sheet_width_mm": sheet_width_mm,
        "sheet_length_mm": sheet_length_mm,
        "edges": all_edges,
    }
