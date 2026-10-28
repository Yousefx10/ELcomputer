#!/usr/bin/env python3
"""Offline owner-workbook review. Never connects to PDC or writes a database."""
import argparse, collections, hashlib, json, pathlib, re, unicodedata, zipfile
import xml.etree.ElementTree as E

NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def text(value):return ' '.join(str(value or '').replace('\xa0',' ').split())
def read_workbook(path):
    result=[]
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist())>32*1024*1024:raise ValueError('Workbook exceeds the offline review limit.')
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            strings=[''.join(t.text or '' for t in n.iter('{'+NS['s']+'}t')) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)]
        rels={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
        for sheet in E.fromstring(z.read('xl/workbook.xml')).find('s:sheets',NS):
            target=rels[sheet.attrib['{'+NS['r']+'}id']];target=target.lstrip('/') if target.startswith('/') else 'xl/'+target
            rows=[]
            for row in E.fromstring(z.read(target)).findall('s:sheetData/s:row',NS):
                values={}
                for cell in row:
                    value=cell.find('s:v',NS);kind=cell.attrib.get('t');key=re.sub('[0-9]','',cell.attrib['r'])
                    if kind=='s':value=strings[int(value.text)] if value is not None else ''
                    elif kind=='inlineStr':value=''.join(t.text or '' for t in cell.iter('{'+NS['s']+'}t'))
                    else:value=value.text if value is not None else ''
                    if value!='':values[key]=text(value)
                if values:rows.append(values)
            headers=rows[0] if rows else {}
            if headers=={'A':'Governorate','B':'CityID','C':'City','D':'City_Arabic'}:en_col,ar_col='C','D'
            elif headers=={'A':'Governate_(English Name)','B':'CityID','C':'City Arabic','D':'City English'}:en_col,ar_col='D','C'
            else:raise ValueError('Every worksheet must have a reviewed location header.')
            parsed={}
            for row in rows[1:]:
                identity=row.get('B','')
                if not re.fullmatch(r'[1-9][0-9]{0,8}',identity) or identity in parsed:raise ValueError('Missing or duplicate provider ID.')
                if not all(row.get(k) for k in ['A','B',en_col,ar_col]):raise ValueError('Incomplete location row.')
                parsed[identity]={'governorate':row['A'],'en':row[en_col],'ar':row[ar_col]}
            result.append((sheet.attrib['name'],parsed))
    if not result or any(set(r)!=set(result[0][1]) for _,r in result):raise ValueError('Worksheet provider IDs differ.')
    return result

def prepare(path,retained,registry):
    sheets=read_workbook(path);cached={str(r['id']):text(r['name']) for r in retained}
    alias={text(a).casefold():g for g in registry for a in g['aliases']}
    cities=[];mappings=[];conflicts=[];arabic=collections.defaultdict(list)
    for identity in sorted(sheets[0][1],key=int):
        candidates=[r[identity] for _,r in sheets]
        parents={alias.get(text(r['governorate']).casefold(),{}).get('code') for r in candidates}
        if len(parents)!=1 or None in parents:raise ValueError('Unresolved governorate alias.')
        english={r['en'] for r in candidates};arabics={r['ar'] for r in candidates}
        if len(arabics)!=1:raise ValueError('Unresolved Arabic label conflict.')
        if len(english)>1:
            if cached.get(identity) not in english:raise ValueError('Unresolved English label conflict.')
            name=cached[identity];conflicts.append(identity)
        else:name=next(iter(english))
        slug=re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFKD',name).encode('ascii','ignore').decode().lower()).strip('-')
        if not slug:raise ValueError('A neutral city code needs explicit review.')
        parent=next(iter(parents));code=parent+'-'+slug;ar=next(iter(arabics))
        city={'code':code,'governorate_code':parent,'name_en':name,'name_ar':ar,'is_active':name.casefold()!='others'}
        cities.append(city);arabic[(parent,ar)].append(city)
        mappings.append({'provider':'pdc','provider_city_id':identity,'city_code':code,'source_label_ar':ar})
    if len({c['code'] for c in cities})!=len(cities):raise ValueError('Neutral city code collision; review required.')
    ambiguous=[]
    for group in arabic.values():
        if len(group)>1:
            ambiguous.extend(c['code'] for c in group)
            for c in group:c['name_ar']='' # Honest English fallback; source Arabic remains in the mapping.
    result={'source_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'governorates':registry,'cities':cities,'provider_mappings':mappings}
    return result,{'worksheets':[{'name':n,'records':len(r)} for n,r in sheets],'governorates':len(registry),'cities':len(cities),'active_cities':sum(c['is_active'] for c in cities),'english_conflicts_resolved_from_retained_cache':conflicts,'arabic_display_fallback_codes':ambiguous,'provider_calls':0,'database_writes':0}

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('workbook',type=pathlib.Path);parser.add_argument('--retained-cities',required=True,type=pathlib.Path);parser.add_argument('--output',required=True,type=pathlib.Path);a=parser.parse_args()
    registry=json.loads(pathlib.Path(__file__).with_name('egypt-governorates.json').read_text())
    result,receipt=prepare(a.workbook,json.loads(a.retained_cities.read_text()),registry)
    with a.output.open('x') as f:f.write(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(receipt,ensure_ascii=False))
if __name__=='__main__':main()
