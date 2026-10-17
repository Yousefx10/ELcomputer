"""Non-executing Nginx syntax reader; offsets preserve unedited source bytes.

Derived from the previously validated deployment sanitizer. Never interpolates,
executes, or exports configuration values.
"""


def parse(text):
    tokens = []
    word = ''
    start = None
    quote = None
    i = 0

    def flush():
        nonlocal word, start
        if start is not None:
            tokens.append((word, start, i, False))
            word, start = '', None

    while i < len(text):
        c = text[i]
        if quote:
            if c == quote:
                quote = None
            elif c == '\\' and i + 1 < len(text):
                word += text[i:i + 2]
                i += 1
            else:
                word += c
        elif c in "\"'":
            if start is None:
                start = i
            quote = c
        elif c == '\\' and i + 1 < len(text):
            if start is None:
                start = i
            word += text[i:i + 2]
            i += 1
        elif text.startswith('${', i):
            if start is None:
                start = i
            end = text.find('}', i + 2)
            if end < 0:
                raise ValueError('INVALID_VARIABLE')
            word += text[i:end + 1]
            i = end
        elif c == '#':
            flush()
            end = text.find('\n', i)
            i = len(text) if end < 0 else end
            continue
        elif c.isspace():
            flush()
        elif c in ';{}':
            flush()
            tokens.append((c, i, i + 1, True))
        else:
            if start is None:
                start = i
            word += c
        i += 1
    flush()
    if quote:
        raise ValueError('UNCLOSED_QUOTE')
    root = []
    stack = [(root, None)]
    pending = []
    for token, begin, end, delimiter in tokens:
        if delimiter and token in (';', '{'):
            if not pending:
                raise ValueError('MISSING_DIRECTIVE')
            node = dict(name=pending[0][0], args=[t[0] for t in pending[1:]],
                        start=pending[0][1], end=end, children=[],
                        body_start=end if token == '{' else None)
            stack[-1][0].append(node)
            pending = []
            if token == '{':
                stack.append((node['children'], node))
        elif delimiter and token == '}':
            if pending or len(stack) == 1:
                raise ValueError('INVALID_BLOCK')
            stack.pop()[1]['end'] = end
        else:
            pending.append((token, begin, end, delimiter))
    if pending or len(stack) != 1:
        raise ValueError('INCOMPLETE_CONFIGURATION')
    return root


def walk(nodes):
    for node in nodes:
        yield node
        yield from walk(node['children'])
