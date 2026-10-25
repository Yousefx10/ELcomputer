"""Read MySQL dump VALUES as data. No SQL, PHP, WordPress or network execution."""
import argparse, collections, hashlib, json, os, pathlib, re, subprocess


def values(raw):
    i, n = 0, len(raw)
    while i < n:
        while i < n and raw[i] in b' \t\r\n,;': i += 1
        if i == n: return
        if raw[i] != 40: raise ValueError('invalid row')
        i += 1
        row = []
        while True:
            while i < n and raw[i] in b' \t\r\n': i += 1
            if raw[i:i+7].lower() == b'_binary': i += 7
            if i >= n: raise ValueError('incomplete value')
            if raw[i] == 39:
                i += 1
                value = bytearray()
                while i < n:
                    c = raw[i]; i += 1
                    if c == 92:
                        if i >= n: raise ValueError('invalid escape')
                        c = raw[i]; i += 1
                        value.append({48: 0, 110: 10, 114: 13, 116: 9, 90: 26}.get(c, c))
                    elif c == 39:
                        if i < n and raw[i] == 39: value.append(c); i += 1
                        else: break
                    else: value.append(c)
                else: raise ValueError('unterminated string')
                row.append(value.decode('utf8'))
            else:
                start = i
                while i < n and raw[i] not in b',)': i += 1
                value = raw[start:i].strip()
                if not re.fullmatch(rb'NULL|[-+0-9.eE]+', value, re.I): raise ValueError('unsupported SQL value')
                row.append(None if value.upper() == b'NULL' else value.decode('ascii'))
            while i < n and raw[i] in b' \t\r\n': i += 1
            if i >= n or raw[i] not in b',)': raise ValueError('invalid separator')
            c = raw[i]; i += 1
            if c == 41: break
        yield row


def php_array(text):
    """Scalar/array subset only; never deserialize PHP objects or execute code."""
    raw = text.encode(); position = 0
    def value(depth=0):
        nonlocal position
        if depth > 12: raise ValueError('serialized depth')
        kind=raw[position:position+1]; position+=1
        if kind==b'N':
            if raw[position:position+1]!=b';': raise ValueError('serialized null')
            position+=1; return None
        if raw[position:position+1]!=b':': raise ValueError('serialized delimiter')
        position+=1
        if kind in [b'i',b'b',b'd']:
            end=raw.index(b';',position); result=raw[position:end]; position=end+1
            return bool(int(result)) if kind==b'b' else result.decode('ascii')
        if kind==b's':
            end=raw.index(b':',position); length=int(raw[position:end]);position=end+2
            if length>65536: raise ValueError('serialized string bound')
            result=raw[position:position+length].decode('utf8');position+=length
            if raw[position:position+2]!=b'";': raise ValueError('serialized string')
            position+=2;return result
        if kind==b'a':
            end=raw.index(b':',position);length=int(raw[position:end]);position=end+2
            if length>10000: raise ValueError('serialized array bound')
            result={}
            for _ in range(length):
                key=value(depth+1); result[str(key)]=value(depth+1)
            if raw[position:position+1]!=b'}': raise ValueError('serialized array')
            position+=1;return result
        raise ValueError('serialized type refused')
    result=value()
    if position!=len(raw): raise ValueError('serialized trailing data')
    return result


def password_kind(value):
    value = value or ''
    if value.startswith('$wp$2'): return 'wordpress_bcrypt_sha384'
    if value.startswith(('$P$', '$H$')): return 'phpass'
    if value.startswith(('$2a$', '$2b$', '$2y$')): return 'bcrypt'
    if value.startswith('$argon2'): return 'argon2'
    if re.fullmatch(r'[a-fA-F0-9]{32}', value): return 'md5'
    return 'empty' if not value else 'unknown'


TABLES = {'users', 'usermeta', 'posts', 'postmeta', 'options', 'woocommerce_order_items',
          'woocommerce_order_itemmeta', 'wc_orders', 'wc_order_addresses', 'wc_orders_meta', 'wc_order_operational_data'}
ORDER_META = {'_customer_user', '_order_total', '_order_tax', '_order_shipping', '_order_shipping_tax',
              '_cart_discount', '_cart_discount_tax', '_order_currency', '_payment_method', '_payment_method_title',
              '_transaction_id', '_date_paid', '_date_completed', '_paid_date', '_completed_date',
              '_refund_amount', '_refund_reason', '_elc_pdc_awb', '_elc_pdc_ref', '_elc_pdc_events'}
ITEM_META = {'_product_id', '_variation_id', '_qty', '_line_subtotal', '_line_total', '_line_tax',
             '_line_subtotal_tax', 'method_id', 'method_title', 'cost', 'total', 'tax_amount', 'discount_amount'}


def extract(stream, prefix):
    if not re.fullmatch(r'[A-Za-z0-9_]{1,64}', prefix): raise ValueError('invalid prefix')
    columns, table, selected, counts, hashes = {}, None, {}, collections.Counter(), collections.Counter()
    digest, size = hashlib.sha256(), 0
    for line in stream:
        size += len(line)
        if size > 512*1024*1024 or len(line) > 16*1024*1024: raise ValueError('dump bound exceeded')
        digest.update(line)
        m = re.match(rb'CREATE TABLE `([^`]+)`', line)
        if m: table = m[1].decode(); columns[table] = []; continue
        if table:
            m = re.match(rb'\s+`([^`]+)`', line)
            if m: columns[table].append(m[1].decode())
            elif line.startswith(b')'): table = None
        m = re.match(rb'INSERT INTO `([^`]+)`(?: \(([^)]+)\))? VALUES ', line)
        if not m: continue
        name = m[1].decode()
        suffix = name[len(prefix):] if name.startswith(prefix) else ''
        if suffix not in TABLES: continue
        cols = re.findall(r'`([^`]+)`', m[2].decode()) if m[2] else columns.get(name, [])
        if not cols: raise ValueError('missing table schema')
        for row in values(line[m.end():]):
            if len(row) != len(cols): raise ValueError('column arity')
            counts[suffix] += 1
            if sum(counts.values()) > 1000000: raise ValueError('row bound exceeded')
            rec = dict(zip(cols, row))
            if suffix == 'users':
                if not {'ID', 'user_email', 'user_pass'} <= rec.keys(): raise ValueError('wrong users table')
                kind = password_kind(rec.pop('user_pass')); hashes[kind] += 1
                rec.pop('user_activation_key', None); rec['password_hash_kind'] = kind
            elif suffix == 'usermeta':
                key = rec.get('meta_key') or ''
                if not (key.startswith(('billing_', 'shipping_')) or key in ['first_name', 'last_name', prefix+'capabilities']): continue
            elif suffix == 'posts':
                if rec.get('post_type') not in ['shop_order', 'shop_order_refund']: continue
                rec = {k: rec.get(k) for k in ['ID', 'post_type', 'post_parent', 'post_status', 'post_date_gmt', 'post_modified_gmt', 'post_excerpt']}
            elif suffix in ['postmeta', 'wc_orders_meta']:
                key = rec.get('meta_key') or ''
                if key not in ORDER_META and not key.startswith(('_billing_', '_shipping_')): continue
                if key == '_elc_pdc_events':
                    decoded=php_array(rec.get('meta_value') or '')
                    if not isinstance(decoded,dict): raise ValueError('invalid historical events')
                    rec['meta_value']=json.dumps([{k:str(v)[:2000] for k,v in event.items() if k in ['status','status_id','date','reason','source','awb'] and isinstance(v,(str,int))} for event in decoded.values() if isinstance(event,dict)],ensure_ascii=False)
            elif suffix == 'woocommerce_order_itemmeta':
                if rec.get('meta_key') not in ITEM_META: continue
            elif suffix == 'options':
                if rec.get('option_name') not in ['home', 'siteurl', 'active_plugins', 'woocommerce_custom_orders_table_enabled', 'woocommerce_custom_orders_table_data_sync_enabled']: continue
            selected.setdefault(suffix, []).append(rec)
    return {'format': 1, 'table_prefix': prefix, 'plaintext_sha256': digest.hexdigest(), 'tables': selected,
            'counts': dict(counts), 'password_hash_types': dict(hashes)}


def main():
    p = argparse.ArgumentParser()
    for name in ['archive', 'receipt', 'key-file', 'node', 'envelope', 'output', 'table-prefix']: p.add_argument('--'+name, required=True)
    a = p.parse_args(); os.umask(0o077)
    source = pathlib.Path(a.archive); receipt = json.loads(pathlib.Path(a.receipt).read_text())
    h = hashlib.sha256()
    with source.open('rb') as f:
        for block in iter(lambda: f.read(4194304), b''): h.update(block)
    if h.hexdigest() != receipt['encryptedSha256'] or source.stat().st_size != receipt['encryptedBytes']: raise ValueError('source pin')
    proc = subprocess.Popen([a.node, a.envelope, 'decrypt', a.key_file, str(source)], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        result = extract(proc.stdout, a.table_prefix)
        if proc.wait(timeout=30) != 0 or result['plaintext_sha256'] != receipt['plaintextSha256']: raise ValueError('authenticated plaintext pin')
    finally:
        if proc.poll() is None: proc.kill(); proc.wait()
    result['encrypted_sha256'] = h.hexdigest()
    raw = json.dumps(result, ensure_ascii=False).encode()
    if len(raw) > 128*1024*1024: raise ValueError('output bound exceeded')
    enc = subprocess.run([a.node, a.envelope, 'encrypt', a.key_file, a.output], input=raw, capture_output=True, timeout=120)
    if enc.returncode: raise ValueError('private output encryption')
    with open(a.output+'.receipt.json', 'x') as f: f.write(enc.stdout.decode())
    print(json.dumps({'result': 'EXTRACTED_OFFLINE', 'counts': result['counts'], 'password_hash_types': result['password_hash_types'],
                      'source_sha256': h.hexdigest(), 'sql_executed': False, 'provider_calls': 0}))


if __name__ == '__main__':
    try: main()
    except Exception as error:
        print(json.dumps({'result': 'STOP', 'error_type': type(error).__name__}))
        raise SystemExit(1)
