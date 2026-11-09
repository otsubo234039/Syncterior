"""比較専用。取得した上流実装をそのまま呼び、製品の認識処理は変更しない。"""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import sys
import time
import traceback

import cv2
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument('--sources', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
args.output.mkdir(parents=True, exist_ok=True)
blender = args.sources / 'FloorplanToBlender3d-master'
sys.path.insert(0, str(blender))
from FloorplanToBlenderLib import detect, calculate, const
# 古い実装はNumPy整数のtupleを渡す。現行OpenCVへPython floatで渡す互換アダプター。
point_polygon_test = cv2.pointPolygonTest
cv2.pointPolygonTest = lambda contour, point, measure: point_polygon_test(contour, tuple(float(x) for x in point), measure)
const.DOOR_MODEL = str(blender / const.DOOR_MODEL)
spec = importlib.util.spec_from_file_location('comparison_vectorizer', args.sources / 'floorplan-vectorizer-main/scripts/floorplan.py')
vectorizer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = vectorizer
spec.loader.exec_module(vectorizer)


def points(contour):
    return np.asarray(contour).reshape(-1, 2).astype(float).tolist()


def polygons(mask):
    contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    result = []
    if hierarchy is None:
        return result
    for i, contour in enumerate(contours):
        if hierarchy[0][i][3] != -1 or len(contour) < 3:
            continue
        holes = []
        child = hierarchy[0][i][2]
        while child != -1:
            if len(contours[child]) >= 3:
                holes.append(points(contours[child]))
            child = hierarchy[0][child][0]
        result.append({'outer': points(contour), 'holes': holes})
    return result


for name in ['monochrome', 'colored', 'dark-background', 'textured']:
    path = root / f'e2e/fixtures/floor-plans/{name}.jpg'
    image = cv2.imread(str(path))
    h, w = image.shape[:2]
    cv2.cvtColor(image, cv2.COLOR_BGR2RGBA).tofile(args.output / f'{name}.rgba')
    for method in ['blender', 'vectorizer-sealed', 'vectorizer-open']:
        started = time.perf_counter()
        result = {'image': name, 'method': method, 'width': w, 'height': h, 'errors': []}
        try:
            if method == 'blender':
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                wall_mask = detect.wall_filter(gray)
                boxes, _ = detect.precise_boxes(wall_mask)
                contour, _ = detect.outer_contours(gray)
                boxes = calculate.remove_walls_not_in_contour(boxes, contour)
                shapes = [{'outer': points(b), 'holes': []} for b in boxes if len(b) >= 3]
                floors = [{'outer': points(contour), 'holes': []}]
                # 上流Wall.generateと同じ輪郭。マスクの穴を勝手に追加しない。
                mask = np.zeros((h, w), np.uint8)
                for shape in shapes:
                    cv2.fillPoly(mask, [np.int32(shape['outer'])], 255)
                try:
                    windows, doors = detect.feature_match(gray, cv2.imread(const.DOOR_MODEL, 0))
                    result['doors'] = [{'symbol': points(d[0]), 'box': points(d[1])} for d in doors]
                    result['windows'] = [points(x) for x in windows]
                except Exception as error:
                    result['errors'].append('扉・窓検出: ' + type(error).__name__ + ': ' + str(error))
            else:
                rooms, mask = vectorizer.detect_rooms(image, seal_doors=method == 'vectorizer-sealed')
                shapes = polygons(mask)
                floors = [{'outer': points(r.contour), 'holes': [points(p) for p in r.holes]} for r in rooms]
                result['rooms'] = len(rooms)
            result.update(polygons=shapes, floors=floors, elapsedMs=(time.perf_counter() - started) * 1000)
            cv2.imwrite(str(args.output / f'{method}-{name}-mask.png'), mask)
        except Exception as error:
            result['errors'].append(traceback.format_exc())
            result.update(polygons=[], floors=[], elapsedMs=(time.perf_counter() - started) * 1000)
        (args.output / f'{method}-{name}.json').write_text(json.dumps(result))
        print(method, name, 'polygons', len(result['polygons']), 'rooms', len(result['floors']), 'errors', result['errors'], flush=True)
