"""全方式を同じ部分注釈で評価。全面の正解データではなく、認識精度とは呼ばない。"""
import argparse
import json
from pathlib import Path
import shutil
import cv2
import numpy as np

parser=argparse.ArgumentParser()
parser.add_argument('--results',type=Path,required=True)
args=parser.parse_args()
root=Path(__file__).resolve().parents[2]
output=root/'docs/floor-plan-comparison-assets'
refs=json.loads((root/'e2e/fixtures/floor-plans/references.json').read_text())
rows=[]
(output/'models').mkdir(exist_ok=True)
for image,ref in refs['images'].items():
    for method in ['current','blender','vectorizer-sealed','vectorizer-open']:
        source=args.results/f'{method}-{image}.json'
        data=json.loads(source.read_text())
        shapes=data['polygons']
        mask=np.zeros((data['height'],data['width']),np.uint8)
        for shape in shapes:
            piece=np.zeros_like(mask)
            cv2.fillPoly(piece,[np.rint(shape['outer']).astype(np.int32)],255)
            for hole in shape['holes']:
                cv2.fillPoly(piece,[np.rint(hole).astype(np.int32)],0)
            mask=cv2.bitwise_or(mask,piece)
        distances=cv2.distanceTransform(cv2.bitwise_not(mask),cv2.DIST_L2,cv2.DIST_MASK_PRECISE)
        def covered(line):
            x,y,ex,ey=line;n=max(1,int(np.ceil(np.hypot(ex-x,ey-y))))
            pts=[(round(x+(ex-x)*(i+.5)/n),round(y+(ey-y)*(i+.5)/n)) for i in range(n)]
            return sum(distances[py,px]<=refs['tolerance'] for px,py in pts)/len(pts)
        negative=np.zeros_like(mask)
        for group in ref['nonWalls']:
            x,y,ex,ey=group['box'];negative[y:ey+1,x:ex+1]=255
        noise=int(np.count_nonzero(cv2.bitwise_and(mask,negative)))
        def solid(point):
            return any(cv2.pointPolygonTest(np.float32(s['outer']),tuple(map(float,point)),False)>0 and not any(cv2.pointPolygonTest(np.float32(h),tuple(map(float,point)),False)>=0 for h in s['holes']) for s in shapes)
        def count(key,inside=True):
            return sum(solid(p)==inside for g in ref.get(key,[]) for p in g['points'])
        opening_points=sum(len(g['points']) for g in ref.get('openings',[]))
        row={'image':image,'method':method,'partialWallCoverage':sum(covered(l) for l in ref['walls'])/len(ref['walls']), 'nonWallPixels':noise,'nonWallRegionPixels':int(np.count_nonzero(negative)), 'blockedOpeningPoints':count('openings'),'annotatedOpeningPoints':opening_points,'missingProtrusionPoints':count('solidPoints',False),'unexpectedSolidPoints':count('freePoints'),'floorCandidates':len(data['floors']),'doors':len(data.get('doors',[])) if method=='blender' else None,'windows':len(data.get('windows',[])) if method=='blender' else None,'errors':data['errors']}
        rows.append(row)
        shutil.copyfile(source,output/'models'/source.name)
        print(image,method,round(row['partialWallCoverage']*100,1),noise,f"openings {row['blockedOpeningPoints']}/{opening_points}",f"nib {row['missingProtrusionPoints']}/{row['unexpectedSolidPoints']}",f"doors {row['doors']}")
    shutil.copyfile(root/f'e2e/fixtures/floor-plans/{image}.jpg',output/f'{image}-input.jpg')
(output/'metrics.json').write_text(json.dumps(rows,indent=2,ensure_ascii=False)+'\n')
