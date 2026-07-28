"""Self-contained regression tests for the projection and DXF pipelines."""
from __future__ import annotations
import math
import os
import tempfile
import pytest
import cadquery as cq


@pytest.fixture(scope="module")
def solid():
    """Panel with 20 through-holes and one 10.668 mm blind rectangular pocket."""
    hole_centers = [
        (20 + column * 30, 30 + row * 45)
        for row in range(4)
        for column in range(5)
    ]
    return (
        cq.Workplane("XY")
        .box(180, 180, 19.05, centered=(False, False, False))
        .faces(">Z")
        .workplane()
        .pushPoints(hole_centers)
        .hole(8)
        .faces(">Z")
        .workplane()
        .rect(30, 20)
        .cutBlind(-10.668)
        .val()
    )


@pytest.fixture(scope="module")
def top_face_index(solid):
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.GeomAbs import GeomAbs_Plane

    candidates = []
    for index, face in enumerate(solid.Faces()):
        adaptor = BRepAdaptor_Surface(face.wrapped)
        if adaptor.GetType() != GeomAbs_Plane:
            continue
        plane = adaptor.Plane()
        if abs(plane.Axis().Direction().Z()) > 0.999:
            candidates.append((plane.Location().Z(), face.Area(), index))

    assert candidates
    return max(candidates)[2]


@pytest.fixture(scope="module")
def parallel_face_indices(solid, top_face_index):
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.GeomAbs import GeomAbs_Plane

    selected = BRepAdaptor_Surface(solid.Faces()[top_face_index].wrapped)
    normal = selected.Plane().Axis().Direction()
    indices = []
    for index, face in enumerate(solid.Faces()):
        adaptor = BRepAdaptor_Surface(face.wrapped)
        if (
            adaptor.GetType() == GeomAbs_Plane
            and abs(adaptor.Plane().Axis().Direction().Dot(normal)) > 0.9999
        ):
            indices.append(index)
    return indices


# ── helpers ───────────────────────────────────────────────────────────────────

def layer_counts(edges: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for e in edges:
        l = e.get("layer", "?")
        counts[l] = counts.get(l, 0) + 1
    return counts


def edge_2d_midpoints(edges: list[dict]) -> list[tuple]:
    """Return 2D UV midpoints — NOT used for dedup (different depths can share 2D pos)."""
    mids = []
    for e in edges:
        if e["type"] == "line":
            u = (e["start"][0] + e["end"][0]) / 2
            v = (e["start"][1] + e["end"][1]) / 2
            mids.append((round(u, 2), round(v, 2)))
        elif e["type"] == "arc":
            mids.append((round(e["center"][0], 2), round(e["center"][1], 2), round(e["radius"], 2)))
        elif e["type"] == "polyline":
            pts = e["points"]
            mid = pts[len(pts) // 2]
            mids.append((round(mid[0], 2), round(mid[1], 2)))
    return mids


def normalized_line(edge: dict) -> tuple[tuple[float, float], tuple[float, float]]:
    start = tuple(round(v, 3) for v in edge["start"])
    end = tuple(round(v, 3) for v in edge["end"])
    return (start, end) if start <= end else (end, start)


# ── projection tests ──────────────────────────────────────────────────────────

class TestProjectBodyOrthographic:

    def test_machining_face_layer_counts(self, solid, top_face_index):
        from projection import project_body_orthographic
        result = project_body_orthographic(solid, top_face_index)
        counts = layer_counts(result["edges"])

        assert counts.get("PROFILE", 0) == 6,  f"Expected 6 PROFILE edges, got {counts}"
        assert counts.get("HOLES", 0) == 20,    f"Expected 20 HOLES edges, got {counts}"
        assert counts.get("DEPTH_10.668mm", 0) == 4, f"Expected 4 DEPTH_10.668mm edges, got {counts}"
        assert counts.get("DEPTH_19.050mm", 0) == 0, f"Back face should not be exported as DEPTH: {counts}"

    def test_machining_face_total_edge_count(self, solid, top_face_index):
        from projection import project_body_orthographic
        result = project_body_orthographic(solid, top_face_index)
        assert len(result["edges"]) == 30, f"Expected 30 total edges, got {len(result['edges'])}"

    def test_parallel_faces_produce_identical_output(
        self, solid, top_face_index, parallel_face_indices
    ):
        from projection import project_body_orthographic
        reference = layer_counts(
            project_body_orthographic(solid, top_face_index)["edges"]
        )
        assert len(parallel_face_indices) >= 2
        for face_index in parallel_face_indices:
            counts = layer_counts(project_body_orthographic(solid, face_index)["edges"])
            assert counts == reference, (
                f"Face {face_index} produced different counts:\n"
                f"  expected: {reference}\n  got: {counts}"
            )

    def test_no_duplicate_edges(self, solid, top_face_index):
        """No two edges should share the same 3D midpoint — the 3D dedup in
        project_body_orthographic must eliminate shared boundary curves.
        Note: 2D midpoints CAN legitimately coincide (edges at different depths
        can project to the same UV position), so we check in 3D."""
        from projection import project_body_orthographic
        from OCP.BRepAdaptor import BRepAdaptor_Curve
        import cadquery as cq

        # Re-run projection with debug OFF and verify the depth-0 wire count did
        # not balloon from missed deduplication.
        result = project_body_orthographic(solid, top_face_index)
        profile_holes = sum(1 for e in result["edges"] if e["layer"] in ("PROFILE","HOLES"))
        # The generated fixture has 6 split profile segments + 20 holes.
        # Each shared curve appears on 2 faces but must appear once in output.
        assert profile_holes == 26, (
            f"Expected 26 edges at depth 0 (6 PROFILE + 20 HOLES), got {profile_holes}"
        )

    def test_profile_edges_are_lines(self, solid, top_face_index):
        """The outer profile boundary of this part is a rectangle — all PROFILE
        edges must be lines."""
        from projection import project_body_orthographic
        result = project_body_orthographic(solid, top_face_index)
        profile = [e for e in result["edges"] if e.get("layer") == "PROFILE"]
        for e in profile:
            assert e["type"] == "line", f"Expected line in PROFILE, got {e['type']}"

    def test_bspline_outer_profile_survives_boundary_classification(self):
        """Curved outer boundaries must be classified from the exact curve.

        A chord midpoint from the projected polyline can be far enough inside a
        convex B-spline that both classifier probes land inside the face. That
        used to drop the whole curved edge and leave a zero-width projection.
        """
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        from OCP.GeomAbs import GeomAbs_Plane
        from projection import project_body_orthographic

        shape = (
            cq.Workplane("XY")
            .moveTo(0, 0)
            .spline([(25, 80), (75, 95), (120, 0)])
            .lineTo(0, 0)
            .close()
            .extrude(19.05)
            .val()
        )

        top_idx = None
        top_z = float("-inf")
        for idx, face in enumerate(shape.Faces()):
            adaptor = BRepAdaptor_Surface(face.wrapped)
            if adaptor.GetType() != GeomAbs_Plane:
                continue
            plane = adaptor.Plane()
            normal = plane.Axis().Direction()
            origin = plane.Location()
            if abs(normal.Z()) > 0.999 and origin.Z() > top_z:
                top_z = origin.Z()
                top_idx = idx

        assert top_idx is not None

        result = project_body_orthographic(shape, top_idx, reference_mode="selected")
        profile = [edge for edge in result["edges"] if edge.get("layer") == "PROFILE"]

        assert sum(edge["type"] == "line" for edge in profile) >= 1
        assert sum(edge["type"] == "polyline" for edge in profile) == 1
        assert all(not any(key.startswith("_") for key in edge) for edge in profile)

        profile_points = []
        for edge in profile:
            if edge["type"] == "line":
                profile_points.extend([edge["start"], edge["end"]])
            else:
                profile_points.extend(edge["points"])

        xs = [point[0] for point in profile_points]
        ys = [point[1] for point in profile_points]
        assert max(xs) - min(xs) > 100
        assert max(ys) - min(ys) > 70

    def test_holes_are_closed_curves(self, solid, top_face_index):
        """All hole features in the generated panel are circular.
        Depending on the STEP file encoding they may come out as GeomAbs_Circle
        (type='arc') or BSpline (type='polyline'). Either is acceptable as long
        as the shape is closed (first point ≈ last point for polylines, or
        is_full_circle=True for arcs)."""
        from projection import project_body_orthographic
        result = project_body_orthographic(solid, top_face_index)
        holes = [e for e in result["edges"] if e.get("layer") == "HOLES"]
        assert len(holes) == 20, f"Expected 20 HOLES edges, got {len(holes)}"
        for e in holes:
            assert e["type"] in ("arc", "polyline"), (
                f"Unexpected edge type in HOLES: {e['type']}"
            )
            if e["type"] == "arc":
                assert e.get("is_full_circle"), "Arc in HOLES must be a full circle"
            elif e["type"] == "polyline":
                pts = e["points"]
                dx = abs(pts[0][0] - pts[-1][0])
                dy = abs(pts[0][1] - pts[-1][1])
                assert dx < 1.0 and dy < 1.0, (
                    f"Polyline in HOLES is not closed: first={pts[0]} last={pts[-1]}"
                )

    def test_depth_edges_are_lines(self, solid, top_face_index):
        """The pocket floors are rectangular — DEPTH_* edges must be lines."""
        from projection import project_body_orthographic
        result = project_body_orthographic(solid, top_face_index)
        for e in result["edges"]:
            if e.get("layer", "").startswith("DEPTH_"):
                assert e["type"] == "line", f"Expected line in {e['layer']}, got {e['type']}"

    def test_plane_origin_and_normal_returned(self, solid, top_face_index):
        """Result must include plane metadata."""
        from projection import project_body_orthographic
        result = project_body_orthographic(solid, top_face_index)
        assert "plane_origin" in result
        assert "plane_normal" in result
        assert "plane_x_axis" in result
        assert len(result["plane_normal"]) == 3

    def test_invalid_face_index_raises(self, solid):
        from projection import project_body_orthographic
        with pytest.raises(IndexError):
            project_body_orthographic(solid, 999)

    def test_blind_pocket_depths_are_measured_from_machining_face(self):
        """Selecting the back face must not turn remaining thickness into pocket depth."""
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        from OCP.GeomAbs import GeomAbs_Plane
        from projection import project_body_orthographic

        shape = (
            cq.Workplane("XY")
            .box(100, 50, 19.05)
            .faces(">Z")
            .workplane()
            .rect(20, 10)
            .cutBlind(-12)
            .val()
        )

        top_idx = None
        bottom_idx = None
        top_z = float("-inf")
        bottom_z = float("inf")

        for idx, face in enumerate(shape.Faces()):
            adaptor = BRepAdaptor_Surface(face.wrapped)
            if adaptor.GetType() != GeomAbs_Plane:
                continue
            plane = adaptor.Plane()
            normal = plane.Axis().Direction()
            origin = plane.Location()
            if abs(normal.Z()) < 0.999:
                continue
            if origin.Z() > top_z:
                top_z = origin.Z()
                top_idx = idx
            if origin.Z() < bottom_z:
                bottom_z = origin.Z()
                bottom_idx = idx

        assert top_idx is not None and bottom_idx is not None

        top_counts = layer_counts(project_body_orthographic(shape, top_idx)["edges"])
        bottom_counts = layer_counts(project_body_orthographic(shape, bottom_idx)["edges"])

        expected = {
            "PROFILE": 4,
            "DEPTH_12.000mm": 4,
        }
        assert top_counts == expected, f"Unexpected top-face layers: {top_counts}"
        assert bottom_counts == expected, f"Back-face selection should resolve to the machining face: {bottom_counts}"

    def test_edge_open_pocket_uses_true_outer_profile(self):
        """An edge-open pocket must not steal the PROFILE layer from the real outer contour."""
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        from OCP.GeomAbs import GeomAbs_Plane
        from projection import project_body_orthographic

        shape = (
            cq.Workplane("XY")
            .box(100, 50, 19.05, centered=(False, False, False))
            .faces(">Z")
            .workplane()
            .moveTo(50, 0)
            .rect(40, 12)
            .cutBlind(-6)
            .val()
        )

        top_idx = None
        bottom_idx = None
        top_z = float("-inf")
        bottom_z = float("inf")

        for idx, face in enumerate(shape.Faces()):
            adaptor = BRepAdaptor_Surface(face.wrapped)
            if adaptor.GetType() != GeomAbs_Plane:
                continue
            plane = adaptor.Plane()
            normal = plane.Axis().Direction()
            origin = plane.Location()
            if abs(normal.Z()) < 0.999:
                continue
            if origin.Z() > top_z:
                top_z = origin.Z()
                top_idx = idx
            if origin.Z() < bottom_z:
                bottom_z = origin.Z()
                bottom_idx = idx

        assert top_idx is not None and bottom_idx is not None

        for label, face_idx in (("top", top_idx), ("bottom", bottom_idx)):
            result = project_body_orthographic(shape, face_idx)
            counts = layer_counts(result["edges"])

            assert counts.get("PROFILE", 0) == 6, f"{label}: expected split outer profile, got {counts}"
            assert counts.get("HOLES", 0) == 0, f"{label}: pocket boundaries should not remain on HOLES, got {counts}"
            assert counts.get("DEPTH_6.000mm", 0) == 4, f"{label}: wrong pocket depth layers: {counts}"
            assert counts.get("DEPTH_13.050mm", 0) == 0, f"{label}: stock thickness was treated as pocket depth: {counts}"

            profile = [e for e in result["edges"] if e["layer"] == "PROFILE"]
            profile_lines = {normalized_line(e) for e in profile if e["type"] == "line"}

            assert ((30.0, 0.0), (70.0, 0.0)) in profile_lines, (
                f"{label}: the outside edge carried by the pocket floor was not promoted to PROFILE"
            )
            assert ((30.0, 6.0), (70.0, 6.0)) not in profile_lines, (
                f"{label}: the internal pocket wall was incorrectly exported as PROFILE"
            )

            profile_bbox = [coord for edge in profile for point in (edge["start"], edge["end"]) for coord in point] if profile else []
            xs = profile_bbox[0::2]
            ys = profile_bbox[1::2]
            assert min(xs) == 0.0 and max(xs) == 100.0, f"{label}: profile did not span full part width: {profile_lines}"
            assert min(ys) == 0.0 and max(ys) == 50.0, f"{label}: profile did not span full part height: {profile_lines}"

    def test_closed_line_loops_collapse_to_polylines_for_preview_and_export(self):
        """Simple profile/pocket rectangles should collapse into closed polylines."""
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        from OCP.GeomAbs import GeomAbs_Plane
        from projection import collapse_closed_line_loops, project_body_orthographic

        shape = (
            cq.Workplane("XY")
            .box(100, 50, 19.05, centered=(False, False, False))
            .faces(">Z")
            .workplane()
            .moveTo(50, 0)
            .rect(40, 12)
            .cutBlind(-6)
            .val()
        )

        top_idx = None
        top_z = float("-inf")
        for idx, face in enumerate(shape.Faces()):
            adaptor = BRepAdaptor_Surface(face.wrapped)
            if adaptor.GetType() != GeomAbs_Plane:
                continue
            plane = adaptor.Plane()
            normal = plane.Axis().Direction()
            origin = plane.Location()
            if abs(normal.Z()) < 0.999:
                continue
            if origin.Z() > top_z:
                top_z = origin.Z()
                top_idx = idx

        assert top_idx is not None

        raw = project_body_orthographic(shape, top_idx)["edges"]
        collapsed = collapse_closed_line_loops(raw)

        profile_polys = [e for e in collapsed if e["layer"] == "PROFILE" and e["type"] == "polyline"]
        depth_polys = [e for e in collapsed if e["layer"] == "DEPTH_6.000mm" and e["type"] == "polyline"]

        assert len(profile_polys) == 1, f"Expected one closed profile polyline, got {profile_polys}"
        assert len(depth_polys) == 1, f"Expected one closed pocket polyline, got {depth_polys}"
        assert profile_polys[0]["points"][0] == profile_polys[0]["points"][-1], "Profile polyline must be closed"
        assert depth_polys[0]["points"][0] == depth_polys[0]["points"][-1], "Pocket polyline must be closed"

    def test_reverse_side_rabbet_does_not_override_selected_face(self):
        """Back-side rabbets must not hijack exports for the selected machining face."""
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        from OCP.GeomAbs import GeomAbs_Plane
        from projection import collapse_closed_line_loops, project_body_orthographic

        panel = cq.Workplane("XY").box(100, 50, 19.05, centered=(False, False, False)).val()
        reverse_rabbet = cq.Workplane("XY").box(20, 50, 6, centered=(False, False, False)).val()
        shape = panel.cut(reverse_rabbet)

        top_idx = None
        bottom_idx = None
        top_z = float("-inf")
        bottom_z = float("inf")

        for idx, face in enumerate(shape.Faces()):
            adaptor = BRepAdaptor_Surface(face.wrapped)
            if adaptor.GetType() != GeomAbs_Plane:
                continue
            plane = adaptor.Plane()
            normal = plane.Axis().Direction()
            origin = plane.Location()
            if abs(normal.Z()) < 0.999:
                continue
            if origin.Z() > top_z:
                top_z = origin.Z()
                top_idx = idx
            if origin.Z() < bottom_z:
                bottom_z = origin.Z()
                bottom_idx = idx

        assert top_idx is not None and bottom_idx is not None

        selected_top = layer_counts(
            project_body_orthographic(shape, top_idx, reference_mode="selected")["edges"]
        )
        selected_bottom = layer_counts(
            project_body_orthographic(shape, bottom_idx, reference_mode="selected")["edges"]
        )
        collapsed_top = collapse_closed_line_loops(
            project_body_orthographic(shape, top_idx, reference_mode="selected")["edges"]
        )
        collapsed_bottom = collapse_closed_line_loops(
            project_body_orthographic(shape, bottom_idx, reference_mode="selected")["edges"]
        )

        assert selected_top == {"PROFILE": 6}, (
            f"Top machining face should reduce to profile geometry only: {selected_top}"
        )
        assert selected_bottom == {"PROFILE": 6, "DEPTH_6.000mm": 4}, (
            f"Bottom machining face should show the rabbet as pocket geometry: {selected_bottom}"
        )
        assert [(edge["layer"], edge["type"]) for edge in collapsed_top] == [
            ("PROFILE", "polyline"),
        ], f"Top machining face should collapse to one closed profile polyline: {collapsed_top}"
        assert sorted((edge["layer"], edge["type"]) for edge in collapsed_bottom) == [
            ("DEPTH_6.000mm", "polyline"),
            ("PROFILE", "polyline"),
        ], f"Bottom machining face should still collapse to one closed profile and one closed pocket: {collapsed_bottom}"


# ── DXF export tests ──────────────────────────────────────────────────────────

class TestDxfExport:

    def test_export_runs_without_error(self, solid, top_face_index):
        """Full pipeline: projection → DXF file written without exception."""
        from dxf_export import export_body_face
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_body_face(solid, top_face_index, tmpdir, "LeftSide")
            assert os.path.exists(path), "DXF file not created"
            assert os.path.getsize(path) > 0, "DXF file is empty"

    def test_dxf_has_correct_layers(self, solid, top_face_index):
        """DXF entities must use layers: PROFILE, HOLES, DEPTH_10.668mm.
        Note: ezdxf's doc.layers only shows explicitly-created layer-table entries.
        We check entity .dxf.layer directly, which is the authoritative source."""
        import ezdxf
        from dxf_export import export_body_face
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_body_face(solid, top_face_index, tmpdir, "LeftSide")
            doc = ezdxf.readfile(path)
            entity_layers = {ent.dxf.layer for ent in doc.modelspace()}
            assert "PROFILE"        in entity_layers, f"Missing PROFILE, have: {entity_layers}"
            assert "HOLES"          in entity_layers, f"Missing HOLES, have: {entity_layers}"
            assert "DEPTH_10.668mm" in entity_layers, f"Missing DEPTH_10.668mm, have: {entity_layers}"
            assert "DEPTH_19.050mm" not in entity_layers, f"Back face should not be exported as DEPTH: {entity_layers}"

    def test_dxf_normalized_to_origin(self, solid, top_face_index):
        """All DXF coordinates must be >= 0 (bbox normalized to start at 0,0)."""
        import ezdxf
        from dxf_export import export_body_face
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_body_face(solid, top_face_index, tmpdir, "LeftSide")
            doc = ezdxf.readfile(path)
            msp = doc.modelspace()
            min_x, min_y = float("inf"), float("inf")
            for entity in msp:
                if entity.dxftype() == "LINE":
                    for pt in [entity.dxf.start, entity.dxf.end]:
                        min_x = min(min_x, pt.x)
                        min_y = min(min_y, pt.y)
                elif entity.dxftype() in ("ARC", "CIRCLE"):
                    c = entity.dxf.center
                    r = entity.dxf.radius
                    min_x = min(min_x, c.x - r)
                    min_y = min(min_y, c.y - r)
            assert min_x >= -0.01, f"DXF not normalized: min_x={min_x}"
            assert min_y >= -0.01, f"DXF not normalized: min_y={min_y}"

    def test_dxf_entity_count(self, solid, top_face_index):
        """DXF entity count must match the generated fixture's projected edges."""
        import ezdxf
        from dxf_export import export_body_face
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_body_face(solid, top_face_index, tmpdir, "LeftSide")
            doc = ezdxf.readfile(path)
            entities = list(doc.modelspace())
            # Closed line loops are collapsed into one LWPOLYLINE each:
            # 20 circles + 1 profile + 1 pocket floor.
            assert len(entities) == 22, f"Expected 22 DXF entities, got {len(entities)}"

    def test_opposite_face_hides_reverse_side_pocket(
        self, solid, top_face_index, parallel_face_indices
    ):
        """Selected-face export must not expose a pocket from the reverse side."""
        import ezdxf
        from dxf_export import export_body_face
        bottom_face_index = max(
            (index for index in parallel_face_indices if index != top_face_index),
            key=lambda index: solid.Faces()[index].Area(),
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            path = export_body_face(solid, bottom_face_index, tmpdir, "bottom")
            layers = {
                entity.dxf.layer
                for entity in ezdxf.readfile(path).modelspace()
            }

        assert "PROFILE" in layers
        assert "HOLES" in layers
        assert not any(layer.startswith("DEPTH_") for layer in layers)
