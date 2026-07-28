from __future__ import annotations

from collections import Counter
import re
import tempfile

import cadquery as cq
import ezdxf

from dxf_export import export_body_face
from projection import project_body_orthographic
from sheet_export import build_sheet_dxf, build_sheet_preview
from vcarve_layers import map_layer_name


def _build_test_part():
    return (
        cq.Workplane("XY")
        .box(100, 50, 19.05)
        .faces(">Z")
        .workplane()
        .rect(20, 10)
        .cutBlind(-12)
        .val()
    )


def _top_planar_face_index(shape) -> int:
    from OCP.BRepAdaptor import BRepAdaptor_Surface
    from OCP.GeomAbs import GeomAbs_Plane

    best_idx = 0
    best_z = float("-inf")

    for idx, face in enumerate(shape.Faces()):
        adaptor = BRepAdaptor_Surface(face.wrapped)
        if adaptor.GetType() != GeomAbs_Plane:
            continue
        plane = adaptor.Plane()
        normal = plane.Axis().Direction()
        origin = plane.Location()
        if abs(normal.Z()) < 0.999:
            continue
        if origin.Z() > best_z:
            best_z = origin.Z()
            best_idx = idx

    return best_idx


def test_vcarve_layer_name_mapping():
    assert map_layer_name("PROFILE", layer_style="vcarve") == "OUTSIDE_PROFILE"
    assert map_layer_name("HOLES", layer_style="vcarve") == "INTERIOR_OPENINGS"
    assert map_layer_name("DEPTH_12.000mm", layer_style="vcarve") == "POCKET_12MM"
    assert map_layer_name("DEPTH_6.350mm", layer_style="vcarve") == "POCKET_6P35MM"


def test_projection_retains_base_operation_semantics():
    shape = _build_test_part()
    face_index = _top_planar_face_index(shape)

    result = project_body_orthographic(shape, face_index)
    layers = {edge["layer"] for edge in result["edges"]}

    assert "PROFILE" in layers
    assert "DEPTH_12.000mm" in layers
    assert "HOLES" not in layers


def test_vcarve_dxf_uses_operation_layers():
    shape = _build_test_part()
    face_index = _top_planar_face_index(shape)

    with tempfile.TemporaryDirectory() as tmpdir:
        path = export_body_face(
            shape,
            face_index,
            tmpdir,
            "vcarve_test_part",
            layer_style="vcarve",
        )
        doc = ezdxf.readfile(path)
        layers = {entity.dxf.layer for entity in doc.modelspace()}

    assert "OUTSIDE_PROFILE" in layers
    assert "POCKET_12MM" in layers
    assert "INTERIOR_OPENINGS" not in layers
    assert all(re.fullmatch(r"[A-Z0-9_]+", layer) for layer in layers)


def test_vcarve_sheet_dxf_uses_same_operation_layers():
    shape = _build_test_part()
    face_index = _top_planar_face_index(shape)
    placements = [
        {
            "body_index": 0,
            "face_index": face_index,
            "body_name": "Left Side",
            "x_mm": 10,
            "y_mm": 20,
            "rot": True,
            "session_id": "",
        }
    ]

    doc = build_sheet_dxf(
        sheet_width_mm=300,
        sheet_length_mm=300,
        sheet_name="Birch",
        placements=placements,
        bodies_by_session={"": [{"index": 0, "shape": shape}]},
        layer_style="vcarve",
    )
    preview = build_sheet_preview(
        sheet_width_mm=300,
        sheet_length_mm=300,
        placements=placements,
        bodies_by_session={"": [{"index": 0, "shape": shape}]},
        layer_style="vcarve",
    )

    layers = {entity.dxf.layer for entity in doc.modelspace()}

    assert "SHEET_BOUNDARY" in layers
    assert "LABELS" in layers
    assert "OUTSIDE_PROFILE" in layers
    assert "POCKET_12MM" in layers
    assert "INTERIOR_OPENINGS" not in layers

    # Browser preview and downloaded DXF must use the same geometry/layers.
    dxf_geometry = [entity for entity in doc.modelspace() if entity.dxftype() != "TEXT"]
    assert len(dxf_geometry) == len(preview["edges"])
    assert Counter(entity.dxf.layer for entity in dxf_geometry) == Counter(
        edge["layer"] for edge in preview["edges"]
    )
